import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
} from "@remotion/install-whisper-cpp"
import type { Caption } from "@remotion/captions"
// Use remotion's RenderInternals to resolve the bundled ffmpeg binary
import { RenderInternals } from "@remotion/renderer"

export const WHISPER_PATH = "./whisper.cpp"
export const WHISPER_VERSION = "1.6.0"
export const WHISPER_MODEL = "medium.en"
export const WHISPER_LANG = "en"

/**
 * Detects the native frame rate of a video file using bundled ffprobe.
 * Returns the nearest common fps (24, 25, 30, 48, 50, 60) or 30 as fallback.
 */
export async function detectVideoFps(videoPath: string): Promise<number> {
  try {
    const task = RenderInternals.callFf({
      bin: "ffprobe",
      args: [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ],
      indent: false,
      logLevel: "error",
      binariesDirectory: null,
      cancelSignal: undefined,
    })
    const { stdout } = await task
    // stdout is e.g. "30000/1001\n" or "60/1\n"
    const line = stdout?.trim() ?? ""
    const match = line.match(/^(\d+)\/(\d+)$/)
    if (match) {
      const raw = parseInt(match[1], 10) / parseInt(match[2], 10)
      const common = [24, 25, 30, 48, 50, 60]
      return common.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a))
    }
  } catch {
    // ffprobe failed — fall back to 30
  }
  return 30
}

// Lazy install — runs once, subsequent calls await the same promise
let installPromise: Promise<void> | null = null

export async function ensureWhisperInstalled(): Promise<void> {
  if (!installPromise) {
    installPromise = (async () => {
      await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION })
      await downloadWhisperModel({ folder: WHISPER_PATH, model: WHISPER_MODEL })
    })()
  }
  return installPromise
}

/** Returns true if the whisper binary and model are already on disk */
export function isWhisperReady(): boolean {
  const cwd = path.resolve(process.cwd(), WHISPER_PATH)
  const modelPath = path.join(cwd, `ggml-${WHISPER_MODEL}.bin`)
  const binaryExists =
    fs.existsSync(path.join(cwd, "whisper-cli")) ||
    fs.existsSync(path.join(cwd, "main"))
  return binaryExists && fs.existsSync(modelPath)
}

// Matches whisper.cpp segment output: [HH:MM:SS.mmm --> HH:MM:SS.mmm]  text
// whisper.cpp outputs these lines to stderr as each segment is processed
const SEGMENT_RE =
  /^\[(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})\]\s+(.+)$/

function tsToMs(ts: string): number {
  // handles both HH:MM:SS.mmm and HH:MM:SS,mmm
  const normalized = ts.replace(",", ".")
  const [h, m, s] = normalized.split(":")
  return Math.round(
    (parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s)) * 1000,
  )
}

export interface WhisperSegment {
  text: string
  startMs: number
  endMs: number
}

/**
 * Transcribes a video file with real-time segment streaming.
 *
 * @param videoPath  Absolute path to the source video
 * @param onSegment  Called for each transcript segment as whisper processes it
 * @param onProgress Called with 0-1 progress as transcription proceeds
 * @returns          Word-level Caption[] from toCaptions()
 */
export async function transcribeVideo(
  videoPath: string,
  onSegment: (seg: WhisperSegment) => void,
  onProgress: (pct: number) => void,
): Promise<Caption[]> {
  await ensureWhisperInstalled()

  // 1. Extract audio to 16kHz WAV (required by whisper.cpp)
  //    Use remotion's bundled ffmpeg binary via RenderInternals so it resolves
  //    the correct platform binary + sets DYLD_LIBRARY_PATH on macOS automatically.
  const tempWav = path.join(os.tmpdir(), `ferro-${Date.now()}.wav`)
  await RenderInternals.callFf({
    bin: "ffmpeg",
    args: ["-i", videoPath, "-ar", "16000", tempWav, "-y"],
    indent: false,
    logLevel: "error",
    binariesDirectory: null,
    cancelSignal: undefined,
  })

  // 2. Resolve executable + model paths the same way the package does
  const cwd = path.resolve(process.cwd(), WHISPER_PATH)
  const modelPath = path.join(cwd, `ggml-${WHISPER_MODEL}.bin`)

  // getWhisperExecutablePath returns relative paths like './main' or './whisper'
  // We resolve the binary ourselves: whisper 1.6+ uses 'whisper-cli'
  const candidates = ["whisper-cli", "main"]
  let executable = candidates[0]
  for (const c of candidates) {
    if (fs.existsSync(path.join(cwd, c))) {
      executable = `./${c}`
      break
    }
  }

  const tmpJsonBase = path.join(os.tmpdir(), `ferro-out-${Date.now()}`)

  const args = [
    "-f",
    tempWav,
    "--output-file",
    tmpJsonBase,
    "--output-json",
    "-ojf",          // full JSON with token timestamps
    "--dtw",
    WHISPER_MODEL,   // DTW alignment for token-level timestamps
    "--max-len", "1", // 1 token per segment = one Caption per word
    "--split-on-word", // boolean flag, no value
    "-m",
    modelPath,
    "-pp",           // print progress
    "-l",
    WHISPER_LANG,
  ]

  // 3. Spawn whisper and capture stderr line-by-line for real-time output
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args, { cwd })

    let stderrBuf = ""

    const handleChunk = (chunk: Buffer) => {
      const str = chunk.toString("utf-8")
      stderrBuf += str

      // Flush complete lines
      const lines = stderrBuf.split("\n")
      stderrBuf = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()

        // Progress: "progress = 42"
        if (trimmed.includes("progress =")) {
          const pct = parseFloat(trimmed.split("progress =")[1]?.trim() ?? "0")
          if (!isNaN(pct)) onProgress(pct / 100)
          continue
        }

        // Segment line: "[00:00:00.000 --> 00:00:02.320]  Hello world"
        const m = trimmed.match(SEGMENT_RE)
        if (m) {
          onSegment({
            startMs: tsToMs(m[1]),
            endMs: tsToMs(m[2]),
            text: m[3].trim(),
          })
        }
      }
    }

    proc.stderr.on("data", handleChunk)
    proc.stdout.on("data", handleChunk)

    proc.on("error", (err) => {
      try { fs.unlinkSync(tempWav) } catch {}
      reject(err)
    })

    proc.on("exit", async () => {
      // Flush remaining buffer
      if (stderrBuf.trim()) {
        const m = stderrBuf.trim().match(SEGMENT_RE)
        if (m) {
          onSegment({ startMs: tsToMs(m[1]), endMs: tsToMs(m[2]), text: m[3].trim() })
        }
      }

      try { fs.unlinkSync(tempWav) } catch {}

      // 4. Parse the JSON output for word-level captions
      const jsonPath = `${tmpJsonBase}.json`
      if (fs.existsSync(jsonPath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
          const { captions } = toCaptions({ whisperCppOutput: raw })
          try { fs.unlinkSync(jsonPath) } catch {}
          onProgress(1)
          resolve(captions)
        } catch (err) {
          reject(new Error(`Failed to parse whisper output: ${err}`))
        }
      } else {
        reject(new Error("Whisper did not produce output. Check that the model is installed and the audio is valid."))
      }
    })
  })
}

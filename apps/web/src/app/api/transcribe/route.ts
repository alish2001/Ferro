import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import type { Caption } from "@remotion/captions"

import { createNdjsonResponse } from "@/lib/ndjson"
import { detectVideoFps, isWhisperReady, transcribeVideo, type WhisperSegment } from "@/lib/whisper"

export type TranscribeStreamEvent =
  | { type: "installing"; message: string }
  | { type: "extracting" }
  | { type: "videoMeta"; fps: number }
  | { type: "transcribing" }
  | { type: "segment"; segment: WhisperSegment }
  | { type: "progress"; pct: number }
  | { type: "captions"; captions: Caption[] }
  | { type: "error"; error: string }

// Next.js App Router: disable body size limit for video uploads
export const config = {
  api: { bodyParser: false },
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const videoFile = formData.get("video") as File | null

  if (!videoFile) {
    return Response.json({ error: "No video file provided" }, { status: 400 })
  }

  return createNdjsonResponse<TranscribeStreamEvent>({
    execute: async (write) => {
      let tempVideoPath: string | null = null

      try {
        // Warn early if whisper needs to be installed (can take 30-60s first run)
        if (!isWhisperReady()) {
          write({ type: "installing", message: "Installing whisper.cpp and downloading model (first run, ~1-2 min)…" })
        }

        // Write uploaded video to a temp file
        write({ type: "extracting" })
        const bytes = await videoFile.arrayBuffer()
        const ext = path.extname(videoFile.name) || ".mp4"
        tempVideoPath = path.join(os.tmpdir(), `ferro-upload-${Date.now()}${ext}`)
        fs.writeFileSync(tempVideoPath, Buffer.from(bytes))

        // Detect native fps before transcribing
        const fps = await detectVideoFps(tempVideoPath)
        write({ type: "videoMeta", fps })

        write({ type: "transcribing" })

        const captions = await transcribeVideo(
          tempVideoPath,
          (segment) => {
            write({ type: "segment", segment })
          },
          (pct) => {
            write({ type: "progress", pct })
          },
        )

        write({ type: "captions", captions })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        // Surface helpful hint on first-run installation issues
        if (message.toLowerCase().includes("install") || message.toLowerCase().includes("model")) {
          write({ type: "installing", message })
        } else {
          write({ type: "error", error: message })
        }
      } finally {
        if (tempVideoPath) {
          try { fs.unlinkSync(tempVideoPath) } catch {}
        }
      }
    },
  })
}

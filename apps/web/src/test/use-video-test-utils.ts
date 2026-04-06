import type { TranscribeStreamEvent } from "@/app/api/transcribe/route"
import type { FerroCaption, FerroGenerationSession } from "@/lib/ferro-contracts"

export function makeNdjsonResponse(events: TranscribeStreamEvent[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  })
}

export function makeCaptions(words: Array<[text: string, startMs: number, endMs: number]>) {
  return words.map(([text, startMs, endMs]) => ({ text, startMs, endMs }))
}

export function makeRestoreSession(opts: {
  transcript: string
  captions?: FerroCaption[]
  videoFps?: number
  includeCaptionLayer?: boolean
  width?: number
  height?: number
}): FerroGenerationSession {
  const width = opts.width ?? 1920
  const height = opts.height ?? 1080

  return {
    id: "session-restore",
    status: "complete",
    request: {
      taste: "",
      transcript: opts.transcript,
      instructions: "",
      model: "openai:gpt-4o-mini",
      width,
      height,
      videoDurationSeconds: 10,
      videoFps: opts.videoFps,
      hasSourceVideo: false,
      sourceVideoName: null,
      captions: opts.captions,
      includeCaptionLayer: opts.includeCaptionLayer,
    },
    skills: [],
    layers: [],
    versions: [],
    messages: [],
    fps: 30,
    width,
    height,
    durationInFrames: 300,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }
}

export function stubUrlApis() {
  const createObjectURL = () => "blob:ferro-test"
  const revokeObjectURL = () => {}

  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL

  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL

  return {
    restore() {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    },
  }
}


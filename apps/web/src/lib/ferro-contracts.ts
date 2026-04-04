import { z } from "zod"

export const FerroLayerSchema = z.object({
  code: z.string(),
  type: z.string(),
  title: z.string(),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().min(1),
})

export type FerroLayer = z.infer<typeof FerroLayerSchema>

export const FerroRenderPayloadSchema = z.object({
  layers: z.array(FerroLayerSchema),
  fps: z.number().int().min(1),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  durationInFrames: z.number().int().min(1),
})

export type FerroRenderPayload = z.infer<typeof FerroRenderPayloadSchema>

export interface FerroGenerateRequest {
  taste: string
  transcript: string
  instructions: string
  model: string
  width: number
  height: number
  videoDurationSeconds?: number
}

export interface FerroGenerateResponse extends FerroRenderPayload {
  skills: string[]
}

export type FerroRenderMode = "server" | "client"

export type FerroRenderJobStatus =
  | "queued"
  | "rendering"
  | "complete"
  | "error"
  | "interrupted"

export interface FerroRenderJobProgress {
  progress: number
  renderedFrames: number
  encodedFrames: number
  renderEstimatedTime: number
  renderedDoneIn: number | null
  encodedDoneIn: number | null
  stitchStage: "encoding" | "muxing"
}

export interface FerroRenderJobAcceptedResponse {
  jobId: string
  status: FerroRenderJobStatus
}

export interface FerroRenderJobResponse extends FerroRenderJobAcceptedResponse {
  progress: FerroRenderJobProgress | null
  error: string | null
  downloadUrl: string | null
}

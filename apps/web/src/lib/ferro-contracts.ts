import { z } from "zod"

export const FerroLayerStatusSchema = z.enum([
  "queued",
  "generating",
  "ready",
  "failed",
])

export type FerroLayerStatus = z.infer<typeof FerroLayerStatusSchema>

export const FerroGenerationStatusSchema = z.enum([
  "idle",
  "running",
  "complete",
  "failed",
  "interrupted",
])

export type FerroGenerationStatus = z.infer<typeof FerroGenerationStatusSchema>

export const FerroMessageStatusSchema = z.enum([
  "pending",
  "complete",
  "failed",
])

export type FerroMessageStatus = z.infer<typeof FerroMessageStatusSchema>

export const FerroLayerVersionSourceSchema = z.enum([
  "initial",
  "manual",
  "ai-edit",
])

export type FerroLayerVersionSource = z.infer<typeof FerroLayerVersionSourceSchema>

export const FerroCaptionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
})

export type FerroCaption = z.infer<typeof FerroCaptionSchema>

export const FerroLayerSchema = z.object({
  id: z.string(),
  code: z.string(),
  brief: z.string(),
  type: z.string(),
  title: z.string(),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().min(1),
  status: FerroLayerStatusSchema,
  error: z.string().nullable(),
  currentVersionId: z.string().nullable(),
})

export type FerroLayer = z.infer<typeof FerroLayerSchema>

export const FerroLayerVersionSchema = z.object({
  id: z.string(),
  layerId: z.string(),
  source: FerroLayerVersionSourceSchema,
  code: z.string(),
  createdAt: z.string(),
})

export type FerroLayerVersion = z.infer<typeof FerroLayerVersionSchema>

export const FerroLayerMessageSchema = z.object({
  id: z.string(),
  layerId: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: z.string(),
  versionId: z.string().nullable().optional(),
  status: FerroMessageStatusSchema,
})

export type FerroLayerMessage = z.infer<typeof FerroLayerMessageSchema>

export const FerroGenerateRequestSchema = z.object({
  taste: z.string(),
  transcript: z.string(),
  instructions: z.string(),
  model: z.string(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  videoDurationSeconds: z.number().positive().optional(),
  // Native fps of the source video — planner and compositor use this to match frame rate
  videoFps: z.number().int().min(1).max(240).optional(),
  hasSourceVideo: z.boolean().optional(),
  sourceVideoName: z.string().nullable().optional(),
  // Word-level timestamped captions from whisper — always used by planner when present
  captions: z.array(FerroCaptionSchema).optional(),
  // Whether to include a TikTok-style animated caption overlay layer
  includeCaptionLayer: z.boolean().optional(),
})

export type FerroGenerateRequest = z.infer<typeof FerroGenerateRequestSchema>

export const FerroGenerationRequestSnapshotSchema =
  FerroGenerateRequestSchema.extend({
    hasSourceVideo: z.boolean(),
    sourceVideoName: z.string().nullable(),
    videoFps: z.number().int().min(1).max(240).optional(),
    captions: z.array(FerroCaptionSchema).optional(),
    includeCaptionLayer: z.boolean().optional(),
  })

export type FerroGenerationRequestSnapshot = z.infer<
  typeof FerroGenerationRequestSnapshotSchema
>

export const FerroRenderPayloadSchema = z.object({
  layers: z.array(FerroLayerSchema),
  fps: z.number().int().min(1),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  durationInFrames: z.number().int().min(1),
})

export type FerroRenderPayload = z.infer<typeof FerroRenderPayloadSchema>

export const FerroGenerateResponseSchema = FerroRenderPayloadSchema.extend({
  generationId: z.string(),
  skills: z.array(z.string()),
})

export type FerroGenerateResponse = z.infer<typeof FerroGenerateResponseSchema>

export const FerroGenerationSessionSchema = z.object({
  id: z.string(),
  status: FerroGenerationStatusSchema,
  request: FerroGenerationRequestSnapshotSchema,
  skills: z.array(z.string()),
  layers: z.array(FerroLayerSchema),
  versions: z.array(FerroLayerVersionSchema),
  messages: z.array(FerroLayerMessageSchema),
  fps: z.number().int().min(1).nullable(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  durationInFrames: z.number().int().min(1).nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
})

export type FerroGenerationSession = z.infer<typeof FerroGenerationSessionSchema>

export const FerroGenerationSessionIndexItemSchema = z.object({
  id: z.string(),
  status: FerroGenerationStatusSchema,
  title: z.string(),
  model: z.string(),
  layerCount: z.number().int().min(0),
  updatedAt: z.string(),
  sourceVideoName: z.string().nullable(),
})

export type FerroGenerationSessionIndexItem = z.infer<
  typeof FerroGenerationSessionIndexItemSchema
>

export type FerroGenerateStreamEvent =
  | {
      type: "job-started"
      generationId: string
      createdAt: string
      request: FerroGenerationRequestSnapshot
    }
  | {
      type: "skills-ready"
      generationId: string
      skills: string[]
    }
  | {
      type: "plan-ready"
      generationId: string
      fps: number
      width: number
      height: number
      durationInFrames: number
      layers: FerroLayer[]
    }
  | {
      type: "layer-started"
      generationId: string
      layerId: string
    }
  | {
      type: "layer-completed"
      generationId: string
      layer: FerroLayer
      version: FerroLayerVersion
    }
  | {
      type: "layer-failed"
      generationId: string
      layerId: string
      error: string
    }
  | {
      type: "job-completed"
      generationId: string
      response: FerroGenerateResponse
      completedAt: string
    }
  | {
      type: "job-failed"
      generationId: string
      error: string
      completedAt: string
    }

export const FerroLayerEditRequestSchema = z.object({
  generationId: z.string(),
  layerId: z.string(),
  model: z.string(),
  skills: z.array(z.string()),
  layer: FerroLayerSchema,
  currentCode: z.string(),
  messages: z.array(FerroLayerMessageSchema),
})

export type FerroLayerEditRequest = z.infer<typeof FerroLayerEditRequestSchema>

export type FerroLayerEditStreamEvent =
  | {
      type: "edit-started"
      generationId: string
      layerId: string
    }
  | {
      type: "edit-completed"
      generationId: string
      layerId: string
      reply: string
      version: FerroLayerVersion
      code: string
    }
  | {
      type: "edit-failed"
      generationId: string
      layerId: string
      error: string
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

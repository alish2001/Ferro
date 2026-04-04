import { extractComponentCode, stripMarkdownFences } from "@/helpers/sanitize-response"
import type {
  FerroGenerateRequest,
  FerroGenerateResponse,
  FerroGenerateStreamEvent,
  FerroGenerationRequestSnapshot,
  FerroGenerationSession,
  FerroLayer,
  FerroLayerVersion,
} from "@/lib/ferro-contracts"
import { FAST_MODEL_ID, getModel } from "@/lib/models"
import { getCombinedSkillContent } from "@/skills"
import { generateLayer } from "./generator"
import { planGraphics } from "./planner"
import { buildSystemPrompt } from "./prompts"
import { detectSkills } from "./skills"

function nowIso() {
  return new Date().toISOString()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Generation failed"
}

function createRequestSnapshot(
  request: FerroGenerateRequest,
): FerroGenerationRequestSnapshot {
  return {
    taste: request.taste,
    transcript: request.transcript,
    instructions: request.instructions,
    model: request.model,
    width: request.width,
    height: request.height,
    videoDurationSeconds: request.videoDurationSeconds,
    hasSourceVideo: request.hasSourceVideo ?? false,
    sourceVideoName: request.sourceVideoName ?? null,
  }
}

function createQueuedLayer(planLayer: {
  type: string
  brief: string
  from: number
  durationInFrames: number
}): FerroLayer {
  return {
    id: crypto.randomUUID(),
    code: "",
    brief: planLayer.brief,
    type: planLayer.type,
    title: planLayer.brief.slice(0, 80),
    from: planLayer.from,
    durationInFrames: planLayer.durationInFrames,
    status: "queued",
    error: null,
    currentVersionId: null,
  }
}

function createBaseSession(
  request: FerroGenerateRequest,
  generationId: string,
  createdAt: string,
): FerroGenerationSession {
  return {
    id: generationId,
    status: "running",
    request: createRequestSnapshot(request),
    skills: [],
    layers: [],
    versions: [],
    messages: [],
    fps: null,
    width: request.width,
    height: request.height,
    durationInFrames: null,
    error: null,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
  }
}

function upsertLayer(session: FerroGenerationSession, nextLayer: FerroLayer) {
  session.layers = session.layers.map((layer) =>
    layer.id === nextLayer.id ? nextLayer : layer,
  )
}

function assertCompleteSession(session: FerroGenerationSession): asserts session is FerroGenerationSession & {
  fps: number
  durationInFrames: number
} {
  if (session.fps == null || session.durationInFrames == null) {
    throw new Error("Generation session is missing final video metadata")
  }
}

export function buildGenerateResponse(
  session: FerroGenerationSession,
): FerroGenerateResponse {
  assertCompleteSession(session)

  return {
    generationId: session.id,
    layers: session.layers,
    fps: session.fps,
    width: session.width,
    height: session.height,
    durationInFrames: session.durationInFrames,
    skills: session.skills,
  }
}

export interface RunGenerationPipelineResult {
  session: FerroGenerationSession
  response: FerroGenerateResponse | null
  success: boolean
}

export async function runGenerationPipeline({
  request,
  onEvent,
}: {
  request: FerroGenerateRequest
  onEvent?: (event: FerroGenerateStreamEvent) => void | Promise<void>
}): Promise<RunGenerationPipelineResult> {
  const generationId = crypto.randomUUID()
  const createdAt = nowIso()
  const session = createBaseSession(request, generationId, createdAt)

  await onEvent?.({
    type: "job-started",
    generationId,
    createdAt,
    request: session.request,
  })

  try {
    const fastModel = getModel(FAST_MODEL_ID)
    const selectedModel = getModel(request.model)

    const skillPrompt = [
      request.taste,
      request.instructions,
      request.transcript.slice(0, 500),
    ]
      .filter(Boolean)
      .join("\n")

    const skills = await detectSkills(skillPrompt, fastModel)
    session.skills = skills
    session.updatedAt = nowIso()

    await onEvent?.({
      type: "skills-ready",
      generationId,
      skills,
    })

    const plan = await planGraphics(
      {
        taste: request.taste,
        transcript: request.transcript,
        instructions: request.instructions,
        videoDurationSeconds: request.videoDurationSeconds,
      },
      fastModel,
    )

    const layers = plan.layers.map((layer) => createQueuedLayer(layer))
    session.layers = layers
    session.fps = plan.fps
    session.durationInFrames = request.videoDurationSeconds
      ? Math.round(request.videoDurationSeconds * plan.fps)
      : Math.max(
          ...layers.map((layer) => layer.from + layer.durationInFrames),
          plan.fps * 30,
        )
    session.updatedAt = nowIso()

    await onEvent?.({
      type: "plan-ready",
      generationId,
      fps: plan.fps,
      width: request.width,
      height: request.height,
      durationInFrames: session.durationInFrames,
      layers,
    })

    const skillContent = getCombinedSkillContent(skills)
    const systemPrompt = buildSystemPrompt(skillContent)

    const results = await Promise.allSettled(
      plan.layers.map(async (planLayer, index) => {
        const queuedLayer = session.layers[index]
        const startedLayer: FerroLayer = {
          ...queuedLayer,
          status: "generating",
          error: null,
        }
        upsertLayer(session, startedLayer)
        session.updatedAt = nowIso()

        await onEvent?.({
          type: "layer-started",
          generationId,
          layerId: queuedLayer.id,
        })

        const rawCode = await generateLayer(
          `Layer type: ${planLayer.type}\n\n${planLayer.brief}`,
          systemPrompt,
          selectedModel,
        )

        const code = extractComponentCode(stripMarkdownFences(rawCode))
        const version: FerroLayerVersion = {
          id: crypto.randomUUID(),
          layerId: queuedLayer.id,
          source: "initial",
          code,
          createdAt: nowIso(),
        }

        const completedLayer: FerroLayer = {
          ...startedLayer,
          code,
          status: "ready",
          error: null,
          currentVersionId: version.id,
        }

        upsertLayer(session, completedLayer)
        session.versions = [...session.versions, version]
        session.updatedAt = nowIso()

        await onEvent?.({
          type: "layer-completed",
          generationId,
          layer: completedLayer,
          version,
        })

        return completedLayer
      }),
    )

    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )

    if (firstFailure) {
      const errorMessage = getErrorMessage(firstFailure.reason)
      const failedLayers: FerroLayer[] = session.layers.map((layer) => {
        if (layer.status === "queued" || layer.status === "generating") {
          return {
            ...layer,
            status: "failed" as const,
            error: errorMessage,
          }
        }

        return layer
      })

      session.layers = failedLayers
      session.status = "failed"
      session.error = errorMessage
      session.updatedAt = nowIso()
      session.completedAt = session.updatedAt

      const failedLayerIds = new Set(
        failedLayers
          .filter((layer) => layer.status === "failed")
          .map((layer) => layer.id),
      )

      for (const layerId of failedLayerIds) {
        await onEvent?.({
          type: "layer-failed",
          generationId,
          layerId,
          error: errorMessage,
        })
      }

      await onEvent?.({
        type: "job-failed",
        generationId,
        error: errorMessage,
        completedAt: session.completedAt,
      })

      return {
        session,
        response: null,
        success: false,
      }
    }

    session.status = "complete"
    session.error = null
    session.updatedAt = nowIso()
    session.completedAt = session.updatedAt

    const response = buildGenerateResponse(session)

    await onEvent?.({
      type: "job-completed",
      generationId,
      response,
      completedAt: session.completedAt,
    })

    return {
      session,
      response,
      success: true,
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error)

    session.status = "failed"
    session.error = errorMessage
    session.updatedAt = nowIso()
    session.completedAt = session.updatedAt

    await onEvent?.({
      type: "job-failed",
      generationId,
      error: errorMessage,
      completedAt: session.completedAt,
    })

    return {
      session,
      response: null,
      success: false,
    }
  }
}

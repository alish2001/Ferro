import { extractComponentCode, stripMarkdownFences } from "@/helpers/sanitize-response"
import type {
  DevModeStageTrace,
  FerroGenerateRequest,
  FerroGenerateResponse,
  FerroGenerateStreamEvent,
  FerroGenerationRequestSnapshot,
  FerroGenerationSession,
  FerroLayer,
  FerroLayerVersion,
} from "@/lib/ferro-contracts"
import { FAST_MODEL_ID, getModel } from "@/lib/models"
import { getCombinedSkillContent, type SkillName } from "@/skills"
import { buildCaptionsLayerCode } from "./captions-layer"
import { generateLayer } from "./generator"
import { planGraphics } from "./planner"
import { buildSystemPrompt } from "./prompts"
import { detectSkills } from "./skills"
import type { GraphicPlan } from "./planner"

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
    videoFps: request.videoFps,
    hasSourceVideo: request.hasSourceVideo ?? false,
    sourceVideoName: request.sourceVideoName ?? null,
    captions: request.captions,
    includeCaptionLayer: request.includeCaptionLayer,
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

function makeTrace(
  stageId: string,
  stageName: string,
  partial: Partial<DevModeStageTrace>,
): DevModeStageTrace {
  return {
    stageId,
    stageName,
    status: "pending",
    systemPrompt: null,
    userPrompt: null,
    rawOutput: null,
    modelId: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    tokenUsage: null,
    finishReason: null,
    error: null,
    ...partial,
  }
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
  const devMode = request.devMode ?? false

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

    // ── STAGE 1: Skill Detection ──────────────────────────────────

    if (devMode) {
      await onEvent?.({
        type: "debug-stage-update",
        generationId,
        trace: makeTrace("skill-detection", "Skill Detection", {
          status: "running",
          userPrompt: skillPrompt,
          modelId: FAST_MODEL_ID,
          startedAt: nowIso(),
        }),
      })
    }

    const skillT0 = Date.now()
    let skills: string[]

    if (devMode) {
      const traceResult = await detectSkills(skillPrompt, fastModel, { returnTrace: true })
      skills = traceResult.skills
      const skillT1 = Date.now()
      await onEvent?.({
        type: "debug-stage-update",
        generationId,
        trace: makeTrace("skill-detection", "Skill Detection", {
          status: "complete",
          systemPrompt: traceResult.systemPrompt,
          userPrompt: traceResult.userPrompt,
          rawOutput: traceResult.rawOutput,
          modelId: traceResult.modelId,
          startedAt: new Date(skillT0).toISOString(),
          completedAt: nowIso(),
          durationMs: skillT1 - skillT0,
          tokenUsage: traceResult.usage,
          finishReason: traceResult.finishReason,
        }),
      })
    } else {
      skills = await detectSkills(skillPrompt, fastModel)
    }

    session.skills = skills
    session.updatedAt = nowIso()

    await onEvent?.({
      type: "skills-ready",
      generationId,
      skills,
    })

    // ── STAGE 2: Graphic Planning ─────────────────────────────────

    const planBrief = {
      taste: request.taste,
      transcript: request.transcript,
      instructions: request.instructions,
      videoDurationSeconds: request.videoDurationSeconds,
      videoFps: request.videoFps,
      captions: request.captions,
      includeCaptionLayer: request.includeCaptionLayer,
    }

    if (devMode) {
      await onEvent?.({
        type: "debug-stage-update",
        generationId,
        trace: makeTrace("planning", "Graphic Planning", {
          status: "running",
          modelId: FAST_MODEL_ID,
          startedAt: nowIso(),
        }),
      })
    }

    const planT0 = Date.now()
    let plan: GraphicPlan

    if (devMode) {
      const traceResult = await planGraphics(planBrief, fastModel, { returnTrace: true })
      plan = traceResult.plan
      const planT1 = Date.now()
      await onEvent?.({
        type: "debug-stage-update",
        generationId,
        trace: makeTrace("planning", "Graphic Planning", {
          status: "complete",
          systemPrompt: traceResult.systemPrompt,
          userPrompt: traceResult.userPrompt,
          rawOutput: traceResult.rawOutput,
          modelId: traceResult.modelId,
          startedAt: new Date(planT0).toISOString(),
          completedAt: nowIso(),
          durationMs: planT1 - planT0,
          tokenUsage: traceResult.usage,
          finishReason: traceResult.finishReason,
        }),
      })
    } else {
      plan = await planGraphics(planBrief, fastModel)
    }

    const layers = plan.layers.map((layer) => createQueuedLayer(layer))
    session.layers = layers
    const canonicalFps = request.videoFps ?? plan.fps
    session.fps = canonicalFps
    session.durationInFrames = request.videoDurationSeconds
      ? Math.round(request.videoDurationSeconds * canonicalFps)
      : Math.max(
          ...layers.map((layer) => layer.from + layer.durationInFrames),
          canonicalFps * 30,
        )
    session.updatedAt = nowIso()

    await onEvent?.({
      type: "plan-ready",
      generationId,
      fps: canonicalFps,
      width: request.width,
      height: request.height,
      durationInFrames: session.durationInFrames,
      layers,
    })

    // ── STAGE 3: System Prompt Build (no LLM) ─────────────────────

    const skillContent = getCombinedSkillContent(skills as SkillName[])
    const systemPrompt = buildSystemPrompt(skillContent)

    if (devMode) {
      await onEvent?.({
        type: "debug-stage-update",
        generationId,
        trace: makeTrace("system-prompt-build", "System Prompt Build", {
          status: "complete",
          userPrompt: `Skills: ${skills.join(", ")}`,
          rawOutput: systemPrompt,
          startedAt: nowIso(),
          completedAt: nowIso(),
          durationMs: 0,
        }),
      })
    }

    // ── STAGE 4: Parallel Layer Generation ────────────────────────

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

        const layerBrief = `Layer type: ${planLayer.type}\n\n${planLayer.brief}`

        if (devMode) {
          await onEvent?.({
            type: "debug-stage-update",
            generationId,
            trace: makeTrace(`layer-gen-${queuedLayer.id}`, `Layer: ${planLayer.type}`, {
              status: "running",
              systemPrompt,
              userPrompt: layerBrief,
              modelId: planLayer.type === "captions" ? null : request.model,
              startedAt: nowIso(),
            }),
          })
        }

        const layerT0 = Date.now()
        let code: string

        if (planLayer.type === "captions") {
          code = buildCaptionsLayerCode(request.captions ?? [])
          if (devMode) {
            await onEvent?.({
              type: "debug-stage-update",
              generationId,
              trace: makeTrace(`layer-gen-${queuedLayer.id}`, `Layer: ${planLayer.type}`, {
                status: "complete",
                systemPrompt: null,
                userPrompt: layerBrief,
                rawOutput: code,
                modelId: null,
                startedAt: new Date(layerT0).toISOString(),
                completedAt: nowIso(),
                durationMs: Date.now() - layerT0,
              }),
            })
          }
        } else if (devMode) {
          const traceResult = await generateLayer(layerBrief, systemPrompt, selectedModel, { returnTrace: true })
          code = extractComponentCode(stripMarkdownFences(traceResult.code))
          const layerT1 = Date.now()
          await onEvent?.({
            type: "debug-stage-update",
            generationId,
            trace: makeTrace(`layer-gen-${queuedLayer.id}`, `Layer: ${planLayer.type}`, {
              status: "complete",
              systemPrompt: traceResult.systemPrompt,
              userPrompt: traceResult.userPrompt,
              rawOutput: traceResult.code,
              modelId: traceResult.modelId,
              startedAt: new Date(layerT0).toISOString(),
              completedAt: nowIso(),
              durationMs: layerT1 - layerT0,
              tokenUsage: traceResult.usage,
              finishReason: traceResult.finishReason,
            }),
          })
        } else {
          const rawCode = await generateLayer(layerBrief, systemPrompt, selectedModel)
          code = extractComponentCode(stripMarkdownFences(rawCode))
        }

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

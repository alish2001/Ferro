import { extractComponentCode, stripMarkdownFences } from "@/helpers/sanitize-response"
import { buildCaptionsLayerCode } from "@/generation/captions-layer"
import { generateLayer } from "@/generation/generator"
import { planGraphics, type GraphicPlan } from "@/generation/planner"
import { buildSystemPrompt } from "@/generation/prompts"
import { detectSkills } from "@/generation/skills"
import {
  FerroDevRerunRequestSchema,
  type DevModeStageTrace,
  type FerroGenerateStreamEvent,
  type FerroLayer,
  type FerroLayerVersion,
} from "@/lib/ferro-contracts"
import { FAST_MODEL_ID, getModel } from "@/lib/models"
import { getCombinedSkillContent, type SkillName } from "@/skills"
import { createNdjsonResponse } from "@/lib/ndjson"

function nowIso() {
  return new Date().toISOString()
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

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = FerroDevRerunRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid rerun request" }, { status: 400 })
  }

  const { generationId, stageId, systemPromptOverride, userPromptOverride, cascade, previousContext } = parsed.data
  const { request } = previousContext

  return createNdjsonResponse<FerroGenerateStreamEvent>({
    execute: async (write) => {
      const fastModel = getModel(FAST_MODEL_ID)
      const selectedModel = getModel(request.model)

      let skills = (previousContext.skills ?? []) as SkillName[]
      let plan: GraphicPlan | null = previousContext.plan ?? null
      let systemPrompt = previousContext.systemPrompt ?? ""

      // ── Re-run skill detection ────────────────────────────────────
      if (stageId === "skill-detection") {
        const defaultPrompt = [request.taste, request.instructions, request.transcript.slice(0, 500)]
          .filter(Boolean)
          .join("\n")
        const prompt = userPromptOverride ?? defaultPrompt

        write({
          type: "debug-stage-update",
          generationId,
          trace: makeTrace("skill-detection", "Skill Detection", {
            status: "running",
            userPrompt: prompt,
            modelId: FAST_MODEL_ID,
            startedAt: nowIso(),
          }),
        })

        const t0 = Date.now()
        const result = await detectSkills(prompt, fastModel, { returnTrace: true })
        const t1 = Date.now()
        skills = result.skills as SkillName[]

        write({
          type: "debug-stage-update",
          generationId,
          trace: makeTrace("skill-detection", "Skill Detection", {
            status: "complete",
            systemPrompt: result.systemPrompt,
            userPrompt: result.userPrompt,
            rawOutput: result.rawOutput,
            modelId: result.modelId,
            startedAt: new Date(t0).toISOString(),
            completedAt: nowIso(),
            durationMs: t1 - t0,
            tokenUsage: result.usage,
            finishReason: result.finishReason,
          }),
        })

        write({ type: "skills-ready", generationId, skills })

        if (!cascade) return
      }

      // ── Re-run planning ───────────────────────────────────────────
      if (stageId === "skill-detection" || stageId === "planning") {
        const planBrief = {
          taste: request.taste,
          transcript: request.transcript,
          instructions: request.instructions,
          videoDurationSeconds: request.videoDurationSeconds,
          videoFps: request.videoFps,
          captions: request.captions,
          includeCaptionLayer: request.includeCaptionLayer,
        }

        write({
          type: "debug-stage-update",
          generationId,
          trace: makeTrace("planning", "Graphic Planning", {
            status: "running",
            modelId: FAST_MODEL_ID,
            startedAt: nowIso(),
          }),
        })

        const t0 = Date.now()
        const result = await planGraphics(planBrief, fastModel, { returnTrace: true })
        plan = result.plan
        const t1 = Date.now()

        write({
          type: "debug-stage-update",
          generationId,
          trace: makeTrace("planning", "Graphic Planning", {
            status: "complete",
            systemPrompt: result.systemPrompt,
            userPrompt: userPromptOverride && stageId === "planning" ? userPromptOverride : result.userPrompt,
            rawOutput: result.rawOutput,
            modelId: result.modelId,
            startedAt: new Date(t0).toISOString(),
            completedAt: nowIso(),
            durationMs: t1 - t0,
            tokenUsage: result.usage,
            finishReason: result.finishReason,
          }),
        })

        const canonicalFps = request.videoFps ?? plan.fps
        const layers: FerroLayer[] = plan.layers.map((l) => ({
          id: crypto.randomUUID(),
          code: "",
          brief: l.brief,
          type: l.type,
          title: l.brief.slice(0, 80),
          from: l.from,
          durationInFrames: l.durationInFrames,
          status: "queued" as const,
          error: null,
          currentVersionId: null,
        }))

        const durationInFrames = request.videoDurationSeconds
          ? Math.round(request.videoDurationSeconds * canonicalFps)
          : Math.max(...layers.map((l) => l.from + l.durationInFrames), canonicalFps * 30)

        write({
          type: "plan-ready",
          generationId,
          fps: canonicalFps,
          width: request.width,
          height: request.height,
          durationInFrames,
          layers,
        })

        // Rebuild system prompt with current skills
        const skillContent = getCombinedSkillContent(skills)
        systemPrompt = buildSystemPrompt(skillContent)

        write({
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

        if (!cascade) return

        // Generate all layers
        for (let i = 0; i < plan.layers.length; i++) {
          const planLayer = plan.layers[i]
          const layer = layers[i]
          const layerBrief = `Layer type: ${planLayer.type}\n\n${planLayer.brief}`

          write({
            type: "debug-stage-update",
            generationId,
            trace: makeTrace(`layer-gen-${layer.id}`, `Layer: ${planLayer.type}`, {
              status: "running",
              systemPrompt,
              userPrompt: layerBrief,
              modelId: planLayer.type === "captions" ? null : request.model,
              startedAt: nowIso(),
            }),
          })

          const layerT0 = Date.now()
          let code: string

          if (planLayer.type === "captions") {
            code = buildCaptionsLayerCode(request.captions ?? [])
          } else {
            const traceResult = await generateLayer(layerBrief, systemPrompt, selectedModel, { returnTrace: true })
            code = extractComponentCode(stripMarkdownFences(traceResult.code))
          }

          const layerT1 = Date.now()

          write({
            type: "debug-stage-update",
            generationId,
            trace: makeTrace(`layer-gen-${layer.id}`, `Layer: ${planLayer.type}`, {
              status: "complete",
              systemPrompt,
              userPrompt: layerBrief,
              rawOutput: code,
              modelId: request.model,
              startedAt: new Date(layerT0).toISOString(),
              completedAt: nowIso(),
              durationMs: layerT1 - layerT0,
            }),
          })

          const version: FerroLayerVersion = {
            id: crypto.randomUUID(),
            layerId: layer.id,
            source: "ai-edit",
            code,
            createdAt: nowIso(),
          }

          const completedLayer: FerroLayer = {
            ...layer,
            code,
            status: "ready",
            currentVersionId: version.id,
          }

          write({ type: "layer-completed", generationId, layer: completedLayer, version })
        }

        return
      }

      // ── Re-run a single layer ─────────────────────────────────────
      if (stageId.startsWith("layer-gen-")) {
        const layerId = stageId.replace("layer-gen-", "")
        const userPrompt = userPromptOverride ?? ""
        const sysPrompt = systemPromptOverride ?? systemPrompt

        if (!sysPrompt) {
          // Rebuild system prompt from skills
          const skillContent = getCombinedSkillContent(skills)
          systemPrompt = buildSystemPrompt(skillContent)
        }

        write({
          type: "debug-stage-update",
          generationId,
          trace: makeTrace(stageId, "Layer Re-run", {
            status: "running",
            systemPrompt: sysPrompt || systemPrompt,
            userPrompt,
            modelId: request.model,
            startedAt: nowIso(),
          }),
        })

        const t0 = Date.now()
        const traceResult = await generateLayer(userPrompt, sysPrompt || systemPrompt, selectedModel, { returnTrace: true })
        const code = extractComponentCode(stripMarkdownFences(traceResult.code))
        const t1 = Date.now()

        write({
          type: "debug-stage-update",
          generationId,
          trace: makeTrace(stageId, "Layer Re-run", {
            status: "complete",
            systemPrompt: traceResult.systemPrompt,
            userPrompt: traceResult.userPrompt,
            rawOutput: traceResult.code,
            modelId: traceResult.modelId,
            startedAt: new Date(t0).toISOString(),
            completedAt: nowIso(),
            durationMs: t1 - t0,
            tokenUsage: traceResult.usage,
            finishReason: traceResult.finishReason,
          }),
        })

        const version: FerroLayerVersion = {
          id: crypto.randomUUID(),
          layerId,
          source: "ai-edit",
          code,
          createdAt: nowIso(),
        }

        const completedLayer: FerroLayer = {
          id: layerId,
          code,
          brief: userPrompt,
          type: "unknown",
          title: userPrompt.slice(0, 80),
          from: 0,
          durationInFrames: 1,
          status: "ready",
          error: null,
          currentVersionId: version.id,
        }

        write({ type: "layer-completed", generationId, layer: completedLayer, version })
      }
    },
  })
}

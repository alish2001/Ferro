import { extractComponentCode, stripMarkdownFences } from "@/helpers/sanitize-response"
import { generateLayer } from "@/generation/generator"
import { planGraphics } from "@/generation/planner"
import { buildSystemPrompt } from "@/generation/prompts"
import { detectSkills } from "@/generation/skills"
import { FAST_MODEL_ID, getModel } from "@/lib/models"
import { getCombinedSkillContent } from "@/skills"

export interface FerroGenerateRequest {
  taste: string
  transcript: string
  instructions: string
  model: string
  width: number
  height: number
  videoDurationSeconds?: number
}

export interface FerroLayer {
  code: string
  type: string
  title: string
  from: number
  durationInFrames: number
}

export interface FerroGenerateResponse {
  layers: FerroLayer[]
  fps: number
  width: number
  height: number
  durationInFrames: number
  skills: string[]
}

export async function POST(req: Request): Promise<Response> {
  let body: FerroGenerateRequest

  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { taste = "", transcript = "", instructions = "", model, width, height, videoDurationSeconds } = body

  if (!model) {
    return Response.json({ error: "model is required" }, { status: 400 })
  }

  try {
    const fastModel = getModel(FAST_MODEL_ID)
    const selectedModel = getModel(model)

    // 1. Detect skills (cheap, fast)
    const skillPrompt = [taste, instructions, transcript.slice(0, 500)]
      .filter(Boolean)
      .join("\n")
    const skills = await detectSkills(skillPrompt, fastModel)

    // 2. Plan graphics (cheap, fast)
    const plan = await planGraphics(
      { taste, transcript, instructions, videoDurationSeconds },
      fastModel,
    )

    // 3. Build system prompt with skill content (cached across parallel calls)
    const skillContent = getCombinedSkillContent(skills)
    const systemPrompt = buildSystemPrompt(skillContent)

    // 4. Generate all layers in parallel
    const codes = await Promise.all(
      plan.layers.map((layer) =>
        generateLayer(
          `Layer type: ${layer.type}\n\n${layer.brief}`,
          systemPrompt,
          selectedModel,
        ),
      ),
    )

    // 5. Sanitize each code string
    const layers: FerroLayer[] = plan.layers.map((layer, i) => ({
      type: layer.type,
      title: layer.brief.slice(0, 80),
      from: layer.from,
      durationInFrames: layer.durationInFrames,
      code: extractComponentCode(stripMarkdownFences(codes[i])),
    }))

    // 6. Calculate total duration
    const totalDurationInFrames = videoDurationSeconds
      ? Math.round(videoDurationSeconds * plan.fps)
      : Math.max(...layers.map((l) => l.from + l.durationInFrames), plan.fps * 30)

    const response: FerroGenerateResponse = {
      layers,
      fps: plan.fps,
      width,
      height,
      durationInFrames: totalDurationInFrames,
      skills,
    }

    return Response.json(response)
  } catch (error) {
    console.error("Generation error:", error)
    const message = error instanceof Error ? error.message : "Generation failed"
    return Response.json({ error: message }, { status: 500 })
  }
}

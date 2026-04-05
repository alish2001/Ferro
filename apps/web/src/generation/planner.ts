import { generateText, Output } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"

import type { FerroCaption, DevModeTokenUsage } from "@/lib/ferro-contracts"

export const GraphicLayerTypeSchema = z.enum([
  "lower-third",
  "title-card",
  "stat-callout",
  "quote-overlay",
  "outro-card",
  "captions",
])

export type GraphicLayerType = z.infer<typeof GraphicLayerTypeSchema>

export const GraphicPlanSchema = z.object({
  fps: z.number().int().min(24).max(60).describe("Frames per second for the composition"),
  layers: z
    .array(
      z.object({
        type: GraphicLayerTypeSchema,
        brief: z
          .string()
          .describe(
            "Detailed description of this overlay graphic — what it shows, its visual style, and what it communicates",
          ),
        from: z.number().int().min(0).describe("Start frame (0-indexed)"),
        durationInFrames: z
          .number()
          .int()
          .min(30)
          .describe("Duration of this overlay in frames"),
      }),
    )
    .min(1)
    .max(4),
})

export type GraphicPlan = z.infer<typeof GraphicPlanSchema>

export const PLANNER_SYSTEM_PROMPT = `You are a motion graphics director for video productions.

Given a video brief (taste/style, timestamped transcript, and optional instructions), plan the overlay graphics: what they show and exactly when they appear.

Return 1–4 graphic layers. You choose the fps (default 30) and must compute all frame positions from that fps.

## FRAME NUMBERS

When word-level captions are provided, each word already has fromFrame and toFrame computed.
Use fromFrame directly as the "from" value for a layer — no math needed.
For duration, use a sensible number of frames (e.g. 2s = 2*fps frames).

## TIMING RULES — non-negotiable

1. Spread graphics across the video — do NOT put everything at the beginning
2. No two graphics may overlap in time (check: layerA.from + layerA.durationInFrames <= layerB.from)
3. Set "from" to the fromFrame of the word where the relevant topic begins
4. Leave a gap of at least fps frames (1 second) between consecutive graphics

## LAYER TYPES

- lower-third: Speaker name/role banner at bottom of frame. Duration: 2–4s. Place when they first speak.
- title-card: Big opening title or section header. Duration: 3–5s. Usually from: 0 or near the opening.
- stat-callout: Animated number or data point. Duration: 3–5s. Place exactly when the stat is spoken.
- quote-overlay: Key phrase pulled from the transcript. Duration: 3–6s. Place at the exact timestamp it's said.
- outro-card: Closing CTA or branding. Duration: 4–8s. Place in the final 3–5 seconds of the video.
- captions: TikTok-style animated subtitles synced to speech. ONLY include if INCLUDE_CAPTION_LAYER is true. Always from: 0, durationInFrames: full video length.

## BRIEF QUALITY

The brief you write for each layer is the only context the graphic generator sees.
- Include the EXACT words from the transcript that this graphic accompanies
- Mention the visual style, layout, and what text/numbers to display
- Example: "Lower-third for host Alex Chen appearing at 7.5s when he says 'welcome to the show'. Show name 'Alex Chen' and title 'Host'. White text on dark semi-transparent band at bottom."

## OTHER GUIDELINES

- If the transcript names a specific person, include a lower-third near where they first speak
- If instructions specify particular graphics, follow them exactly
- If no transcript timing is available, distribute graphics evenly across the video`

export interface PlanBrief {
  taste: string
  transcript: string
  instructions: string
  videoDurationSeconds?: number
  videoFps?: number
  captions?: FerroCaption[]
  includeCaptionLayer?: boolean
}

export interface PlanGraphicsTrace {
  plan: GraphicPlan
  systemPrompt: string
  userPrompt: string
  rawOutput: string
  usage: DevModeTokenUsage
  finishReason: string
  modelId: string
}

function extractUsage(usage: Record<string, unknown>): DevModeTokenUsage {
  const u = usage as {
    promptTokens?: number
    completionTokens?: number
    cachedInputTokens?: number
  }
  return {
    inputTokens: u.promptTokens ?? 0,
    outputTokens: u.completionTokens ?? 0,
    cacheReadTokens: u.cachedInputTokens ?? 0,
    cacheWriteTokens: 0,
  }
}

function buildPlannerPrompt(brief: PlanBrief): string {
  const fps = brief.videoFps ?? 30
  const videoDuration = brief.videoDurationSeconds
    ? `\nVideo duration: ${brief.videoDurationSeconds.toFixed(1)} seconds`
    : ""
  const fpsLine = `\nFPS: ${fps}`

  const transcriptSection =
    brief.captions && brief.captions.length > 0
      ? `WORD-LEVEL CAPTIONS (each word has fromFrame and toFrame already computed at ${fps}fps):\n${JSON.stringify(
          brief.captions.map((c) => ({
            text: c.text,
            fromFrame: Math.round((c.startMs / 1000) * fps),
            toFrame: Math.round((c.endMs / 1000) * fps),
          })),
        )}`
      : `TRANSCRIPT:\n${brief.transcript || "No transcript provided"}`

  const captionLayerLine = brief.includeCaptionLayer
    ? "\nINCLUDE_CAPTION_LAYER: true — Add one 'captions' layer starting at frame 0 spanning the full video."
    : ""

  return `TASTE/STYLE: ${brief.taste || "No style preference specified"}

${transcriptSection}

INSTRUCTIONS: ${brief.instructions || "No specific instructions — use taste and transcript to decide"}
${videoDuration}${fpsLine}${captionLayerLine}`
}

export async function planGraphics(
  brief: PlanBrief,
  model: LanguageModel,
): Promise<GraphicPlan>
export async function planGraphics(
  brief: PlanBrief,
  model: LanguageModel,
  opts: { returnTrace: true },
): Promise<PlanGraphicsTrace>
export async function planGraphics(
  brief: PlanBrief,
  model: LanguageModel,
  opts?: { returnTrace?: boolean },
): Promise<GraphicPlan | PlanGraphicsTrace> {
  const prompt = buildPlannerPrompt(brief)

  const result = await generateText({
    model,
    system: PLANNER_SYSTEM_PROMPT,
    prompt,
    output: Output.object({ schema: GraphicPlanSchema }),
  })

  const plan = result.output as GraphicPlan

  if (opts?.returnTrace) {
    return {
      plan,
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      userPrompt: prompt,
      rawOutput: JSON.stringify(plan),
      usage: extractUsage(result.usage as Record<string, unknown>),
      finishReason: result.finishReason ?? "unknown",
      modelId: result.response?.modelId ?? "unknown",
    }
  }

  return plan
}

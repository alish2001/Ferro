import { generateText, Output } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"

export const GraphicLayerTypeSchema = z.enum([
  "lower-third",
  "title-card",
  "stat-callout",
  "quote-overlay",
  "outro-card",
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

const PLANNER_SYSTEM_PROMPT = `You are a motion graphics director for video productions.

Given a video brief (taste/style, transcript, and optional instructions), decide what overlay
graphics to create, what they show, and when they appear in the video.

Return 1–4 graphic layers. Use the provided fps and video duration to calculate realistic frame numbers.

Layer types:
- lower-third: Speaker name + role, appears at bottom ~15% of frame when someone speaks
- title-card: Opening title or section header, usually within the first few seconds
- stat-callout: Animated number or data point appearing next to relevant spoken content
- quote-overlay: A key quote or phrase from the transcript, centered or positioned prominently
- outro-card: Closing CTA or branding card, appears in the final 3-5 seconds

Guidelines:
- If the transcript mentions a specific person, include a lower-third
- If there's a strong opening line, consider a title-card
- If instructions specify specific graphics, follow them exactly
- Typical overlay duration: lower-thirds 2-4s, title cards 3-5s, outros 4-8s
- fps is typically 30; multiply seconds by fps for frame numbers`

export interface PlanBrief {
  taste: string
  transcript: string
  instructions: string
  videoDurationSeconds?: number
}

export async function planGraphics(
  brief: PlanBrief,
  model: LanguageModel,
): Promise<GraphicPlan> {
  const videoDuration = brief.videoDurationSeconds
    ? `\nVideo duration: ${brief.videoDurationSeconds.toFixed(1)} seconds`
    : ""

  const prompt = `TASTE/STYLE: ${brief.taste || "No style preference specified"}

TRANSCRIPT:
${brief.transcript || "No transcript provided"}

INSTRUCTIONS: ${brief.instructions || "No specific instructions — use taste and transcript to decide"}
${videoDuration}`

  const result = await generateText({
    model,
    system: PLANNER_SYSTEM_PROMPT,
    prompt,
    output: Output.object({ schema: GraphicPlanSchema }),
  })

  return result.output as GraphicPlan
}

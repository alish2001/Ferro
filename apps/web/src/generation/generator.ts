import { generateText, Output } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"

const LayerCodeSchema = z.object({
  code: z
    .string()
    .describe(
      "Complete Remotion overlay component code, starting with import statements and ending with the exported component. No markdown fences.",
    ),
})

/**
 * Generate a single Remotion overlay component for a given layer brief.
 *
 * The system prompt (OVERLAY_SYSTEM_PROMPT + skill content) is identical across
 * all parallel calls, so it gets cached:
 * - Anthropic: explicit prompt caching via cacheControl
 * - OpenAI: automatic for prompts >1024 tokens
 */
export async function generateLayer(
  layerBrief: string,
  systemPrompt: string,
  model: LanguageModel,
): Promise<string> {
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: layerBrief,
    output: Output.object({ schema: LayerCodeSchema }),
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
    },
  })

  const parsed = result.output as z.infer<typeof LayerCodeSchema>
  return parsed.code
}

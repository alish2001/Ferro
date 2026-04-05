import { generateText, Output } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type { DevModeTokenUsage } from "@/lib/ferro-contracts"

const LayerCodeSchema = z.object({
  code: z
    .string()
    .describe(
      "Complete Remotion overlay component code, starting with import statements and ending with the exported component. No markdown fences.",
    ),
})

export interface GenerateLayerTrace {
  code: string
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
): Promise<string>
export async function generateLayer(
  layerBrief: string,
  systemPrompt: string,
  model: LanguageModel,
  opts: { returnTrace: true },
): Promise<GenerateLayerTrace>
export async function generateLayer(
  layerBrief: string,
  systemPrompt: string,
  model: LanguageModel,
  opts?: { returnTrace?: boolean },
): Promise<string | GenerateLayerTrace> {
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

  if (opts?.returnTrace) {
    return {
      code: parsed.code,
      systemPrompt,
      userPrompt: layerBrief,
      rawOutput: JSON.stringify(parsed),
      usage: extractUsage(result.usage as Record<string, unknown>),
      finishReason: result.finishReason ?? "unknown",
      modelId: result.response?.modelId ?? "unknown",
    }
  }

  return parsed.code
}

import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { defaultSettingsMiddleware, type LanguageModel, wrapLanguageModel } from "ai"

type OpenAIReasoningEffort = "minimal" | "low" | "medium" | "high"

export const MODELS = [
  { id: "openai:gpt-4o", label: "GPT-4o" },
  { id: "openai:gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai:gpt-5.4|minimal", label: "GPT-5.4 Minimal" },
  { id: "openai:gpt-5.4|low", label: "GPT-5.4 Low" },
  { id: "openai:gpt-5.4|medium", label: "GPT-5.4 Medium" },
  { id: "openai:gpt-5.4|high", label: "GPT-5.4 High" },
  { id: "openai:gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "openai:gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { id: "openai:o4-mini", label: "o4-mini" },
  { id: "anthropic:claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "anthropic:claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
] as const

export type ModelId = (typeof MODELS)[number]["id"]

/** Cheap fast model used for skill detection and graphic planning */
export const FAST_MODEL_ID: ModelId = "openai:gpt-4o-mini"

function isOpenAIReasoningEffort(value: string): value is OpenAIReasoningEffort {
  return value === "minimal" || value === "low" || value === "medium" || value === "high"
}

/**
 * Resolve a "provider:model-name" model ID to a LanguageModel instance.
 * Split on the first colon only so model names with colons work (e.g. anthropic:claude-...).
 */
export function getModel(modelId: string): LanguageModel {
  const colonIdx = modelId.indexOf(":")
  if (colonIdx === -1) throw new Error(`Invalid model ID (no provider prefix): ${modelId}`)

  const provider = modelId.slice(0, colonIdx)
  const name = modelId.slice(colonIdx + 1)

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set")

    const [baseName, reasoningEffort] = name.split("|", 2)

    if (reasoningEffort != null && !isOpenAIReasoningEffort(reasoningEffort)) {
      throw new Error(`Unsupported OpenAI reasoning effort: "${reasoningEffort}"`)
    }

    const model = createOpenAI({ apiKey })(baseName)

    if (!reasoningEffort) {
      return model
    }

    return wrapLanguageModel({
      model,
      middleware: defaultSettingsMiddleware({
        settings: {
          providerOptions: {
            openai: { reasoningEffort },
          },
        },
      }),
    })
  }

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set")
    return createAnthropic({ apiKey })(name)
  }

  throw new Error(`Unknown provider: "${provider}". Supported: openai, anthropic`)
}

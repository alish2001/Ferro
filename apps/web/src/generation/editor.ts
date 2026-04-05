import { generateText, Output, type ModelMessage } from "ai"
import { z } from "zod"
import { extractComponentCode, stripMarkdownFences } from "@/helpers/sanitize-response"
import type {
  FerroLayerEditRequest,
  FerroLayerVersion,
  FerroLayerMessage,
} from "@/lib/ferro-contracts"
import { getModel } from "@/lib/models"
import { SKILL_NAMES, getCombinedSkillContent, type SkillName } from "@/skills"
import { buildSystemPrompt } from "./prompts"

const LayerEditSchema = z.object({
  reply: z
    .string()
    .describe("Short assistant reply that explains what changed in the layer."),
  code: z
    .string()
    .describe(
      "Complete updated Remotion overlay component code, starting with import statements and ending with the exported component.",
    ),
})

/**
 * Build a CoreMessage[] from the layer's message history. The first user
 * message includes the full layer context (type, brief, current code) so
 * the model has all the information it needs. Subsequent turns are passed
 * as proper user/assistant messages, preserving turn structure for the
 * provider's conversation API.
 */
export function buildConversationMessages(
  layer: FerroLayerEditRequest["layer"],
  currentCode: string,
  messages: FerroLayerMessage[],
): ModelMessage[] {
  const layerContext = `You are revising a previously generated motion graphics overlay.

Keep the layer timing and placement fixed:
- type: ${layer.type}
- title: ${layer.title}
- brief: ${layer.brief}
- from frame: ${layer.from}
- durationInFrames: ${layer.durationInFrames}

Current code:
${currentCode}

Apply the latest user request while preserving the overlay's role in the composition.
Return a short assistant reply and the full updated code.`

  if (messages.length === 0) {
    return [{ role: "user", content: layerContext }]
  }

  const coreMessages: ModelMessage[] = []

  // First user message carries the layer context prepended to the
  // first user turn so the model always has full layer awareness.
  const firstMessage = messages[0]
  if (firstMessage.role === "user") {
    coreMessages.push({
      role: "user",
      content: `${layerContext}\n\nUser request: ${firstMessage.text}`,
    })
  } else {
    // Defensive: if the first message is somehow from the assistant,
    // inject the context as a standalone user turn.
    coreMessages.push({ role: "user", content: layerContext })
    coreMessages.push({ role: "assistant", content: firstMessage.text })
  }

  for (const message of messages.slice(1)) {
    coreMessages.push({
      role: message.role,
      content: message.text,
    })
  }

  return coreMessages
}

export async function editLayerWithHistory({
  layerId,
  model,
  skills,
  layer,
  currentCode,
  messages,
}: FerroLayerEditRequest): Promise<{
  reply: string
  code: string
  version: FerroLayerVersion
}> {
  const selectedModel = getModel(model)
  const normalizedSkills = skills.filter(
    (skill): skill is SkillName =>
      SKILL_NAMES.includes(skill as SkillName),
  )
  const systemPrompt = buildSystemPrompt(
    getCombinedSkillContent(normalizedSkills),
  )

  const conversationMessages = buildConversationMessages(
    layer,
    currentCode,
    messages,
  )

  const result = await generateText({
    model: selectedModel,
    system: `${systemPrompt}\n\nYou are editing an existing overlay component. Do not change timing assumptions or placement metadata outside the component code.`,
    messages: conversationMessages,
    output: Output.object({ schema: LayerEditSchema }),
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
    },
  })

  const parsed = result.output as z.infer<typeof LayerEditSchema>
  const code = extractComponentCode(stripMarkdownFences(parsed.code))

  return {
    reply: parsed.reply.trim(),
    code,
    version: {
      id: crypto.randomUUID(),
      layerId,
      source: "ai-edit",
      code,
      createdAt: new Date().toISOString(),
    },
  }
}

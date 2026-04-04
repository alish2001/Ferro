import { generateText, Output } from "ai"
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

function serializeMessages(messages: FerroLayerMessage[]) {
  return messages
    .map(
      (message) =>
        `${message.role === "user" ? "USER" : "ASSISTANT"}: ${message.text}`,
    )
    .join("\n\n")
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
  const conversationHistory = serializeMessages(messages)

  const prompt = `You are revising a previously generated motion graphics overlay.

Keep the layer timing and placement fixed:
- type: ${layer.type}
- title: ${layer.title}
- brief: ${layer.brief}
- from frame: ${layer.from}
- durationInFrames: ${layer.durationInFrames}

Current code:
${currentCode}

Conversation so far:
${conversationHistory || "No prior follow-up edits."}

Apply the latest user request while preserving the overlay's role in the composition.
Return a short assistant reply and the full updated code.`

  const result = await generateText({
    model: selectedModel,
    system: `${systemPrompt}\n\nYou are editing an existing overlay component. Do not change timing assumptions or placement metadata outside the component code.`,
    prompt,
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

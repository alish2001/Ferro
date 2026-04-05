import { generateText, Output } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"
import { SKILL_NAMES, SKILL_DETECTION_PROMPT, type SkillName } from "@/skills"
import type { DevModeTokenUsage } from "@/lib/ferro-contracts"

const SkillsSchema = z.object({
  skills: z.array(z.enum(SKILL_NAMES)),
})

export interface DetectSkillsTrace {
  skills: SkillName[]
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

export async function detectSkills(
  prompt: string,
  model: LanguageModel,
): Promise<SkillName[]>
export async function detectSkills(
  prompt: string,
  model: LanguageModel,
  opts: { returnTrace: true },
): Promise<DetectSkillsTrace>
export async function detectSkills(
  prompt: string,
  model: LanguageModel,
  opts?: { returnTrace?: boolean },
): Promise<SkillName[] | DetectSkillsTrace> {
  try {
    const result = await generateText({
      model,
      system: SKILL_DETECTION_PROMPT,
      prompt,
      output: Output.object({ schema: SkillsSchema }),
    })
    const parsed = result.output as z.infer<typeof SkillsSchema>

    if (opts?.returnTrace) {
      return {
        skills: parsed.skills,
        systemPrompt: SKILL_DETECTION_PROMPT,
        userPrompt: prompt,
        rawOutput: JSON.stringify(parsed),
        usage: extractUsage(result.usage as Record<string, unknown>),
        finishReason: result.finishReason ?? "unknown",
        modelId: result.response?.modelId ?? "unknown",
      }
    }

    return parsed.skills
  } catch (error) {
    console.error("Skill detection failed:", error)
    if (opts?.returnTrace) {
      return {
        skills: ["video-overlay"],
        systemPrompt: SKILL_DETECTION_PROMPT,
        userPrompt: prompt,
        rawOutput: JSON.stringify({ skills: ["video-overlay"], error: String(error) }),
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        finishReason: "error",
        modelId: "unknown",
      }
    }
    return ["video-overlay"]
  }
}

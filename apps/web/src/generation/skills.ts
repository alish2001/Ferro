import { generateText, Output } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"
import { SKILL_NAMES, SKILL_DETECTION_PROMPT, type SkillName } from "@/skills"

const SkillsSchema = z.object({
  skills: z.array(z.enum(SKILL_NAMES)),
})

export async function detectSkills(
  prompt: string,
  model: LanguageModel,
): Promise<SkillName[]> {
  try {
    const result = await generateText({
      model,
      system: SKILL_DETECTION_PROMPT,
      prompt,
      output: Output.object({ schema: SkillsSchema }),
    })
    const parsed = result.output
    return (parsed as z.infer<typeof SkillsSchema>).skills
  } catch (error) {
    console.error("Skill detection failed:", error)
    return ["video-overlay"]
  }
}

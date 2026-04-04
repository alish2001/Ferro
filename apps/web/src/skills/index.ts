import fs from "fs"
import path from "path"

// Skill names — guidance skills only for Phase 1
const GUIDANCE_SKILLS = [
  "typography",
  "spring-physics",
  "charts",
  "transitions",
  "sequencing",
  "video-overlay",
  "word-reveal",
] as const

export const SKILL_NAMES = [...GUIDANCE_SKILLS] as const
export type SkillName = (typeof SKILL_NAMES)[number]

// Read markdown files at request time (server-side only, called from API routes)
function readSkillFile(skillName: SkillName): string {
  const filePath = path.join(process.cwd(), "src", "skills", `${skillName}.md`)
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch {
    console.warn(`Could not read skill file: ${filePath}`)
    return ""
  }
}

export function getSkillContent(skillName: SkillName): string {
  return readSkillFile(skillName)
}

export function getCombinedSkillContent(skills: SkillName[]): string {
  if (skills.length === 0) return ""
  return skills
    .map((s) => getSkillContent(s))
    .filter((c) => c.length > 0)
    .join("\n\n---\n\n")
}

export const SKILL_DETECTION_PROMPT = `Classify this video motion graphics overlay brief into ALL applicable categories.
A brief can match multiple categories. Only include categories that are clearly relevant.

Guidance categories:
- typography: animated text, lower thirds with names/roles, title cards, kinetic text, typewriter effects, quote overlays
- spring-physics: bouncy entrances, organic motion, elastic effects, animated reveals
- charts: data callouts, stat overlays, animated numbers, progress bars, graphs over video
- transitions: fade-in/fade-out overlays, wipe effects, animated reveals between states
- sequencing: multiple elements appearing at different times, staggered entrances, choreographed overlays
- video-overlay: ANY overlay graphic that renders over a video (lower thirds, title cards, supers, outros, callouts)
- word-reveal: word-by-word text reveal, sequential word animation, staggered text entrance, kinetic word reveal, words appearing one at a time

Return an array of matching category names. Always include "video-overlay" for any overlay graphic.
Return an empty array if none apply.`

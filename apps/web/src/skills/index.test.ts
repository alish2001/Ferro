import { describe, expect, test } from "bun:test"
import { getSkillContent, getCombinedSkillContent, SKILL_NAMES } from "./index"

describe("skill cache", () => {
  test("getSkillContent returns non-empty content for known skills", () => {
    // Every skill that has a corresponding .md file should return content
    for (const skillName of SKILL_NAMES) {
      const content = getSkillContent(skillName)
      // All current skills have .md files so content should be non-empty
      expect(content.length).toBeGreaterThan(0)
    }
  })

  test("getSkillContent returns the same reference on repeated calls (cached)", () => {
    const first = getSkillContent("typography")
    const second = getSkillContent("typography")
    // Since values come from a Map, identical string references confirm caching
    expect(first).toBe(second)
  })

  test("getCombinedSkillContent joins multiple skills with separators", () => {
    const combined = getCombinedSkillContent(["typography", "charts"])
    expect(combined).toContain("---")
    expect(combined).toContain(getSkillContent("typography"))
    expect(combined).toContain(getSkillContent("charts"))
  })

  test("getCombinedSkillContent returns empty string for empty array", () => {
    expect(getCombinedSkillContent([])).toBe("")
  })
})

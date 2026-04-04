export interface ValidationResult {
  isValid: boolean
  error: string | null
}

/**
 * Strip markdown code fences from a string.
 * Handles ```tsx, ```ts, ```jsx, ```js and plain ``` fences.
 */
export function stripMarkdownFences(code: string): string {
  let result = code
  result = result.replace(/^```(?:tsx?|jsx?)?\n?/, "")
  result = result.replace(/\n?```\s*$/, "")
  return result.trim()
}

/**
 * Lightweight validation to check if the response contains JSX content.
 */
export function validateGptResponse(response: string): ValidationResult {
  const trimmed = response.trim()

  const hasJsx = /<[A-Z][a-zA-Z]*|<[a-z]+[^>]*>/.test(trimmed)
  if (!hasJsx) {
    return {
      isValid: false,
      error: "The response was not a valid motion graphics component. Please try a different prompt.",
    }
  }

  return { isValid: true, error: null }
}

/**
 * Extract only the component code, removing any trailing text/commentary.
 * Uses brace counting to find the end of the component.
 */
export function extractComponentCode(code: string): string {
  const exportMatch = code.match(
    /export\s+const\s+\w+\s*=\s*\(\s*\)\s*=>\s*\{/,
  )

  if (exportMatch && exportMatch.index !== undefined) {
    const declarationStart = exportMatch.index
    const bodyStart = declarationStart + exportMatch[0].length

    let braceCount = 1
    let endIndex = bodyStart

    for (let i = bodyStart; i < code.length; i++) {
      const char = code[i]
      if (char === "{") {
        braceCount++
      } else if (char === "}") {
        braceCount--
        if (braceCount === 0) {
          endIndex = i
          break
        }
      }
    }

    if (braceCount === 0) {
      let result = code.slice(0, endIndex + 1)
      if (!result.trim().endsWith(";")) {
        result = result.trimEnd() + ";"
      }
      return result.trim()
    }
  }

  return code
}

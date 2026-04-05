import { describe, expect, test } from "bun:test"
import { buildConversationMessages } from "./editor"
import type { FerroLayer, FerroLayerMessage } from "@/lib/ferro-contracts"

const baseLayer: FerroLayer = {
  id: "layer-1",
  code: "export const Overlay = () => { return null; };",
  brief: "A simple lower third",
  type: "lower-third",
  title: "Speaker Name",
  from: 0,
  durationInFrames: 90,
  status: "ready",
  error: null,
  currentVersionId: "v1",
}

const currentCode = 'export const Overlay = () => { return <div>hello</div>; };'

function makeMessage(
  role: "user" | "assistant",
  text: string,
  index: number,
): FerroLayerMessage {
  return {
    id: `msg-${index}`,
    layerId: "layer-1",
    role,
    text,
    createdAt: new Date().toISOString(),
    status: "complete",
  }
}

describe("buildConversationMessages", () => {
  test("returns a single user message with layer context when history is empty", () => {
    const result = buildConversationMessages(baseLayer, currentCode, [])

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe("user")
    expect(result[0].content).toContain("lower-third")
    expect(result[0].content).toContain(currentCode)
  })

  test("prepends layer context to the first user message", () => {
    const messages = [makeMessage("user", "Make the font bigger", 0)]

    const result = buildConversationMessages(baseLayer, currentCode, messages)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe("user")
    expect(result[0].content).toContain("lower-third")
    expect(result[0].content).toContain("Make the font bigger")
  })

  test("preserves multi-turn conversation as separate CoreMessages", () => {
    const messages = [
      makeMessage("user", "Make the font bigger", 0),
      makeMessage("assistant", "I increased the font size to 64px.", 1),
      makeMessage("user", "Now change the color to red", 2),
    ]

    const result = buildConversationMessages(baseLayer, currentCode, messages)

    expect(result).toHaveLength(3)
    expect(result[0].role).toBe("user")
    expect(result[1].role).toBe("assistant")
    expect(result[1].content).toBe("I increased the font size to 64px.")
    expect(result[2].role).toBe("user")
    expect(result[2].content).toBe("Now change the color to red")
  })

  test("handles edge case where first message is from assistant", () => {
    const messages = [
      makeMessage("assistant", "Here is the initial version.", 0),
      makeMessage("user", "Change the background", 1),
    ]

    const result = buildConversationMessages(baseLayer, currentCode, messages)

    // Should inject a context-only user turn before the assistant message
    expect(result).toHaveLength(3)
    expect(result[0].role).toBe("user")
    expect(result[0].content).toContain("lower-third")
    expect(result[1].role).toBe("assistant")
    expect(result[2].role).toBe("user")
  })

  test("includes layer metadata in the context", () => {
    const result = buildConversationMessages(baseLayer, currentCode, [])

    const content = result[0].content as string
    expect(content).toContain("type: lower-third")
    expect(content).toContain("title: Speaker Name")
    expect(content).toContain("brief: A simple lower third")
    expect(content).toContain("from frame: 0")
    expect(content).toContain("durationInFrames: 90")
  })
})

import { describe, expect, it } from "bun:test"

import { createNdjsonResponse, readNdjsonStream } from "@/lib/ndjson"

describe("ndjson helpers", () => {
  it("creates a newline-delimited response body", async () => {
    const response = createNdjsonResponse({
      execute: async (write) => {
        write({ type: "first", value: 1 })
        write({ type: "second", value: 2 })
      },
    })

    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson")

    const text = await response.text()

    expect(text.trim().split("\n")).toEqual([
      JSON.stringify({ type: "first", value: 1 }),
      JSON.stringify({ type: "second", value: 2 }),
    ])
  })

  it("reads chunked NDJSON streams even when lines split across chunks", async () => {
    const encoder = new TextEncoder()
    const chunks = [
      `${JSON.stringify({ type: "alpha", value: 1 })}\n${JSON.stringify({ type: "beta" })}`.slice(
        0,
        20,
      ),
      `${JSON.stringify({ type: "alpha", value: 1 })}\n${JSON.stringify({ type: "beta" })}`.slice(
        20,
      ) + "\n",
      JSON.stringify({ type: "gamma", done: true }),
    ]

    const response = new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      }),
    )

    const events: Array<Record<string, unknown>> = []

    await readNdjsonStream<Record<string, unknown>>(response, async (event) => {
      events.push(event)
    })

    expect(events).toEqual([
      { type: "alpha", value: 1 },
      { type: "beta" },
      { type: "gamma", done: true },
    ])
  })
})

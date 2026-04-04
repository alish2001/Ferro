interface CreateNdjsonResponseOptions<TEvent> {
  execute: (write: (event: TEvent) => void) => Promise<void>
}

export function createNdjsonResponse<TEvent>({
  execute,
}: CreateNdjsonResponseOptions<TEvent>) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: TEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        await execute(write)
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function readNdjsonStream<TEvent>(
  response: Response,
  onEvent: (event: TEvent) => void | Promise<void>,
) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("The response did not include a readable stream.")
  }

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const newlineIndex = buffer.indexOf("\n")
      if (newlineIndex === -1) break

      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)

      if (!line) continue
      await onEvent(JSON.parse(line) as TEvent)
    }
  }

  const trailingLine = buffer.trim()
  if (trailingLine) {
    await onEvent(JSON.parse(trailingLine) as TEvent)
  }
}

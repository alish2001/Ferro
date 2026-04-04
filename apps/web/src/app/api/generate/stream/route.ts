import { runGenerationPipeline } from "@/generation/pipeline"
import {
  FerroGenerateRequestSchema,
  type FerroGenerateStreamEvent,
} from "@/lib/ferro-contracts"
import { createNdjsonResponse } from "@/lib/ndjson"

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = FerroGenerateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid generate request" }, { status: 400 })
  }

  return createNdjsonResponse<FerroGenerateStreamEvent>({
    execute: async (write) => {
      await runGenerationPipeline({
        request: parsed.data,
        onEvent: async (event) => {
          write(event)
        },
      })
    },
  })
}

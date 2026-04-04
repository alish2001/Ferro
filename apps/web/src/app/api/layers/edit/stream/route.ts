import { editLayerWithHistory } from "@/generation/editor"
import {
  FerroLayerEditRequestSchema,
  type FerroLayerEditStreamEvent,
} from "@/lib/ferro-contracts"
import { createNdjsonResponse } from "@/lib/ndjson"

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = FerroLayerEditRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid layer edit request" }, { status: 400 })
  }

  return createNdjsonResponse<FerroLayerEditStreamEvent>({
    execute: async (write) => {
      const request = parsed.data

      write({
        type: "edit-started",
        generationId: request.generationId,
        layerId: request.layerId,
      })

      try {
        const result = await editLayerWithHistory(request)
        write({
          type: "edit-completed",
          generationId: request.generationId,
          layerId: request.layerId,
          reply: result.reply,
          version: result.version,
          code: result.code,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Layer edit failed"

        write({
          type: "edit-failed",
          generationId: request.generationId,
          layerId: request.layerId,
          error: message,
        })
      }
    },
  })
}

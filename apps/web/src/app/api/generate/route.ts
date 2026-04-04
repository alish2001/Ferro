import {
  FerroGenerateRequestSchema,
  type FerroGenerateResponse,
} from "@/lib/ferro-contracts"
import { runGenerationPipeline } from "@/generation/pipeline"

export async function POST(req: Request): Promise<Response> {
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

  try {
    const result = await runGenerationPipeline({
      request: parsed.data,
    })

    if (!result.success || !result.response) {
      return Response.json(
        { error: result.session.error ?? "Generation failed" },
        { status: 500 },
      )
    }

    const response: FerroGenerateResponse = result.response
    return Response.json(response)
  } catch (error) {
    console.error("Generation error:", error)
    const message = error instanceof Error ? error.message : "Generation failed"
    return Response.json({ error: message }, { status: 500 })
  }
}

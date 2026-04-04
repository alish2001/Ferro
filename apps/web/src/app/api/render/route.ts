import { FerroRenderPayloadSchema } from "@/lib/ferro-contracts"
import { enqueueRenderJob } from "@/render/orchestrator"
import { assertRenderBundleExists } from "@/render/paths"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  let formData: FormData

  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  const payloadValue = formData.get("payload")
  const videoValue = formData.get("video")

  if (typeof payloadValue !== "string") {
    return Response.json({ error: "payload is required" }, { status: 400 })
  }

  let payloadJson: unknown

  try {
    payloadJson = JSON.parse(payloadValue)
  } catch {
    return Response.json({ error: "payload must be valid JSON" }, { status: 400 })
  }

  const parsedPayload = FerroRenderPayloadSchema.safeParse(payloadJson)

  if (!parsedPayload.success) {
    return Response.json(
      { error: "Invalid render payload", issues: parsedPayload.error.flatten() },
      { status: 400 },
    )
  }

  try {
    assertRenderBundleExists()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Render bundle is unavailable"
    return Response.json({ error: message }, { status: 503 })
  }

  // Dev-local enqueue point. Later this should publish to a durable queue
  // instead of pushing work into the current process.
  const job = await enqueueRenderJob({
    origin: new URL(req.url).origin,
    payload: parsedPayload.data,
    video: videoValue instanceof File ? videoValue : null,
  })

  return Response.json(job, { status: 202 })
}

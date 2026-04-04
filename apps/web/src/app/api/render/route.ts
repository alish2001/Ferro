import { enqueueRenderJob } from "@/render/orchestrator"
import { assertRenderBundleExists } from "@/render/paths"
import { parseRenderFormData, RenderRequestError } from "@/render/request"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  let formData: FormData

  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  let parsedRequest

  try {
    parsedRequest = parseRenderFormData(formData)
  } catch (error) {
    if (error instanceof RenderRequestError) {
      return Response.json(error.body, { status: error.status })
    }

    throw error
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
    payload: parsedRequest.payload,
    video: parsedRequest.video,
  })

  return Response.json(job, { status: 202 })
}

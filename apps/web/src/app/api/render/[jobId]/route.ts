import { getRenderJobResponse } from "@/render/orchestrator"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params
  const job = getRenderJobResponse(jobId)

  if (!job) {
    return Response.json({ error: "Render job not found" }, { status: 404 })
  }

  return Response.json(job, {
    headers: { "Cache-Control": "no-store" },
  })
}

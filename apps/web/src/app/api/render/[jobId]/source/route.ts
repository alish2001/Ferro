import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"
import { getStoredRenderJob } from "@/render/orchestrator"
import { fileExists } from "@/render/artifact-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params
  const job = getStoredRenderJob(jobId)

  if (!job || !job.inputVideoPath) {
    return Response.json({ error: "Source video not found" }, { status: 404 })
  }

  const hasSource = await fileExists(job.inputVideoPath)
  if (!hasSource) {
    return Response.json(
      { error: "Source video file is unavailable" },
      { status: 410 },
    )
  }

  const fileStats = await stat(job.inputVideoPath)
  const stream = Readable.toWeb(createReadStream(job.inputVideoPath))

  return new Response(stream as ReadableStream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(fileStats.size),
      "Content-Type": job.inputVideoType ?? "application/octet-stream",
    },
  })
}

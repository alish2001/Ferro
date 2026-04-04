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

  if (!job) {
    return Response.json({ error: "Render job not found" }, { status: 404 })
  }

  if (job.status !== "complete") {
    return Response.json(
      { error: "Render is not ready to download" },
      { status: 409 },
    )
  }

  const hasOutput = await fileExists(job.outputPath)
  if (!hasOutput) {
    return Response.json(
      { error: "Rendered MP4 file is unavailable. Re-run the export." },
      { status: 410 },
    )
  }

  const fileStats = await stat(job.outputPath)
  const stream = Readable.toWeb(createReadStream(job.outputPath))

  return new Response(stream as ReadableStream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(fileStats.size),
      "Content-Disposition": `attachment; filename="ferro-render-${jobId}.mp4"`,
      "Content-Type": "video/mp4",
    },
  })
}

import type {
  FerroRenderJobAcceptedResponse,
  FerroRenderJobResponse,
  FerroRenderPayload,
} from "@/lib/ferro-contracts"
import { getRenderOutputPath, removeFile, saveUploadedVideo } from "@/render/artifact-store"
import {
  createRenderJob,
  finishActiveRenderJob,
  getRenderJob,
  markRenderJobComplete,
  markRenderJobError,
  serializeRenderJob,
  startNextRenderJob,
  updateRenderJobProgress,
} from "@/render/job-store"
import { runServerRenderJob } from "@/render/render-runner"

let queuePump: Promise<void> | null = null

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Render failed"
}

async function pumpQueue() {
  if (queuePump) return queuePump

  queuePump = (async () => {
    while (true) {
      const job = startNextRenderJob()
      if (!job) break

      try {
        await runServerRenderJob(job, (progress) => {
          updateRenderJobProgress(job.id, progress)
        })
        markRenderJobComplete(job.id)
        await removeFile(job.inputVideoPath)
      } catch (error) {
        markRenderJobError(job.id, getErrorMessage(error))
        await removeFile(job.inputVideoPath)
      } finally {
        finishActiveRenderJob()
      }
    }
  })()

  try {
    await queuePump
  } finally {
    queuePump = null
  }
}

export async function enqueueRenderJob({
  origin,
  payload,
  video,
}: {
  origin: string
  payload: FerroRenderPayload
  video: File | null
}): Promise<FerroRenderJobAcceptedResponse> {
  const jobId = crypto.randomUUID()
  const storedVideo = await saveUploadedVideo(jobId, video)
  const outputPath = await getRenderOutputPath(jobId)

  const job = createRenderJob({
    id: jobId,
    origin,
    payload,
    inputVideoPath: storedVideo?.path ?? null,
    inputVideoType: storedVideo?.type ?? null,
    outputPath,
  })

  void pumpQueue()

  return {
    jobId: job.id,
    status: job.status,
  }
}

export function getRenderJobResponse(jobId: string): FerroRenderJobResponse | null {
  const job = getRenderJob(jobId)
  if (!job) return null
  return serializeRenderJob(job)
}

export function getStoredRenderJob(jobId: string) {
  return getRenderJob(jobId)
}

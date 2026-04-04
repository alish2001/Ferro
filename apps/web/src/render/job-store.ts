import type {
  FerroRenderJobProgress,
  FerroRenderJobResponse,
  FerroRenderJobStatus,
  FerroRenderPayload,
} from "@/lib/ferro-contracts"

export interface StoredRenderJob {
  id: string
  origin: string
  payload: FerroRenderPayload
  status: FerroRenderJobStatus
  progress: FerroRenderJobProgress | null
  error: string | null
  inputVideoPath: string | null
  inputVideoType: string | null
  outputPath: string
  createdAt: string
  updatedAt: string
}

interface LocalRenderState {
  activeJobId: string | null
  jobs: Map<string, StoredRenderJob>
  queue: string[]
}

declare global {
  var __ferroRenderState: LocalRenderState | undefined
}

// Dev-only queue adapter. Later this should be replaced by a durable queue +
// database-backed store while preserving this module's external behavior.
function getState(): LocalRenderState {
  if (!globalThis.__ferroRenderState) {
    globalThis.__ferroRenderState = {
      activeJobId: null,
      jobs: new Map(),
      queue: [],
    }
  }

  return globalThis.__ferroRenderState
}

function touch(job: StoredRenderJob) {
  job.updatedAt = new Date().toISOString()
}

export function createRenderJob(
  job: Omit<StoredRenderJob, "createdAt" | "error" | "progress" | "status" | "updatedAt">,
) {
  const state = getState()
  const storedJob: StoredRenderJob = {
    ...job,
    status: "queued",
    progress: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  state.jobs.set(storedJob.id, storedJob)
  state.queue.push(storedJob.id)

  return storedJob
}

export function getRenderJob(jobId: string) {
  return getState().jobs.get(jobId) ?? null
}

export function startNextRenderJob() {
  const state = getState()

  if (state.activeJobId) return null

  const nextId = state.queue.shift()
  if (!nextId) return null

  const job = state.jobs.get(nextId)
  if (!job) return null

  state.activeJobId = nextId
  job.status = "rendering"
  touch(job)
  return job
}

export function finishActiveRenderJob() {
  getState().activeJobId = null
}

export function updateRenderJobProgress(
  jobId: string,
  progress: FerroRenderJobProgress,
) {
  const job = getRenderJob(jobId)
  if (!job) return

  job.progress = progress
  touch(job)
}

export function markRenderJobComplete(jobId: string) {
  const job = getRenderJob(jobId)
  if (!job) return

  job.status = "complete"
  touch(job)
}

export function markRenderJobError(jobId: string, error: string) {
  const job = getRenderJob(jobId)
  if (!job) return

  job.status = "error"
  job.error = error
  touch(job)
}

export function serializeRenderJob(job: StoredRenderJob): FerroRenderJobResponse {
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    downloadUrl:
      job.status === "complete" ? `/api/render/${job.id}/download` : null,
  }
}

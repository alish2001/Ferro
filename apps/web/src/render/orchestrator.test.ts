import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import test, { afterEach, beforeEach } from "node:test"
import { getRenderOutputPath, removeJobDirectory } from "./artifact-store"
import { createRenderJob, markRenderJobComplete } from "./job-store"
import { getRenderJobResponse } from "./orchestrator"

type GlobalWithRenderState = typeof globalThis & {
  __ferroRenderState?: unknown
}

const createdJobIds = new Set<string>()

function resetRenderState() {
  delete (globalThis as GlobalWithRenderState).__ferroRenderState
}

async function createCompleteJob({ withOutput }: { withOutput: boolean }) {
  const jobId = `orchestrator-${Date.now()}-${Math.random().toString(36).slice(2)}`
  createdJobIds.add(jobId)

  const outputPath = await getRenderOutputPath(jobId)

  createRenderJob({
    id: jobId,
    origin: "http://localhost:3000",
    payload: {
      layers: [],
      fps: 30,
      width: 1280,
      height: 720,
      durationInFrames: 120,
    },
    inputVideoPath: null,
    inputVideoType: null,
    outputPath,
  })

  if (withOutput) {
    await writeFile(outputPath, "rendered-video")
  }

  markRenderJobComplete(jobId)
  return jobId
}

beforeEach(() => {
  resetRenderState()
})

afterEach(async () => {
  resetRenderState()
  await Promise.all(
    Array.from(createdJobIds, (jobId) => removeJobDirectory(jobId)),
  )
  createdJobIds.clear()
})

test("getRenderJobResponse exposes the download URL for completed jobs with an output file", async () => {
  const jobId = await createCompleteJob({ withOutput: true })

  const response = await getRenderJobResponse(jobId)

  assert.ok(response)
  assert.equal(response.status, "complete")
  assert.equal(response.downloadUrl, `/api/render/${jobId}/download`)
  assert.equal(response.error, null)
})

test("getRenderJobResponse reports a missing MP4 instead of exposing a broken download URL", async () => {
  const jobId = await createCompleteJob({ withOutput: false })

  const response = await getRenderJobResponse(jobId)

  assert.ok(response)
  assert.equal(response.status, "complete")
  assert.equal(response.downloadUrl, null)
  assert.equal(
    response.error,
    "Rendered MP4 file is unavailable. Re-run the export.",
  )
})

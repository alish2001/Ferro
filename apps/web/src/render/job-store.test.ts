import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"
import {
  createRenderJob,
  finishActiveRenderJob,
  getRenderJob,
  markRenderJobComplete,
  markRenderJobError,
  serializeRenderJob,
  startNextRenderJob,
  updateRenderJobProgress,
} from "./job-store"

const samplePayload = {
  layers: [],
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 120,
}

type GlobalWithRenderState = typeof globalThis & {
  __ferroRenderState?: unknown
}

function resetRenderState() {
  delete (globalThis as GlobalWithRenderState).__ferroRenderState
}

beforeEach(() => {
  resetRenderState()
})

afterEach(() => {
  resetRenderState()
})

test("job-store processes jobs in FIFO order and serializes downloads after completion", () => {
  createRenderJob({
    id: "job-1",
    origin: "http://localhost:3000",
    payload: samplePayload,
    inputVideoPath: null,
    inputVideoType: null,
    outputPath: "/tmp/job-1.mp4",
  })

  createRenderJob({
    id: "job-2",
    origin: "http://localhost:3000",
    payload: samplePayload,
    inputVideoPath: null,
    inputVideoType: null,
    outputPath: "/tmp/job-2.mp4",
  })

  const firstJob = startNextRenderJob()
  assert.equal(firstJob?.id, "job-1")
  assert.equal(getRenderJob("job-1")?.status, "rendering")
  assert.equal(startNextRenderJob(), null)

  markRenderJobComplete("job-1")
  finishActiveRenderJob()

  const secondJob = startNextRenderJob()
  assert.equal(secondJob?.id, "job-2")

  const serializedFirstJob = serializeRenderJob(getRenderJob("job-1")!)
  assert.equal(serializedFirstJob.downloadUrl, "/api/render/job-1/download")
})

test("job-store stores progress updates and render errors", () => {
  createRenderJob({
    id: "job-error",
    origin: "http://localhost:3000",
    payload: samplePayload,
    inputVideoPath: null,
    inputVideoType: null,
    outputPath: "/tmp/job-error.mp4",
  })

  const job = startNextRenderJob()
  assert.equal(job?.id, "job-error")

  updateRenderJobProgress("job-error", {
    progress: 0.5,
    renderedFrames: 15,
    encodedFrames: 10,
    renderEstimatedTime: 1000,
    renderedDoneIn: 400,
    encodedDoneIn: null,
    stitchStage: "encoding",
  })

  assert.deepEqual(getRenderJob("job-error")?.progress, {
    progress: 0.5,
    renderedFrames: 15,
    encodedFrames: 10,
    renderEstimatedTime: 1000,
    renderedDoneIn: 400,
    encodedDoneIn: null,
    stitchStage: "encoding",
  })

  markRenderJobError("job-error", "boom")

  const failedJob = getRenderJob("job-error")
  assert.equal(failedJob?.status, "error")
  assert.equal(failedJob?.error, "boom")
  assert.equal(serializeRenderJob(failedJob!).downloadUrl, null)
})

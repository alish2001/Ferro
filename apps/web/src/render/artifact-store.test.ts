import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { basename, extname } from "node:path"
import test, { afterEach } from "node:test"
import {
  fileExists,
  getRenderOutputPath,
  removeFile,
  removeJobDirectory,
  saveUploadedVideo,
} from "./artifact-store"

const createdJobIds = new Set<string>()

afterEach(async () => {
  await Promise.all(Array.from(createdJobIds, (jobId) => removeJobDirectory(jobId)))
  createdJobIds.clear()
})

function createJobId() {
  const jobId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  createdJobIds.add(jobId)
  return jobId
}

test("saveUploadedVideo persists uploaded files with the expected extension", async () => {
  const jobId = createJobId()
  const file = new File(["video-bytes"], "clip", {
    type: "video/quicktime",
  })

  const saved = await saveUploadedVideo(jobId, file)

  assert.ok(saved)
  assert.equal(saved.type, "video/quicktime")
  assert.equal(extname(saved.path), ".mov")
  assert.equal(await fileExists(saved.path), true)
})

test("getRenderOutputPath creates a render location that removeFile can clean up", async () => {
  const jobId = createJobId()
  const outputPath = await getRenderOutputPath(jobId)

  await writeFile(outputPath, "rendered-video")

  assert.equal(basename(outputPath), "render.mp4")
  assert.equal(await fileExists(outputPath), true)

  await removeFile(outputPath)

  assert.equal(await fileExists(outputPath), false)
})

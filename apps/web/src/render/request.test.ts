import assert from "node:assert/strict"
import test from "node:test"
import { RenderRequestError, parseRenderFormData } from "./request"

const validPayload = {
  layers: [
    {
      code: "export const Component = () => null;",
      type: "title-card",
      title: "Intro",
      from: 0,
      durationInFrames: 30,
    },
  ],
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 90,
}

test("parseRenderFormData returns the payload and uploaded video", () => {
  const formData = new FormData()
  const video = new File(["video-bytes"], "clip.mov", {
    type: "video/quicktime",
  })

  formData.set("payload", JSON.stringify(validPayload))
  formData.set("video", video)

  const parsed = parseRenderFormData(formData)

  assert.deepEqual(parsed.payload, validPayload)
  assert.ok(parsed.video instanceof File)
  assert.equal(parsed.video.name, video.name)
  assert.equal(parsed.video.type, video.type)
})

test("parseRenderFormData ignores non-file video values", () => {
  const formData = new FormData()

  formData.set("payload", JSON.stringify(validPayload))
  formData.set("video", "not-a-file")

  const parsed = parseRenderFormData(formData)

  assert.equal(parsed.video, null)
})

test("parseRenderFormData rejects missing payload", () => {
  const formData = new FormData()

  assert.throws(
    () => parseRenderFormData(formData),
    (error: unknown) => {
      assert.ok(error instanceof RenderRequestError)
      assert.equal(error.status, 400)
      assert.deepEqual(error.body, { error: "payload is required" })
      return true
    },
  )
})

test("parseRenderFormData rejects invalid JSON", () => {
  const formData = new FormData()

  formData.set("payload", "{not-json}")

  assert.throws(
    () => parseRenderFormData(formData),
    (error: unknown) => {
      assert.ok(error instanceof RenderRequestError)
      assert.equal(error.status, 400)
      assert.deepEqual(error.body, { error: "payload must be valid JSON" })
      return true
    },
  )
})

test("parseRenderFormData returns schema issues for invalid payloads", () => {
  const formData = new FormData()

  formData.set(
    "payload",
    JSON.stringify({
      layers: [],
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 0,
    }),
  )

  assert.throws(
    () => parseRenderFormData(formData),
    (error: unknown) => {
      assert.ok(error instanceof RenderRequestError)
      assert.equal(error.status, 400)
      assert.equal(error.body.error, "Invalid render payload")
      assert.ok(error.body.issues)
      return true
    },
  )
})

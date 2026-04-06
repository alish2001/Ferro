import { afterEach, describe, expect, it, mock } from "bun:test"
import { act, renderHook, waitFor } from "@testing-library/react"

import { useVideo } from "@/hooks/use-video"
import type { JobState } from "@/components/upload/generation-status"
import type { UpdateSessionFn } from "@/hooks/use-generation-session"
import type { Caption } from "@remotion/captions"

import "@/test/setup-dom"
import {
  makeCaptions,
  makeNdjsonResponse,
  makeRestoreSession,
  stubUrlApis,
} from "@/test/use-video-test-utils"

const initialJobState: JobState = {
  tone: "idle",
  title: "Ready",
  detail: "Ready",
}

function makeDeps() {
  const updateSessionCalls: UpdateSessionFn[] = []
  const jobStates: JobState[] = []

  return {
    updateSessionCalls,
    jobStates,
    deps: {
      updateSession: ((mutator: UpdateSessionFn) => {
        updateSessionCalls.push(mutator)
      }) satisfies UpdateSessionFn,
      setFallbackJobState: (state: JobState) => {
        jobStates.push(state)
      },
      initialJobState,
    },
  }
}

afterEach(() => {
  // @ts-expect-error cleanup any test fetch stubs
  delete globalThis.fetch
  mock.restore()
})

describe("useVideo", () => {
  it("restoreSessionVideo hydrates transcript/captions/fps and clears transient state", async () => {
    const url = stubUrlApis()
    const { deps } = makeDeps()

    const { result } = renderHook(() => useVideo(deps))

    const session = makeRestoreSession({
      transcript: "hello world",
      captions: makeCaptions([
        ["hello", 0, 100],
        ["world", 100, 200],
      ]),
      videoFps: 30,
      includeCaptionLayer: true,
      width: 1280,
      height: 720,
    })

    act(() => {
      result.current.restoreSessionVideo(session)
    })

    expect(result.current.videoFile).toBeNull()
    expect(result.current.videoObjectUrl).toBeNull()
    expect(result.current.transcriptText).toBe("hello world")
    expect(result.current.captions?.length).toBe(2)
    expect(result.current.detectedVideoFps).toBe(30)
    expect(result.current.includeCaptionLayer).toBe(true)
    expect(result.current.resolution).toEqual({ width: 1280, height: 720 })

    url.restore()
  })

  it("importing a transcript file clears stale caption timing and caption-layer intent", async () => {
    const url = stubUrlApis()
    const { deps } = makeDeps()

    const { result } = renderHook(() => useVideo(deps))

    // Seed stale caption state by restoring a session.
    act(() => {
      result.current.restoreSessionVideo(
        makeRestoreSession({
          transcript: "old transcript",
          captions: makeCaptions([["old", 0, 100]]),
          videoFps: 24,
          includeCaptionLayer: true,
        }),
      )
    })

    const file = new File(["new transcript"], "transcript.txt", {
      type: "text/plain",
    })

    act(() => {
      result.current.handleTranscriptFileChange({
        target: { files: [file] },
      } as ChangeEvent<HTMLInputElement>)
    })

    await waitFor(() => {
      expect(result.current.transcriptText).toBe("new transcript")
    })

    expect(result.current.captions).toBeNull()
    expect(result.current.detectedVideoFps).toBeNull()
    expect(result.current.includeCaptionLayer).toBe(false)

    url.restore()
  })

  it("attachVideoFile auto-transcribes, maps captions, and enables caption layer", async () => {
    const url = stubUrlApis()
    const { deps, jobStates } = makeDeps()

    mock.module("@/helpers/video-meta", () => ({
      getVideoMeta: () =>
        Promise.resolve({ width: 1280, height: 720, durationSeconds: 12 }),
    }))

    // Mock fetch to return streamed NDJSON.
    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async () =>
      makeNdjsonResponse([
        { type: "extracting" },
        { type: "videoMeta", fps: 30 },
        { type: "transcribing" },
        { type: "progress", pct: 0.5 },
        {
          type: "captions",
          captions: [
            { text: "hello", startMs: 0, endMs: 200 },
            { text: "world", startMs: 200, endMs: 400 },
          ] as unknown as Caption[],
        },
      ])
    ) as unknown

    const { result } = renderHook(() => useVideo(deps))

    const videoFile = new File(["fake"], "clip.mp4", { type: "video/mp4" })

    await act(async () => {
      await result.current.attachVideoFile(videoFile)
    })

    await waitFor(() => {
      expect(result.current.captions?.length).toBe(2)
    })

    expect(result.current.transcriptText).toBe("hello world")
    expect(result.current.detectedVideoFps).toBe(30)
    expect(result.current.includeCaptionLayer).toBe(true)
    expect(jobStates.at(-1)?.title).toBe("Transcription ready")

    url.restore()
  })

  it("stale NDJSON events from an earlier run do not overwrite the latest run", async () => {
    const url = stubUrlApis()
    const { deps } = makeDeps()

    let resolveFirst: ((r: Response) => void) | undefined
    let resolveSecond: ((r: Response) => void) | undefined
    let call = 0

    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async () => {
      call += 1
      return await new Promise<Response>((resolve) => {
        if (call === 1) resolveFirst = resolve
        else resolveSecond = resolve
      })
    }) as unknown

    const { result } = renderHook(() => useVideo(deps))

    const videoFile = new File(["fake"], "clip.mp4", { type: "video/mp4" })

    // Start first run
    act(() => {
      void result.current.attachVideoFile(videoFile)
    })
    // Immediately start second run (retranscribe)
    act(() => {
      result.current.handleTranscribe()
    })

    if (!resolveSecond) {
      throw new Error("Expected second fetch call to be registered")
    }

    // Second run completes first
    resolveSecond(
      makeNdjsonResponse([
        { type: "videoMeta", fps: 30 },
        {
          type: "captions",
          captions: [{ text: "new", startMs: 0, endMs: 100 }] as unknown as Caption[],
        },
      ]),
    )

    await waitFor(() => {
      expect(result.current.transcriptText).toBe("new")
    })

    if (!resolveFirst) {
      throw new Error("Expected first fetch call to be registered")
    }

    // First run completes late with different caption payload; should be ignored
    resolveFirst(
      makeNdjsonResponse([
        { type: "videoMeta", fps: 24 },
        {
          type: "captions",
          captions: [{ text: "old", startMs: 0, endMs: 100 }] as unknown as Caption[],
        },
      ]),
    )

    // Give the microtasks a moment to run; state should remain "new".
    await waitFor(() => {
      expect(result.current.transcriptText).toBe("new")
    })

    url.restore()
  })
})


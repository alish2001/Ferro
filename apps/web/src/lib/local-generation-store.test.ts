import { afterAll, beforeEach, describe, expect, it } from "bun:test"

import {
  loadGenerationSession,
  listRecentGenerationSessions,
  markRunningSessionsInterrupted,
  saveGenerationSession,
} from "@/lib/local-generation-store"
import type {
  FerroGenerationSession,
  FerroGenerationStatus,
  FerroLayerMessage,
  FerroLayerVersion,
} from "@/lib/ferro-contracts"

class MockLocalStorage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear() {
    this.store.clear()
  }

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
}

const localStorage = new MockLocalStorage()

function setWindowStorage() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  })
}

function makeVersion(layerId: string, index: number): FerroLayerVersion {
  return {
    id: `version-${index}`,
    layerId,
    source: "initial",
    code: `code-${index}`,
    createdAt: new Date(Date.UTC(2026, 3, 3, 0, index, 0)).toISOString(),
  }
}

function makeMessage(layerId: string, index: number): FerroLayerMessage {
  return {
    id: `message-${index}`,
    layerId,
    role: index % 2 === 0 ? "user" : "assistant",
    text: `message-${index}`,
    createdAt: new Date(Date.UTC(2026, 3, 3, 1, index, 0)).toISOString(),
    versionId: null,
    status: "complete",
  }
}

function makeSession({
  id,
  status = "complete",
  updatedAt = new Date(Date.UTC(2026, 3, 3, 2, 0, 0)).toISOString(),
}: {
  id: string
  status?: FerroGenerationStatus
  updatedAt?: string
}): FerroGenerationSession {
  return {
    id,
    status,
    request: {
      taste: `Taste ${id}`,
      transcript: "",
      instructions: "",
      model: "openai:gpt-4o-mini",
      width: 1920,
      height: 1080,
      videoDurationSeconds: 12,
      hasSourceVideo: true,
      sourceVideoName: `${id}.mp4`,
    },
    skills: ["video-overlay"],
    layers: [
      {
        id: `${id}-layer-1`,
        code: "export const Example = () => null;",
        brief: "Example brief",
        type: "title-card",
        title: "Example title",
        from: 0,
        durationInFrames: 90,
        status: "ready",
        error: null,
        currentVersionId: `${id}-version-current`,
      },
    ],
    versions: [],
    messages: [],
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 360,
    error: null,
    createdAt: new Date(Date.UTC(2026, 3, 3, 0, 0, 0)).toISOString(),
    updatedAt,
    completedAt:
      status === "running" ? null : new Date(Date.UTC(2026, 3, 3, 2, 30, 0)).toISOString(),
  }
}

describe("local-generation-store", () => {
  beforeEach(() => {
    localStorage.clear()
    setWindowStorage()
  })

  afterAll(() => {
    Reflect.deleteProperty(globalThis, "window")
  })

  it("round-trips and prunes version and message history per layer", () => {
    const session = makeSession({ id: "session-prune" })
    const layerId = session.layers[0].id

    session.versions = Array.from({ length: 12 }, (_, index) =>
      makeVersion(layerId, index),
    )
    session.messages = Array.from({ length: 22 }, (_, index) =>
      makeMessage(layerId, index),
    )

    saveGenerationSession(session)
    const restored = loadGenerationSession(session.id)

    expect(restored).not.toBeNull()
    expect(restored?.versions).toHaveLength(10)
    expect(restored?.messages).toHaveLength(20)
    expect(restored?.versions[0]?.id).toBe("version-2")
    expect(restored?.messages[0]?.id).toBe("message-2")
  })

  it("keeps only the five most recent sessions", () => {
    for (let index = 0; index < 6; index += 1) {
      saveGenerationSession(
        makeSession({
          id: `session-${index}`,
          updatedAt: new Date(Date.UTC(2026, 3, 3, 3, index, 0)).toISOString(),
        }),
      )
    }

    const recent = listRecentGenerationSessions()

    expect(recent).toHaveLength(5)
    expect(recent.map((session) => session.id)).toEqual([
      "session-5",
      "session-4",
      "session-3",
      "session-2",
      "session-1",
    ])
    expect(loadGenerationSession("session-0")).toBeNull()
  })

  it("marks running sessions as interrupted on restore", () => {
    const runningSession = makeSession({ id: "session-running", status: "running" })
    saveGenerationSession(runningSession)

    const [interrupted] = markRunningSessionsInterrupted()

    expect(interrupted?.status).toBe("interrupted")
    expect(interrupted?.error).toContain("page was reloaded")
    expect(loadGenerationSession(runningSession.id)?.status).toBe("interrupted")
  })
})

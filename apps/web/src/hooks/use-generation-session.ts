import { useEffect, useMemo, useRef, useState } from "react"

import type {
  FerroGenerationSession,
  FerroGenerationSessionIndexItem,
  FerroLayer,
  FerroLayerMessage,
  FerroLayerVersion,
  FerroRenderPayload,
} from "@/lib/ferro-contracts"
import type { GenerationCounts, JobState } from "@/components/upload/generation-status"
import {
  listRecentGenerationSessions,
  loadGenerationSession,
  saveGenerationSession,
} from "@/lib/local-generation-store"

export type UpdateSessionFn = (
  mutator: (session: FerroGenerationSession) => FerroGenerationSession,
) => void

const initialJobState: JobState = {
  tone: "idle",
  title: "Ready to generate",
  detail: "Fill in the fields below, then hit Generate.",
}

function buildSessionJobState(session: FerroGenerationSession): JobState {
  const counts = getLayerCounts(session.layers)

  if (session.status === "complete") {
    return {
      tone: "success",
      title: "Generation complete",
      detail: `All ${counts.ready} motion graphics are ready for preview and export.`,
    }
  }

  if (session.status === "failed") {
    return {
      tone: "error",
      title: "Generation failed",
      detail: session.error ?? "One or more layers failed to generate.",
    }
  }

  if (session.status === "interrupted") {
    return {
      tone: "error",
      title: "Generation interrupted",
      detail:
        session.error ??
        "The page reloaded before the stream finished. Reopen the local session to inspect partial output.",
    }
  }

  if (session.layers.length === 0) {
    return {
      tone: "loading",
      title: "Starting generation…",
      detail: "Detecting skills and preparing the layer plan.",
    }
  }

  return {
    tone: "loading",
    title: `Generating ${counts.ready}/${session.layers.length} graphics…`,
    detail: `${counts.generating} in progress${counts.failed ? ` · ${counts.failed} failed` : ""}.`,
  }
}

export function createVersion(
  source: FerroLayerVersion["source"],
  layerId: string,
  code: string,
) {
  return {
    id: crypto.randomUUID(),
    layerId,
    source,
    code,
    createdAt: new Date().toISOString(),
  } satisfies FerroLayerVersion
}

function getRenderPayload(
  session: FerroGenerationSession | null,
): FerroRenderPayload | null {
  if (!session || session.status !== "complete") return null
  if (session.fps == null || session.durationInFrames == null) return null

  return {
    layers: session.layers,
    fps: session.fps,
    width: session.width,
    height: session.height,
    durationInFrames: session.durationInFrames,
  }
}

// Single-pass layer counting (fix #6 — was 4 separate .filter() calls)
export function getLayerCounts(layers: FerroLayer[]): GenerationCounts {
  const counts: GenerationCounts = { queued: 0, generating: 0, ready: 0, failed: 0 }
  for (const layer of layers) {
    if (layer.status in counts) {
      counts[layer.status as keyof GenerationCounts] += 1
    }
  }
  return counts
}

function getGenerationProgress(
  session: FerroGenerationSession | null,
  counts: GenerationCounts,
) {
  if (!session) return null
  if (session.status === "complete") return 1

  if (session.layers.length === 0) {
    return session.skills.length > 0 ? 0.2 : 0.08
  }

  const weightedLayerProgress =
    (counts.ready + counts.generating * 0.52 + counts.failed * 0.2) /
    session.layers.length

  return Math.min(0.96, 0.24 + weightedLayerProgress * 0.72)
}

export function getLayerProgressState(layer: FerroLayer) {
  switch (layer.status) {
    case "queued":
      return { indeterminate: false, tone: "idle" as const, value: 0.08 }
    case "generating":
      return { indeterminate: true, tone: "loading" as const, value: 0.52 }
    case "failed":
      return { indeterminate: false, tone: "error" as const, value: 1 }
    case "ready":
    default:
      return { indeterminate: false, tone: "success" as const, value: 1 }
  }
}

// Debounce save to localStorage during streaming (fix #15)
let saveTimer: ReturnType<typeof setTimeout> | undefined
let pendingSave: FerroGenerationSession | null = null

function debouncedSave(session: FerroGenerationSession, flush: boolean) {
  pendingSave = session
  if (flush) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = undefined
    pendingSave = null
    return saveGenerationSession(session)
  }
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      if (pendingSave) {
        saveGenerationSession(pendingSave)
        pendingSave = null
      }
    }, 500)
  }
  return null
}

export function useGenerationSession() {
  const [currentSession, setCurrentSession] =
    useState<FerroGenerationSession | null>(null)
  const [recentSessions, setRecentSessions] = useState<
    FerroGenerationSessionIndexItem[]
  >([])
  const [fallbackJobState, setFallbackJobState] =
    useState<JobState>(initialJobState)

  const sessionRef = useRef<FerroGenerationSession | null>(null)

  const layers = currentSession?.layers ?? []
  const layerCounts = getLayerCounts(layers)
  const generationProgress = getGenerationProgress(currentSession, layerCounts)
  const payload = getRenderPayload(currentSession)
  const displayedJobState = currentSession
    ? buildSessionJobState(currentSession)
    : fallbackJobState

  const messagesByLayer = useMemo(() => {
    const grouped = new Map<string, FerroLayerMessage[]>()
    for (const message of currentSession?.messages ?? []) {
      const current = grouped.get(message.layerId) ?? []
      current.push(message)
      grouped.set(message.layerId, current)
    }
    return grouped
  }, [currentSession?.messages])

  const versionsByLayer = useMemo(() => {
    const grouped = new Map<string, FerroLayerVersion[]>()
    for (const version of currentSession?.versions ?? []) {
      const current = grouped.get(version.layerId) ?? []
      current.push(version)
      grouped.set(version.layerId, current)
    }
    return grouped
  }, [currentSession?.versions])

  useEffect(() => {
    sessionRef.current = currentSession
  }, [currentSession])

  function refreshRecentSessions() {
    setRecentSessions(listRecentGenerationSessions())
  }

  function commitSession(
    nextSession: FerroGenerationSession | null,
    flush = false,
  ) {
    if (!nextSession) {
      sessionRef.current = null
      setCurrentSession(null)
      refreshRecentSessions()
      return
    }

    const savedSession = debouncedSave(nextSession, flush) ?? nextSession
    sessionRef.current = savedSession
    setCurrentSession(savedSession)
    if (flush) refreshRecentSessions()
  }

  const updateSession: UpdateSessionFn = (mutator) => {
    const session = sessionRef.current
    if (!session) return
    commitSession(mutator(session))
  }

  function flushSession() {
    const session = sessionRef.current
    if (!session) return
    commitSession(session, true)
  }

  function openStoredSession(sessionId: string) {
    const session = loadGenerationSession(sessionId)
    if (!session) return null

    commitSession(session, true)
    return session
  }

  // Flush debounced save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = undefined
      }
      if (pendingSave) {
        saveGenerationSession(pendingSave)
        pendingSave = null
      }
    }
  }, [])

  return {
    currentSession,
    layers,
    messagesByLayer,
    versionsByLayer,
    layerCounts,
    generationProgress,
    displayedJobState,
    payload,
    recentSessions,
    fallbackJobState,
    sessionRef,
    commitSession,
    updateSession,
    flushSession,
    refreshRecentSessions,
    openStoredSession,
    setFallbackJobState,
    initialJobState,
  }
}

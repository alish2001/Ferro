import { useEffect, useState } from "react"

import type {
  DevModeStageTrace,
  FerroGenerateStreamEvent,
  FerroGenerationSession,
} from "@/lib/ferro-contracts"
import type { UpdateSessionFn } from "@/hooks/use-generation-session"
import { readNdjsonStream } from "@/lib/ndjson"

function persistStageTraces(
  generationId: string,
  traces: Map<string, DevModeStageTrace>,
) {
  try {
    const entries = Array.from(traces.entries())
    sessionStorage.setItem(
      `ferro-traces:${generationId}`,
      JSON.stringify(entries),
    )
  } catch {
    // sessionStorage full or unavailable — non-critical
  }
}

export function loadStageTraces(
  generationId: string,
): Map<string, DevModeStageTrace> {
  try {
    const raw = sessionStorage.getItem(`ferro-traces:${generationId}`)
    if (!raw) return new Map()
    const entries: [string, DevModeStageTrace][] = JSON.parse(raw)
    return new Map(entries)
  } catch {
    return new Map()
  }
}

export function useDevMode(
  currentSession: FerroGenerationSession | null,
  updateSession: UpdateSessionFn,
) {
  // Initialized as false, restored from localStorage in useEffect to avoid hydration mismatch
  const [devMode, setDevMode] = useState(false)
  const [stageTraces, setStageTraces] = useState<
    Map<string, DevModeStageTrace>
  >(new Map())
  const [isRerunning, setIsRerunning] = useState(false)

  // Restore dev mode toggle from localStorage on mount
  useEffect(() => {
    if (localStorage.getItem("ferro-dev-mode") === "1") {
      setDevMode(true)
    }
  }, [])

  function toggleDevMode(on: boolean) {
    setDevMode(on)
    localStorage.setItem("ferro-dev-mode", on ? "1" : "0")
  }

  function handleStageTraceUpdate(
    generationId: string,
    trace: DevModeStageTrace,
  ) {
    setStageTraces((prev) => {
      const next = new Map(prev)
      next.set(trace.stageId, trace)
      persistStageTraces(generationId, next)
      return next
    })
  }

  async function handleRerunStage(
    stageId: string,
    overrides: { systemPrompt?: string; userPrompt?: string },
    cascade: boolean,
  ) {
    if (!currentSession) return

    setIsRerunning(true)

    try {
      const res = await fetch("/api/generate/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: currentSession.id,
          stageId,
          systemPromptOverride: overrides.systemPrompt,
          userPromptOverride: overrides.userPrompt,
          cascade,
          previousContext: {
            request: currentSession.request,
            skills: currentSession.skills,
            systemPrompt:
              stageTraces.get("system-prompt-build")?.rawOutput ?? undefined,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      await readNdjsonStream<FerroGenerateStreamEvent>(
        res,
        async (event) => {
          switch (event.type) {
            case "debug-stage-update": {
              handleStageTraceUpdate(event.generationId, event.trace)
              break
            }
            case "skills-ready": {
              updateSession((session) => ({
                ...session,
                skills: event.skills,
                updatedAt: new Date().toISOString(),
              }))
              break
            }
            case "plan-ready": {
              updateSession((session) => ({
                ...session,
                layers: event.layers,
                fps: event.fps,
                width: event.width,
                height: event.height,
                durationInFrames: event.durationInFrames,
                updatedAt: new Date().toISOString(),
              }))
              break
            }
            case "layer-completed": {
              updateSession((session) => ({
                ...session,
                layers: session.layers.map((l) =>
                  l.id === event.layer.id ? event.layer : l,
                ),
                versions: [...session.versions, event.version],
                updatedAt: new Date().toISOString(),
              }))
              break
            }
            case "layer-failed": {
              updateSession((session) => ({
                ...session,
                layers: session.layers.map((l) =>
                  l.id === event.layerId
                    ? { ...l, status: "failed" as const, error: event.error }
                    : l,
                ),
                updatedAt: new Date().toISOString(),
              }))
              break
            }
            default:
              break
          }
        },
      )
    } catch (error) {
      console.error("Rerun failed:", error)
    } finally {
      setIsRerunning(false)
    }
  }

  return {
    devMode,
    toggleDevMode,
    stageTraces,
    setStageTraces,
    isRerunning,
    handleRerunStage,
    handleStageTraceUpdate,
  }
}

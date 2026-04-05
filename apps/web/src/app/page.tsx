"use client"

import type { ChangeEvent, DragEvent, FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Captions,
  Clapperboard,
  Download,
  FileVideo,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react"

import { PipelineFlowchart } from "@/components/dev-mode/pipeline-flowchart"
import { CompositorPreview } from "@/components/preview/CompositorPreview"
import { GraphicCard } from "@/components/preview/GraphicCard"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import { Button, buttonVariants } from "@/components/ui/button"
import { ModelSelector } from "@/components/ui/model-selector"
import {
  ResolutionSelector,
  type Resolution,
} from "@/components/ui/resolution-selector"
import { FieldCard } from "@/components/upload/field-card"
import {
  GenerationStatus,
  type GenerationCounts,
  type JobState,
} from "@/components/upload/generation-status"
import { getVideoMeta } from "@/helpers/video-meta"
import type {
  DevModeStageTrace,
  FerroCaption,
  FerroGenerateRequest,
  FerroGenerateStreamEvent,
  FerroGenerationSession,
  FerroGenerationSessionIndexItem,
  FerroLayer,
  FerroLayerEditStreamEvent,
  FerroLayerMessage,
  FerroLayerVersion,
  FerroRenderJobAcceptedResponse,
  FerroRenderJobResponse,
  FerroRenderMode,
  FerroRenderPayload,
} from "@/lib/ferro-contracts"
import type { TranscribeStreamEvent } from "@/app/api/transcribe/route"
import {
  listRecentGenerationSessions,
  loadGenerationSession,
  markRunningSessionsInterrupted,
  saveGenerationSession,
} from "@/lib/local-generation-store"
import { readNdjsonStream } from "@/lib/ndjson"
import { cn } from "@/lib/utils"
import {
  checkBrowserRenderSupport,
  exportInBrowser,
} from "@/remotion/client-render"

const initialJobState: JobState = {
  tone: "idle",
  title: "Ready to generate",
  detail: "Fill in the fields below, then hit Generate.",
}

const supportedVideoExtensions = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".avi",
  ".mkv",
]

function isLikelyVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true
  const lowerName = file.name.toLowerCase()
  return supportedVideoExtensions.some((ext) => lowerName.endsWith(ext))
}

function buildSessionJobState(session: FerroGenerationSession): JobState {
  const readyCount = session.layers.filter((layer) => layer.status === "ready").length
  const generatingCount = session.layers.filter(
    (layer) => layer.status === "generating",
  ).length
  const failedCount = session.layers.filter((layer) => layer.status === "failed").length

  if (session.status === "complete") {
    return {
      tone: "success",
      title: "Generation complete",
      detail: `All ${readyCount} motion graphics are ready for preview and export.`,
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
    title: `Generating ${readyCount}/${session.layers.length} graphics…`,
    detail: `${generatingCount} in progress${failedCount ? ` · ${failedCount} failed` : ""}.`,
  }
}

function createVersion(source: FerroLayerVersion["source"], layerId: string, code: string) {
  return {
    id: crypto.randomUUID(),
    layerId,
    source,
    code,
    createdAt: new Date().toISOString(),
  } satisfies FerroLayerVersion
}

function getRenderPayload(session: FerroGenerationSession | null): FerroRenderPayload | null {
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

function getLayerCounts(layers: FerroLayer[]) {
  return {
    queued: layers.filter((layer) => layer.status === "queued").length,
    generating: layers.filter((layer) => layer.status === "generating").length,
    ready: layers.filter((layer) => layer.status === "ready").length,
    failed: layers.filter((layer) => layer.status === "failed").length,
  }
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

function getLayerProgressState(layer: FerroLayer) {
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

export default function Home() {
  const [step, setStep] = useState<"form" | "preview">("form")
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const [clientDownloadUrl, setClientDownloadUrl] = useState<string | null>(null)
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(
    null,
  )
  const [fallbackJobState, setFallbackJobState] =
    useState<JobState>(initialJobState)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [selectedModel, setSelectedModel] = useState(
    "anthropic:claude-sonnet-4-6",
  )
  const [resolution, setResolution] = useState<Resolution>({
    width: 1920,
    height: 1080,
  })
  const [currentSession, setCurrentSession] =
    useState<FerroGenerationSession | null>(null)
  const [recentSessions, setRecentSessions] = useState<
    FerroGenerationSessionIndexItem[]
  >([])
  const [renderMode, setRenderMode] = useState<FerroRenderMode>("server")
  const [renderJob, setRenderJob] = useState<FerroRenderJobResponse | null>(
    null,
  )
  const [renderJobId, setRenderJobId] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number | null>(null)
  const [renderMessage, setRenderMessage] = useState(
    "Choose a render mode, then export.",
  )
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isStartingServerRender, setIsStartingServerRender] = useState(false)
  const [isClientRendering, setIsClientRendering] = useState(false)

  // Transcription state
  const [transcriptText, setTranscriptText] = useState("")
  const [captions, setCaptions] = useState<FerroCaption[] | null>(null)
  const [detectedVideoFps, setDetectedVideoFps] = useState<number | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeStatus, setTranscribeStatus] = useState<string | null>(null)
  const [includeCaptionLayer, setIncludeCaptionLayer] = useState(false)

  // Dev mode state
  const [devMode, setDevMode] = useState(false)
  const [stageTraces, setStageTraces] = useState<Map<string, DevModeStageTrace>>(new Map())
  const [isRerunning, setIsRerunning] = useState(false)

  const formVideoInputRef = useRef<HTMLInputElement>(null)
  const previewVideoInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const sessionRef = useRef<FerroGenerationSession | null>(null)

  const layers = currentSession?.layers ?? []
  const currentLayerCounts = getLayerCounts(layers)
  const generationProgress = getGenerationProgress(
    currentSession,
    currentLayerCounts,
  )
  const payload = getRenderPayload(currentSession)
  const displayedJobState = currentSession
    ? buildSessionJobState(currentSession)
    : fallbackJobState
  const needsVideoReattach = Boolean(
    currentSession?.request.hasSourceVideo && !videoObjectUrl,
  )

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

  function commitSession(nextSession: FerroGenerationSession | null) {
    if (!nextSession) {
      sessionRef.current = null
      setCurrentSession(null)
      refreshRecentSessions()
      return
    }

    const savedSession = saveGenerationSession(nextSession) ?? nextSession
    sessionRef.current = savedSession
    setCurrentSession(savedSession)
    refreshRecentSessions()
  }

  function updateSession(
    mutator: (session: FerroGenerationSession) => FerroGenerationSession,
  ) {
    const session = sessionRef.current
    if (!session) return
    commitSession(mutator(session))
  }

  function resetRenderState() {
    setRenderJob(null)
    setRenderJobId(null)
    setRenderProgress(null)
    setRenderError(null)
    setRenderMessage("Choose a render mode, then export.")
    setIsStartingServerRender(false)
    setIsClientRendering(false)

    if (clientDownloadUrl) {
      URL.revokeObjectURL(clientDownloadUrl)
      setClientDownloadUrl(null)
    }
  }

  useEffect(() => {
    function preventWindowFileDrop(event: globalThis.DragEvent) {
      const items = event.dataTransfer?.items
      const hasFiles = items
        ? Array.from(items).some((item) => item.kind === "file")
        : false
      if (!hasFiles) return
      event.preventDefault()
    }

    const interruptedSessions = markRunningSessionsInterrupted()
    refreshRecentSessions()

    if (interruptedSessions[0]) {
      const session = interruptedSessions[0]
      sessionRef.current = session
      setCurrentSession(session)
      setSelectedModel(session.request.model)
      setResolution({ width: session.width, height: session.height })
    }

    window.addEventListener("dragover", preventWindowFileDrop)
    window.addEventListener("drop", preventWindowFileDrop)

    return () => {
      window.removeEventListener("dragover", preventWindowFileDrop)
      window.removeEventListener("drop", preventWindowFileDrop)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl)
    }
  }, [videoObjectUrl])

  useEffect(() => {
    return () => {
      if (clientDownloadUrl) URL.revokeObjectURL(clientDownloadUrl)
    }
  }, [clientDownloadUrl])

  useEffect(() => {
    if (!renderJobId) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        const res = await fetch(`/api/render/${renderJobId}`, {
          cache: "no-store",
        })

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Render job unavailable" }))
          throw new Error(err.error ?? "Render job unavailable")
        }

        const data: FerroRenderJobResponse = await res.json()
        if (cancelled) return

        setRenderJob(data)
        setRenderProgress(data.progress?.progress ?? null)

        if (data.status === "queued") {
          setRenderMessage(
            "Server render queued. Waiting for the local worker.",
          )
          timeoutId = setTimeout(poll, 1000)
          return
        }

        if (data.status === "rendering") {
          setRenderMessage("Server render in progress.")
          timeoutId = setTimeout(poll, 1000)
          return
        }

        if (data.status === "complete") {
          setRenderError(data.error)
          setRenderMessage(
            data.downloadUrl
              ? "Server render finished. Download the MP4 when ready."
              : (data.error ?? "Server render finished, but the MP4 is unavailable."),
          )
          return
        }

        if (data.status === "error") {
          setRenderError(data.error ?? "Render failed.")
          setRenderMessage("Server render failed.")
        }
      } catch (error) {
        if (cancelled) return

        const message =
          error instanceof Error ? error.message : "Render job unavailable"
        setRenderJob(null)
        setRenderError(message)
        setRenderMessage("Server render status is unavailable.")
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [renderJobId])

  function syncVideoInputs(file: File | null) {
    if (typeof DataTransfer === "undefined") return

    for (const input of [formVideoInputRef.current, previewVideoInputRef.current]) {
      if (!input) continue

      const transfer = new DataTransfer()
      if (file) transfer.items.add(file)
      input.files = transfer.files
    }
  }

  async function attachVideoFile(file: File | null) {
    if (!file) {
      setVideoFile(null)
      syncVideoInputs(null)
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl)
        setVideoObjectUrl(null)
      }
      setFallbackJobState(initialJobState)
      return
    }

    if (!isLikelyVideoFile(file)) {
      setVideoFile(null)
      syncVideoInputs(null)
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl)
        setVideoObjectUrl(null)
      }
      setFallbackJobState({
        tone: "error",
        title: "Unsupported file",
        detail:
          "Drop or choose a video file such as MP4, MOV, WebM, AVI, or MKV.",
      })
      return
    }

    setVideoFile(file)
    syncVideoInputs(file)

    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl)
    setVideoObjectUrl(URL.createObjectURL(file))

    setFallbackJobState({
      tone: "idle",
      title: "Source video attached",
      detail: "Fill in the remaining fields and hit Generate when ready.",
    })

    updateSession((session) => ({
      ...session,
      request: {
        ...session.request,
        hasSourceVideo: true,
        sourceVideoName: file.name,
      },
      updatedAt: new Date().toISOString(),
    }))

    try {
      const meta = await getVideoMeta(file)
      setResolution({ width: meta.width, height: meta.height })
    } catch {
      // Keep current resolution if we can't read metadata
    }
  }

  function openStoredSession(sessionId: string) {
    const session = loadGenerationSession(sessionId)
    if (!session) return

    setSelectedModel(session.request.model)
    setResolution({ width: session.width, height: session.height })
    setTranscriptFileName(null)
    setVideoFile(null)
    syncVideoInputs(null)
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl)
      setVideoObjectUrl(null)
    }
    resetRenderState()
    commitSession(session)
    setStep(session.layers.length > 0 ? "preview" : "form")
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    void attachVideoFile(file)
  }

  function handlePreviewVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    void attachVideoFile(file)
  }

  function handleTranscriptFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setTranscriptFileName(file?.name ?? null)
    if (file) {
      file.text().then((text) => setTranscriptText(text)).catch(() => null)
    }
  }

  async function handleTranscribe() {
    if (!videoFile) {
      setFallbackJobState({
        tone: "error",
        title: "No video",
        detail: "Upload a video first, then click Transcribe.",
      })
      return
    }

    setIsTranscribing(true)
    setTranscribeStatus("Extracting audio…")
    setCaptions(null)
    setDetectedVideoFps(null)
    setTranscriptText("")

    try {
      const body = new FormData()
      body.append("video", videoFile)

      const res = await fetch("/api/transcribe", { method: "POST", body })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      let segmentBuffer = ""

      await readNdjsonStream<TranscribeStreamEvent>(res, (event) => {
        switch (event.type) {
          case "extracting":
            setTranscribeStatus("Extracting audio…")
            break
          case "videoMeta":
            setDetectedVideoFps(event.fps)
            break
          case "transcribing":
            setTranscribeStatus("Transcribing…")
            break
          case "installing":
            setTranscribeStatus("Installing whisper.cpp (first run)…")
            break
          case "progress":
            setTranscribeStatus(`Transcribing… ${Math.round(event.pct * 100)}%`)
            break
          case "segment": {
            const { startMs, endMs, text } = event.segment
            const fmt = (ms: number) => (ms / 1000).toFixed(2) + "s"
            segmentBuffer += `[${fmt(startMs)} → ${fmt(endMs)}] ${text}\n`
            setTranscriptText(segmentBuffer) // replaced by raw JSON once captions arrive
            break
          }
          case "captions": {
            const mapped: FerroCaption[] = event.captions.map((c) => ({
              text: c.text,
              startMs: c.startMs,
              endMs: c.endMs,
            }))
            setCaptions(mapped)
            // Show the exact JSON being sent to the planner so it's debuggable
            setTranscriptText(JSON.stringify(mapped, null, 2))
            setTranscribeStatus("Done")
            break
          }
          case "error":
            throw new Error(event.error)
        }
      })
    } catch (err) {
      setFallbackJobState({
        tone: "error",
        title: "Transcription failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setIsTranscribing(false)
    }
  }

  function handleVideoDragEnter(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === "file",
    )
    if (!hasFiles) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingVideo(true)
  }

  function handleVideoDragOver(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === "file",
    )
    if (!hasFiles) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setIsDraggingVideo(true)
  }

  function handleVideoDragLeave(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === "file",
    )
    if (!hasFiles) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDraggingVideo(false)
  }

  function handleVideoDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingVideo(false)
    const file = event.dataTransfer.files?.[0] ?? null
    void attachVideoFile(file)
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const taste = (formData.get("taste") as string) ?? ""
    const transcript = (formData.get("transcript") as string) ?? ""
    const instructions = (formData.get("prompt") as string) ?? ""

    if (!taste && !transcript && !instructions) {
      setFallbackJobState({
        tone: "error",
        title: "Nothing to generate",
        detail:
          "Fill in at least one field — taste, transcript, or instructions.",
      })
      return
    }

    commitSession(null)
    setStep("form")
    resetRenderState()
    setStageTraces(new Map())
    setFallbackJobState({
      tone: "loading",
      title: "Generating graphics…",
      detail:
        "Detecting skills, planning layers, and generating code in parallel.",
    })

    let videoDurationSeconds: number | undefined
    if (videoFile) {
      try {
        const meta = await getVideoMeta(videoFile)
        videoDurationSeconds = meta.durationSeconds
      } catch {
        // proceed without duration
      }
    }

    // Use controlled transcript state when available (populated by transcribe/file)
    const finalTranscript = transcriptText || transcript

    const request: FerroGenerateRequest = {
      taste,
      transcript: finalTranscript,
      instructions,
      model: selectedModel,
      width: resolution.width,
      height: resolution.height,
      videoDurationSeconds,
      videoFps: detectedVideoFps ?? undefined,
      hasSourceVideo: Boolean(videoFile),
      sourceVideoName: videoFile?.name ?? null,
      captions: captions ?? undefined,
      includeCaptionLayer: includeCaptionLayer || undefined,
      devMode: devMode || undefined,
    }

    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      await readNdjsonStream<FerroGenerateStreamEvent>(res, async (streamEvent) => {
        switch (streamEvent.type) {
          case "job-started": {
            commitSession({
              id: streamEvent.generationId,
              status: "running",
              request: streamEvent.request,
              skills: [],
              layers: [],
              versions: [],
              messages: [],
              fps: null,
              width: streamEvent.request.width,
              height: streamEvent.request.height,
              durationInFrames: null,
              error: null,
              createdAt: streamEvent.createdAt,
              updatedAt: streamEvent.createdAt,
              completedAt: null,
            })
            break
          }
          case "skills-ready": {
            updateSession((session) => ({
              ...session,
              skills: streamEvent.skills,
              updatedAt: new Date().toISOString(),
            }))
            break
          }
          case "plan-ready": {
            updateSession((session) => ({
              ...session,
              layers: streamEvent.layers,
              fps: streamEvent.fps,
              width: streamEvent.width,
              height: streamEvent.height,
              durationInFrames: streamEvent.durationInFrames,
              updatedAt: new Date().toISOString(),
            }))
            break
          }
          case "layer-started": {
            updateSession((session) => ({
              ...session,
              layers: session.layers.map((layer) =>
                layer.id === streamEvent.layerId
                  ? {
                      ...layer,
                      status: "generating",
                      error: null,
                    }
                  : layer,
              ),
              updatedAt: new Date().toISOString(),
            }))
            break
          }
          case "layer-completed": {
            updateSession((session) => ({
              ...session,
              layers: session.layers.map((layer) =>
                layer.id === streamEvent.layer.id ? streamEvent.layer : layer,
              ),
              versions: [...session.versions, streamEvent.version],
              updatedAt: new Date().toISOString(),
            }))
            break
          }
          case "layer-failed": {
            updateSession((session) => ({
              ...session,
              layers: session.layers.map((layer) =>
                layer.id === streamEvent.layerId
                  ? {
                      ...layer,
                      status: "failed",
                      error: streamEvent.error,
                    }
                  : layer,
              ),
              updatedAt: new Date().toISOString(),
            }))
            break
          }
          case "job-completed": {
            updateSession((session) => ({
              ...session,
              status: "complete",
              skills: streamEvent.response.skills,
              layers: streamEvent.response.layers,
              fps: streamEvent.response.fps,
              width: streamEvent.response.width,
              height: streamEvent.response.height,
              durationInFrames: streamEvent.response.durationInFrames,
              error: null,
              updatedAt: streamEvent.completedAt,
              completedAt: streamEvent.completedAt,
            }))
            setStep("preview")
            break
          }
          case "job-failed": {
            updateSession((session) => ({
              ...session,
              status: "failed",
              error: streamEvent.error,
              updatedAt: streamEvent.completedAt,
              completedAt: streamEvent.completedAt,
            }))
            break
          }
          case "debug-stage-update": {
            setStageTraces((prev) => {
              const next = new Map(prev)
              next.set(streamEvent.trace.stageId, streamEvent.trace)
              return next
            })
            break
          }
        }
      })
    } catch (error) {
      updateSession((session) => ({
        ...session,
        status: "failed",
        error: error instanceof Error ? error.message : "Generation failed",
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }))

      setFallbackJobState({
        tone: "error",
        title: "Generation failed",
        detail: error instanceof Error ? error.message : "Something went wrong.",
      })
    }
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
            systemPrompt: stageTraces.get("system-prompt-build")?.rawOutput ?? undefined,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      await readNdjsonStream<FerroGenerateStreamEvent>(res, async (event) => {
        switch (event.type) {
          case "debug-stage-update": {
            setStageTraces((prev) => {
              const next = new Map(prev)
              next.set(event.trace.stageId, event.trace)
              return next
            })
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
      })
    } catch (error) {
      console.error("Rerun failed:", error)
    } finally {
      setIsRerunning(false)
    }
  }

  function handleLayerCodeChange(layerId: string, code: string) {
    const version = createVersion("manual", layerId, code)

    updateSession((session) => ({
      ...session,
      layers: session.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              code,
              currentVersionId: version.id,
              error: null,
            }
          : layer,
      ),
      versions: [...session.versions, version],
      updatedAt: version.createdAt,
    }))
  }

  async function handleLayerEditPrompt(layerId: string, prompt: string) {
    const session = sessionRef.current
    if (!session) return

    const layer = session.layers.find((candidate) => candidate.id === layerId)
    if (!layer || layer.status !== "ready") return

    const userMessage: FerroLayerMessage = {
      id: crypto.randomUUID(),
      layerId,
      role: "user",
      text: prompt,
      createdAt: new Date().toISOString(),
      status: "complete",
      versionId: layer.currentVersionId,
    }

    const pendingAssistantMessage: FerroLayerMessage = {
      id: crypto.randomUUID(),
      layerId,
      role: "assistant",
      text: "Updating overlay…",
      createdAt: new Date().toISOString(),
      status: "pending",
      versionId: null,
    }

    const requestMessages = [
      ...(messagesByLayer.get(layerId) ?? []).filter(
        (message) => message.status === "complete",
      ),
      userMessage,
    ]

    updateSession((activeSession) => ({
      ...activeSession,
      messages: [
        ...activeSession.messages,
        userMessage,
        pendingAssistantMessage,
      ],
      updatedAt: pendingAssistantMessage.createdAt,
    }))

    try {
      const res = await fetch("/api/layers/edit/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: session.id,
          layerId,
          model: session.request.model,
          skills: session.skills,
          layer,
          currentCode: layer.code,
          messages: requestMessages,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Layer edit failed" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      await readNdjsonStream<FerroLayerEditStreamEvent>(res, async (streamEvent) => {
        switch (streamEvent.type) {
          case "edit-started":
            break
          case "edit-completed": {
            updateSession((activeSession) => ({
              ...activeSession,
              layers: activeSession.layers.map((candidate) =>
                candidate.id === layerId
                  ? {
                      ...candidate,
                      code: streamEvent.code,
                      currentVersionId: streamEvent.version.id,
                      error: null,
                    }
                  : candidate,
              ),
              versions: [...activeSession.versions, streamEvent.version],
              messages: activeSession.messages.map((message) =>
                message.id === pendingAssistantMessage.id
                  ? {
                      ...message,
                      text: streamEvent.reply,
                      status: "complete",
                      versionId: streamEvent.version.id,
                    }
                  : message,
              ),
              updatedAt: streamEvent.version.createdAt,
            }))
            break
          }
          case "edit-failed": {
            updateSession((activeSession) => ({
              ...activeSession,
              messages: activeSession.messages.map((message) =>
                message.id === pendingAssistantMessage.id
                  ? {
                      ...message,
                      text: streamEvent.error,
                      status: "failed",
                    }
                  : message,
              ),
              updatedAt: new Date().toISOString(),
            }))
            break
          }
        }
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Layer edit failed"

      updateSession((activeSession) => ({
        ...activeSession,
        messages: activeSession.messages.map((candidate) =>
          candidate.id === pendingAssistantMessage.id
            ? {
                ...candidate,
                text: message,
                status: "failed",
              }
            : candidate,
        ),
        updatedAt: new Date().toISOString(),
      }))
    }
  }

  function downloadFromUrl(url: string, filename: string) {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
  }

  async function handleServerRender() {
    if (!payload || needsVideoReattach) return

    setIsStartingServerRender(true)
    if (clientDownloadUrl) {
      URL.revokeObjectURL(clientDownloadUrl)
      setClientDownloadUrl(null)
    }
    setRenderError(null)
    setRenderProgress(null)
    setRenderMessage("Queueing server render...")
    setRenderJob(null)
    setRenderJobId(null)

    try {
      const formData = new FormData()
      formData.set("payload", JSON.stringify(payload))
      if (videoFile) formData.set("video", videoFile)

      const res = await fetch("/api/render", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Server render failed" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const data: FerroRenderJobAcceptedResponse = await res.json()
      setRenderJobId(data.jobId)
      setRenderMessage("Server render queued. Waiting for progress...")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server render failed"
      setRenderError(message)
      setRenderMessage("Server render failed before the job could start.")
    } finally {
      setIsStartingServerRender(false)
    }
  }

  async function handleClientRender() {
    if (!payload || needsVideoReattach) return

    setIsClientRendering(true)
    setRenderError(null)
    setRenderProgress(null)
    setRenderMessage("Checking browser render support...")
    setRenderJob(null)
    setRenderJobId(null)

    try {
      const capability = await checkBrowserRenderSupport(
        payload,
        Boolean(videoObjectUrl),
      )
      if (!capability.canRender) {
        const issues = capability.issues.map((issue) => issue.message).join(" ")
        throw new Error(
          issues || "This browser cannot render the current export.",
        )
      }

      setRenderMessage("Browser export in progress...")
      const blob = await exportInBrowser({
        payload,
        videoSrc: videoObjectUrl,
        onProgress: (progress) => {
          setRenderProgress(progress)
        },
      })

      if (clientDownloadUrl) URL.revokeObjectURL(clientDownloadUrl)
      const nextDownloadUrl = URL.createObjectURL(blob)
      setClientDownloadUrl(nextDownloadUrl)
      setRenderMessage("Browser export finished. Download the MP4.")
      downloadFromUrl(nextDownloadUrl, "ferro-browser-render.mp4")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Browser render failed"
      setRenderError(message)
      setRenderMessage("Browser render failed.")
    } finally {
      setIsClientRendering(false)
    }
  }

  async function handleExport() {
    if (renderMode === "server") {
      await handleServerRender()
      return
    }

    await handleClientRender()
  }

  const serverIsBusy =
    isStartingServerRender ||
    renderJob?.status === "queued" ||
    renderJob?.status === "rendering"
  const isExporting = serverIsBusy || isClientRendering
  const canDownloadServer =
    renderJob?.status === "complete" && Boolean(renderJob.downloadUrl)
  const canRetryClient = renderMode === "server" && Boolean(renderError)
  const canDownloadClient =
    renderMode === "client" && Boolean(clientDownloadUrl)

  if (step === "preview" && currentSession && currentSession.layers.length > 0) {
    return (
      <main className="min-h-screen px-4 py-8 text-white sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("form")}
              className="rounded-xl text-white/60 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Back to form
            </Button>
            <div className="flex flex-wrap gap-2">
              {currentSession.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/55"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {devMode && stageTraces.size > 0 && (
            <div className="mb-8">
              <PipelineFlowchart
                traces={stageTraces}
                onRerunStage={handleRerunStage}
                isRerunning={isRerunning}
              />
            </div>
          )}

          {needsVideoReattach ? (
            <div className="mb-8 rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 px-5 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 text-amber-300" />
                  <div>
                    <p className="text-sm font-medium text-amber-200">
                      Reattach the source video for composite preview and export.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-100/75">
                      Local sessions do not persist the uploaded video blob. The
                      layer code and chat history are restored, but the original
                      video must be attached again.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <label
                    htmlFor="preview-source-video"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "cursor-pointer rounded-xl border-white/10 bg-black/35 px-4 text-white hover:bg-white/[0.08]",
                    )}
                  >
                    <Upload className="size-3.5" />
                    Reattach video
                  </label>
                  <input
                    id="preview-source-video"
                    type="file"
                    ref={previewVideoInputRef}
                    accept="video/*"
                    suppressHydrationWarning
                    className="sr-only"
                    onChange={handlePreviewVideoChange}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {payload ? (
            <div className="mb-8 rounded-[1.75rem] border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">
                    Export
                  </p>
                  <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">
                    Render MP4 output
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    Server rendering is primary for development. Browser
                    rendering stays available as a fallback when the server path
                    is unavailable or unsupported.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={renderMode === "server" ? "secondary" : "ghost"}
                    onClick={() => setRenderMode("server")}
                    className={cn(
                      "rounded-xl border border-white/10 px-4 text-white",
                      renderMode === "server"
                        ? "bg-white/15 hover:bg-white/20"
                        : "bg-black/30 hover:bg-white/[0.08]",
                    )}
                  >
                    Server
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={renderMode === "client" ? "secondary" : "ghost"}
                    onClick={() => setRenderMode("client")}
                    className={cn(
                      "rounded-xl border border-white/10 px-4 text-white",
                      renderMode === "client"
                        ? "bg-white/15 hover:bg-white/20"
                        : "bg-black/30 hover:bg-white/[0.08]",
                    )}
                  >
                    Client
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-4">
                  <p className="text-sm font-medium text-white">
                    {renderMode === "server"
                      ? "Server render mode"
                      : "Client render mode"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/62">
                    {needsVideoReattach
                      ? "Reattach the original source video before exporting."
                      : renderMessage}
                  </p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-white/38">
                    {payload.width}×{payload.height} · {payload.fps}fps ·{" "}
                    {payload.durationInFrames} frames
                  </p>
                  {typeof renderProgress === "number" ? (
                    <div className="mt-4">
                      <div className="h-2 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full bg-white transition-[width]"
                          style={{ width: `${Math.round(renderProgress * 100)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-white/45">
                        {Math.round(renderProgress * 100)}% complete
                      </p>
                    </div>
                  ) : null}
                  {renderError ? (
                    <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3 text-sm text-red-300">
                      {renderError}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void handleExport()}
                    disabled={isExporting || needsVideoReattach}
                    className="h-12 rounded-[1rem] bg-white px-5 text-black hover:bg-zinc-200"
                  >
                    <Sparkles className="size-4" />
                    {renderMode === "server"
                      ? serverIsBusy
                        ? "Rendering on server…"
                        : "Start server render"
                      : isClientRendering
                        ? "Rendering in browser…"
                        : "Render in browser"}
                  </Button>

                  {canDownloadServer && renderJob?.downloadUrl ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() =>
                        downloadFromUrl(
                          renderJob?.downloadUrl ?? "",
                          `ferro-server-render-${renderJob?.jobId}.mp4`,
                        )
                      }
                      className="h-12 rounded-[1rem] border-white/10 bg-black/35 px-5 text-white hover:bg-white/[0.08]"
                    >
                      <Download className="size-4" />
                      Download MP4
                    </Button>
                  ) : null}

                  {canDownloadClient && clientDownloadUrl ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() =>
                        downloadFromUrl(
                          clientDownloadUrl,
                          "ferro-browser-render.mp4",
                        )
                      }
                      className="h-12 rounded-[1rem] border-white/10 bg-black/35 px-5 text-white hover:bg-white/[0.08]"
                    >
                      <Download className="size-4" />
                      Download MP4
                    </Button>
                  ) : null}

                  {canRetryClient ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => setRenderMode("client")}
                      className="h-12 rounded-[1rem] border-white/10 bg-black/35 px-5 text-white hover:bg-white/[0.08]"
                    >
                      Retry with client rendering
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 rounded-[1.5rem] border border-white/12 bg-white/[0.03] px-5 py-4">
              <p className="text-sm font-medium text-white">
                Export unavailable for incomplete local sessions.
              </p>
              <p className="mt-1 text-sm leading-6 text-white/62">
                Finish a full generation before exporting. You can still inspect
                completed layers and continue editing them below.
              </p>
            </div>
          )}

          <div className="mb-8">
            <CompositorPreview
              videoObjectUrl={videoObjectUrl}
              layers={currentSession.layers}
              fps={currentSession.fps ?? 30}
              width={currentSession.width}
              height={currentSession.height}
              durationInFrames={currentSession.durationInFrames ?? 1}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {currentSession.layers.map((layer) => (
              <GraphicCard
                key={`${layer.id}:${layer.currentVersionId ?? "draft"}`}
                layer={layer}
                fps={currentSession.fps ?? 30}
                width={currentSession.width}
                height={currentSession.height}
                messages={messagesByLayer.get(layer.id) ?? []}
                versionCount={(versionsByLayer.get(layer.id) ?? []).length}
                onCodeChange={(code) => handleLayerCodeChange(layer.id, code)}
                onEditPrompt={(prompt) => handleLayerEditPrompt(layer.id, prompt)}
              />
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="w-full max-w-5xl">
          <div className="mb-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-white/45">
              Ferro
            </p>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
              Upload a video and shape the Remotion brief.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/62 sm:text-base">
              Source video on top. Taste, transcript, and prompt underneath.
              Generate AI-powered motion graphics overlays.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleGenerate}>
            <label
              htmlFor="source-video"
              className={cn(
                "group relative block cursor-pointer overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.035] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.05] sm:p-10",
                isDraggingVideo && "border-white/35 bg-white/[0.08]",
              )}
              onDragEnter={handleVideoDragEnter}
              onDragLeave={handleVideoDragLeave}
              onDragOver={handleVideoDragOver}
              onDrop={handleVideoDrop}
            >
              <input
                id="source-video"
                type="file"
                accept="video/*"
                ref={formVideoInputRef}
                suppressHydrationWarning
                className="sr-only"
                onChange={handleVideoChange}
              />

              <div className="absolute inset-x-1/4 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-16 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] transition-colors",
                    isDraggingVideo && "border-white/30 bg-white/[0.12]",
                  )}
                >
                  <FileVideo className="size-6 text-white" />
                </div>
                <h2 className="mt-6 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
                  {isDraggingVideo
                    ? "Drop source video here"
                    : videoFile
                      ? "Replace source video"
                      : "Upload source video"}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/62 sm:text-base">
                  Drag a video in from Finder or click to browse, then fill out
                  the brief below.
                </p>
                <div
                  className={cn(
                    "mt-6 min-w-[260px] rounded-2xl border border-dashed border-white/15 bg-black/45 px-5 py-4 transition-colors",
                    isDraggingVideo && "border-white/35 bg-white/[0.08]",
                  )}
                >
                  <p className="text-sm font-medium text-white">
                    {isDraggingVideo
                      ? "Release to attach video"
                      : videoFile?.name ?? "Choose a video file"}
                  </p>
                  <p className="mt-1 text-xs text-white/52">
                    {videoFile
                      ? `${resolution.width}×${resolution.height}`
                      : "MP4, MOV, WebM, AVI, or MKV."}
                  </p>
                </div>
              </div>
            </label>

            {!videoFile ? (
              <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                <ResolutionSelector
                  value={resolution}
                  onChange={setResolution}
                />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <FieldCard
                id="taste"
                name="taste"
                label="Taste prompt"
                title="Taste"
                description="Visual sensibility, pacing, editorial references, and how sharp or rough the output should feel."
                placeholder="Crisp sports-doc energy. Fast cold open. Confident lower thirds. Warm tungsten highlights, tactile textures, punchy cuts."
                icon={WandSparkles}
                iconClassName="text-[var(--accent-cool)]"
              />

              <FieldCard
                id="transcript"
                name="transcript"
                label="Transcript"
                title="Transcript"
                description="Paste the spoken content here or transcribe your video for precise ms-level timing used by the graphics director."
                placeholder="Paste a transcript here, or upload a video and click Transcribe to auto-generate one with timestamps."
                icon={Captions}
                iconClassName="text-white"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                action={
                  <>
                    <button
                      type="button"
                      disabled={!videoFile || isTranscribing}
                      onClick={handleTranscribe}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "cursor-pointer rounded-full border-white/10 bg-white/[0.05] text-white shadow-none hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40",
                      )}
                    >
                      <Captions className="size-3.5" />
                      {isTranscribing ? transcribeStatus ?? "Transcribing…" : "Transcribe"}
                    </button>
                    <label
                      htmlFor="transcript-file"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "cursor-pointer rounded-full border-white/10 bg-white/[0.05] text-white shadow-none hover:bg-white/[0.08]",
                      )}
                    >
                      <Upload className="size-3.5" />
                      {transcriptFileName ? "Replace file" : "Add file"}
                    </label>
                    <input
                      id="transcript-file"
                      type="file"
                      accept=".srt,.vtt,.txt,.md"
                      suppressHydrationWarning
                      className="sr-only"
                      onChange={handleTranscriptFileChange}
                    />
                  </>
                }
              >
                {transcriptFileName ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs text-white/60">
                    Transcript file ready:{" "}
                    <span className="font-medium text-white">
                      {transcriptFileName}
                    </span>
                  </p>
                ) : null}
                {captions && captions.length > 0 ? (
                  <p className="rounded-2xl border border-[#39E508]/20 bg-[#39E508]/[0.06] px-3 py-2 text-center text-xs text-[#39E508]/80">
                    {captions.length} word-level timestamps ready
                  </p>
                ) : null}
              </FieldCard>

              <FieldCard
                id="prompt"
                name="prompt"
                label="Optional instructions"
                title="Prompt"
                description="Optional instructions for structure, beats, or anything the first generation pass should respect."
                placeholder="Open on the strongest emotional line. Keep it under 45 seconds. End with a clean CTA card. Favor direct, modern language."
                icon={Clapperboard}
                iconClassName="text-[var(--accent-cool)]"
              />
            </div>

            {/* Include captions toggle — only shown when captions are available */}
            {captions && captions.length > 0 && (
              <label className="mx-auto flex max-w-xs cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06]">
                <input
                  type="checkbox"
                  checked={includeCaptionLayer}
                  onChange={(e) => setIncludeCaptionLayer(e.target.checked)}
                  className="size-4 accent-[#39E508]"
                />
                <span>
                  Include TikTok-style captions layer
                </span>
              </label>
            )}

            <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-[1.75rem] border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
              <GenerationStatus
                jobState={displayedJobState}
                progress={generationProgress}
                totalLayers={layers.length}
                layerCounts={currentSession ? currentLayerCounts : null}
              />

              {currentSession ? (
                <div className="rounded-[1.35rem] border border-white/10 bg-black/35 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
                        Current local session
                      </p>
                      <p className="mt-1 text-sm text-white/72">
                        {currentLayerCounts.ready}/{layers.length} ready
                        {currentLayerCounts.generating
                          ? ` · ${currentLayerCounts.generating} generating`
                          : ""}
                        {currentLayerCounts.failed
                          ? ` · ${currentLayerCounts.failed} failed`
                          : ""}
                      </p>
                    </div>

                    {currentSession.status !== "running" &&
                    currentSession.layers.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setStep("preview")}
                        className="rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.08]"
                      >
                        Open preview
                      </Button>
                    ) : null}
                  </div>

                  {currentSession.layers.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {currentSession.layers.map((layer) => (
                        <div
                          key={layer.id}
                          className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white/85">
                                {layer.title}
                              </p>
                              <p className="mt-0.5 text-xs text-white/45">
                                {Math.round(
                                  (layer.from / (currentSession.fps ?? 30)) * 10,
                                ) / 10}
                                s -{" "}
                                {Math.round(
                                  ((layer.from + layer.durationInFrames) /
                                    (currentSession.fps ?? 30)) *
                                    10,
                                ) / 10}
                                s
                              </p>
                              <AnimatedProgress
                                {...getLayerProgressState(layer)}
                                className="mt-3 h-1.5"
                              />
                            </div>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em]",
                                layer.status === "ready" &&
                                  "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
                                layer.status === "generating" &&
                                  "border-blue-400/30 bg-blue-500/10 text-blue-200",
                                layer.status === "queued" &&
                                  "border-white/10 bg-white/[0.06] text-white/55",
                                layer.status === "failed" &&
                                  "border-red-400/30 bg-red-500/10 text-red-200",
                              )}
                            >
                              {layer.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-white/55">
                      Waiting for the planner to return the first set of layers.
                    </p>
                  )}
                </div>
              ) : null}

              {recentSessions.length > 0 ? (
                <div className="rounded-[1.35rem] border border-white/10 bg-black/35 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
                        Recent local sessions
                      </p>
                      <p className="mt-1 text-sm text-white/62">
                        Reopen a locally stored generation session in this browser.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {recentSessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => openStoredSession(session.id)}
                        className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white/85">
                            {session.title}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {session.layerCount} layer
                            {session.layerCount === 1 ? "" : "s"} · {session.model}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/55">
                          {session.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-4">
                <ModelSelector
                  value={selectedModel}
                  onChange={setSelectedModel}
                  className="flex-1"
                />
                <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50 transition-colors hover:border-white/15 hover:text-white/70">
                  <input
                    type="checkbox"
                    checked={devMode}
                    onChange={(e) => setDevMode(e.target.checked)}
                    className="rounded border-white/20 accent-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400/50"
                  />
                  Dev Mode
                </label>
              </div>

              {devMode && stageTraces.size > 0 && (
                <PipelineFlowchart
                  traces={stageTraces}
                  onRerunStage={handleRerunStage}
                  isRerunning={isRerunning}
                />
              )}

              <Button
                type="submit"
                size="lg"
                disabled={currentSession?.status === "running"}
                className="h-14 min-w-[240px] self-center rounded-[1.15rem] bg-white px-6 text-black hover:bg-zinc-200"
              >
                <Sparkles className="size-4" />
                {currentSession?.status === "running"
                  ? "Generating Remotion…"
                  : "Generate Remotion"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

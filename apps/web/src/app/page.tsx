"use client"

import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  Captions,
  Clapperboard,
  Download,
  FileVideo,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react"
import dynamic from "next/dynamic"

import { Button, buttonVariants } from "@/components/ui/button"
import { ModelSelector } from "@/components/ui/model-selector"
import {
  ResolutionSelector,
  type Resolution,
} from "@/components/ui/resolution-selector"
import { FieldCard } from "@/components/upload/field-card"
import {
  GenerationStatus,
  type JobState,
} from "@/components/upload/generation-status"
import { getVideoMeta } from "@/helpers/video-meta"
import type {
  FerroGenerateResponse,
  FerroLayer,
  FerroRenderJobAcceptedResponse,
  FerroRenderJobResponse,
  FerroRenderMode,
  FerroRenderPayload,
} from "@/lib/ferro-contracts"
import { cn } from "@/lib/utils"

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

const CompositorPreview = dynamic(
  () =>
    import("@/components/preview/CompositorPreview").then(
      (module) => module.CompositorPreview,
    ),
  {
    ssr: false,
  },
)

const GraphicCard = dynamic(
  () =>
    import("@/components/preview/GraphicCard").then(
      (module) => module.GraphicCard,
    ),
  {
    ssr: false,
  },
)

function isLikelyVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true
  const lowerName = file.name.toLowerCase()
  return supportedVideoExtensions.some((ext) => lowerName.endsWith(ext))
}

function getLayerCardKey(layer: FerroLayer, index: number) {
  let hash = 0

  for (let i = 0; i < layer.code.length; i += 1) {
    hash = (hash * 31 + layer.code.charCodeAt(i)) >>> 0
  }

  return `${index}-${hash}`
}

export default function Home() {
  const [step, setStep] = useState<"form" | "preview">("form")
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const [clientDownloadUrl, setClientDownloadUrl] = useState<string | null>(null)
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(
    null,
  )
  const [jobState, setJobState] = useState<JobState>(initialJobState)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [selectedModel, setSelectedModel] = useState(
    "anthropic:claude-sonnet-4-6",
  )
  const [resolution, setResolution] = useState<Resolution>({
    width: 1920,
    height: 1080,
  })
  const [generationResult, setGenerationResult] =
    useState<FerroGenerateResponse | null>(null)
  const [layers, setLayers] = useState<FerroLayer[]>([])
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

  const videoInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const dragDepthRef = useRef(0)

  useEffect(() => {
    function preventWindowFileDrop(event: globalThis.DragEvent) {
      const items = event.dataTransfer?.items
      const hasFiles = items
        ? Array.from(items).some((item) => item.kind === "file")
        : false
      if (!hasFiles) return
      event.preventDefault()
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

  function syncVideoInput(file: File | null) {
    const input = videoInputRef.current
    if (!input || typeof DataTransfer === "undefined") return
    const transfer = new DataTransfer()
    if (file) transfer.items.add(file)
    input.files = transfer.files
  }

  async function attachVideoFile(file: File | null) {
    if (!file) {
      setVideoFile(null)
      syncVideoInput(null)
      setJobState(initialJobState)
      return
    }

    if (!isLikelyVideoFile(file)) {
      setVideoFile(null)
      syncVideoInput(null)
      setJobState({
        tone: "error",
        title: "Unsupported file",
        detail:
          "Drop or choose a video file such as MP4, MOV, WebM, AVI, or MKV.",
      })
      return
    }

    setVideoFile(file)
    syncVideoInput(file)
    setJobState({
      tone: "idle",
      title: "Source video attached",
      detail: "Fill in the remaining fields and hit Generate when ready.",
    })

    try {
      const meta = await getVideoMeta(file)
      setResolution({ width: meta.width, height: meta.height })
    } catch {
      // Keep current resolution if we can't read metadata
    }
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    void attachVideoFile(file)
  }

  function handleTranscriptFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setTranscriptFileName(file?.name ?? null)
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
      setJobState({
        tone: "error",
        title: "Nothing to generate",
        detail:
          "Fill in at least one field — taste, transcript, or instructions.",
      })
      return
    }

    setJobState({
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

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taste,
          transcript,
          instructions,
          model: selectedModel,
          width: resolution.width,
          height: resolution.height,
          videoDurationSeconds,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const data: FerroGenerateResponse = await res.json()

      if (videoFile) {
        if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl)
        setVideoObjectUrl(URL.createObjectURL(videoFile))
      }

      setRenderJob(null)
      setRenderJobId(null)
      setRenderProgress(null)
      setRenderError(null)
      setRenderMessage("Choose a render mode, then export.")
      setGenerationResult(data)
      setLayers(data.layers)
      setStep("preview")
    } catch (error) {
      setJobState({
        tone: "error",
        title: "Generation failed",
        detail: error instanceof Error ? error.message : "Something went wrong.",
      })
    }
  }

  function handleLayerCodeChange(index: number, code: string) {
    setLayers((prev) =>
      prev.map((layer, i) => (i === index ? { ...layer, code } : layer)),
    )
  }

  function getRenderPayload(): FerroRenderPayload | null {
    if (!generationResult) return null

    return {
      layers,
      fps: generationResult.fps,
      width: generationResult.width,
      height: generationResult.height,
      durationInFrames: generationResult.durationInFrames,
    }
  }

  function downloadFromUrl(url: string, filename: string) {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
  }

  async function handleServerRender() {
    const payload = getRenderPayload()
    if (!payload) return

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
    const payload = getRenderPayload()
    if (!payload) return

    setIsClientRendering(true)
    setRenderError(null)
    setRenderProgress(null)
    setRenderMessage("Checking browser render support...")
    setRenderJob(null)
    setRenderJobId(null)

    try {
      const { checkBrowserRenderSupport, exportInBrowser } = await import(
        "@/remotion/client-render"
      )

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

  const payload = getRenderPayload()
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
  const serverDownloadUrl =
    renderJob?.status === "complete" ? renderJob.downloadUrl : null

  if (step === "preview" && generationResult) {
    return (
      <main className="min-h-screen px-4 py-8 text-white sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8 flex items-center gap-4">
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
            <div className="flex gap-2">
              {generationResult.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/55"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

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
                  Server rendering is primary for development. Browser rendering
                  stays available as a fallback when the server path is
                  unavailable or unsupported.
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
                  {renderMessage}
                </p>
                {payload ? (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-white/38">
                    {payload.width}×{payload.height} · {payload.fps}fps ·{" "}
                    {payload.durationInFrames} frames
                  </p>
                ) : null}
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
                  disabled={isExporting}
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
                      serverDownloadUrl
                        ? downloadFromUrl(
                            serverDownloadUrl,
                            `ferro-server-render-${renderJob.jobId}.mp4`,
                          )
                        : undefined
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

          <div className="mb-8">
            <CompositorPreview
              videoObjectUrl={videoObjectUrl}
              layers={layers}
              fps={generationResult.fps}
              width={generationResult.width}
              height={generationResult.height}
              durationInFrames={generationResult.durationInFrames}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {layers.map((layer, i) => (
              <GraphicCard
                key={getLayerCardKey(layer, i)}
                layer={layer}
                fps={generationResult.fps}
                width={generationResult.width}
                height={generationResult.height}
                onCodeChange={(code) => handleLayerCodeChange(i, code)}
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

          <form ref={formRef} className="space-y-6" onSubmit={handleGenerate}>
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
                ref={videoInputRef}
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
                <ResolutionSelector value={resolution} onChange={setResolution} />
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
                description="Paste the spoken content here. Used to plan timing, pull quotes, and name lower thirds."
                placeholder="Paste the transcript here, or attach a transcript file and keep notes in this box for timing cues, pull quotes, and selects."
                icon={Captions}
                iconClassName="text-white"
                action={
                  <>
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

            <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-[1.75rem] border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
              <GenerationStatus jobState={jobState} />

              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                className="w-full"
              />

              <Button
                type="button"
                size="lg"
                onClick={() => formRef.current?.requestSubmit()}
                className="h-14 min-w-[240px] rounded-[1.15rem] bg-white px-6 text-black hover:bg-zinc-200"
              >
                <Sparkles className="size-4" />
                Generate Remotion
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

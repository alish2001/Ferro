"use client"

import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  Captions,
  Clapperboard,
  FileVideo,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react"

import { FieldCard } from "@/components/upload/field-card"
import {
  GenerationStatus,
  type JobState,
} from "@/components/upload/generation-status"
import { Button, buttonVariants } from "@/components/ui/button"
import { ModelSelector } from "@/components/ui/model-selector"
import { ResolutionSelector, type Resolution } from "@/components/ui/resolution-selector"
import { CompositorPreview } from "@/components/preview/CompositorPreview"
import { GraphicCard } from "@/components/preview/GraphicCard"
import { getVideoMeta } from "@/helpers/video-meta"
import type { FerroGenerateResponse, FerroLayer } from "@/app/api/generate/route"
import { cn } from "@/lib/utils"

const initialJobState: JobState = {
  tone: "idle",
  title: "Ready to generate",
  detail: "Fill in the fields below, then hit Generate.",
}

const supportedVideoExtensions = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"]

function isLikelyVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true
  const lowerName = file.name.toLowerCase()
  return supportedVideoExtensions.some((ext) => lowerName.endsWith(ext))
}

export default function Home() {
  const [step, setStep] = useState<"form" | "preview">("form")
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(null)
  const [jobState, setJobState] = useState<JobState>(initialJobState)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [selectedModel, setSelectedModel] = useState("anthropic:claude-sonnet-4-6")
  const [resolution, setResolution] = useState<Resolution>({ width: 1920, height: 1080 })
  const [generationResult, setGenerationResult] = useState<FerroGenerateResponse | null>(null)
  const [layers, setLayers] = useState<FerroLayer[]>([])

  const videoInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)

  useEffect(() => {
    function preventWindowFileDrop(event: globalThis.DragEvent) {
      const items = event.dataTransfer?.items
      const hasFiles = items ? Array.from(items).some((item) => item.kind === "file") : false
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

  // Revoke previous object URL when video changes
  useEffect(() => {
    return () => {
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl)
    }
  }, [videoObjectUrl])

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
        detail: "Drop or choose a video file such as MP4, MOV, WebM, AVI, or MKV.",
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

    // Read video dimensions + duration
    try {
      const meta = await getVideoMeta(file)
      setResolution({ width: meta.width, height: meta.height })
    } catch {
      // Keep current resolution if we can't read metadata
    }
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    attachVideoFile(file)
  }

  function handleTranscriptFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setTranscriptFileName(file?.name ?? null)
  }

  function handleVideoDragEnter(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some((item) => item.kind === "file")
    if (!hasFiles) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingVideo(true)
  }

  function handleVideoDragOver(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some((item) => item.kind === "file")
    if (!hasFiles) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setIsDraggingVideo(true)
  }

  function handleVideoDragLeave(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some((item) => item.kind === "file")
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
    attachVideoFile(file)
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
        detail: "Fill in at least one field — taste, transcript, or instructions.",
      })
      return
    }

    setJobState({
      tone: "loading",
      title: "Generating graphics…",
      detail: "Detecting skills, planning layers, and generating code in parallel.",
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

      // Create a fresh object URL for the compositor
      if (videoFile) {
        if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl)
        setVideoObjectUrl(URL.createObjectURL(videoFile))
      }

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

  if (step === "preview" && generationResult) {
    return (
      <main className="min-h-screen px-4 py-8 text-white sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">
          {/* Back button */}
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

          {/* Compositor preview */}
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

          {/* Per-layer cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {layers.map((layer, i) => (
              <GraphicCard
                key={i}
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
              Source video on top. Taste, transcript, and prompt underneath. Generate AI-powered motion graphics overlays.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleGenerate}>
            <label
              htmlFor="source-video"
              className={cn(
                "group relative block cursor-pointer overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.035] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.05] sm:p-10",
                isDraggingVideo && "border-white/35 bg-white/[0.08]"
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
                    isDraggingVideo && "border-white/30 bg-white/[0.12]"
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
                  Drag a video in from Finder or click to browse, then fill out the brief below.
                </p>
                <div
                  className={cn(
                    "mt-6 min-w-[260px] rounded-2xl border border-dashed border-white/15 bg-black/45 px-5 py-4 transition-colors",
                    isDraggingVideo && "border-white/35 bg-white/[0.08]"
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

            {/* Resolution selector — only shown when no video is attached */}
            {!videoFile && (
              <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                <ResolutionSelector value={resolution} onChange={setResolution} />
              </div>
            )}

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
                        "cursor-pointer rounded-full border-white/10 bg-white/[0.05] text-white shadow-none hover:bg-white/[0.08]"
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
                    <span className="font-medium text-white">{transcriptFileName}</span>
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
                type="submit"
                size="lg"
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

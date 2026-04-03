"use client"

import type { ChangeEvent, DragEvent, FormEvent } from "react"
import { useEffect, useRef, useState } from "react"
import {
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
import { cn } from "@/lib/utils"

const initialJobState: JobState = {
  tone: "idle",
  title: "Ready to generate",
  detail:
    "The button is stubbed for now. The actual render pipeline can plug into this next.",
}

const uploadTags = ["Source video", "Transcript", "Prompt"]
const supportedVideoExtensions = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"]

function isLikelyVideoFile(file: File) {
  if (file.type.startsWith("video/")) {
    return true
  }

  const lowerName = file.name.toLowerCase()
  return supportedVideoExtensions.some((extension) => lowerName.endsWith(extension))
}

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(
    null
  )
  const [jobState, setJobState] = useState<JobState>(initialJobState)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)

  useEffect(() => {
    function preventWindowFileDrop(event: globalThis.DragEvent) {
      const items = event.dataTransfer?.items
      const hasFiles = items
        ? Array.from(items).some((item) => item.kind === "file")
        : false

      if (!hasFiles) {
        return
      }

      event.preventDefault()
    }

    window.addEventListener("dragover", preventWindowFileDrop)
    window.addEventListener("drop", preventWindowFileDrop)

    return () => {
      window.removeEventListener("dragover", preventWindowFileDrop)
      window.removeEventListener("drop", preventWindowFileDrop)
    }
  }, [])

  function syncVideoInput(file: File | null) {
    const input = videoInputRef.current

    if (!input || typeof DataTransfer === "undefined") {
      return
    }

    const transfer = new DataTransfer()

    if (file) {
      transfer.items.add(file)
    }

    input.files = transfer.files
  }

  function attachVideoFile(file: File | null) {
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
      detail:
        "Fill in the remaining fields and use the button below when you are ready.",
    })
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
    const hasFiles = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === "file"
    )

    if (!hasFiles) {
      return
    }

    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingVideo(true)
  }

  function handleVideoDragOver(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === "file"
    )

    if (!hasFiles) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setIsDraggingVideo(true)
  }

  function handleVideoDragLeave(event: DragEvent<HTMLLabelElement>) {
    const hasFiles = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === "file"
    )

    if (!hasFiles) {
      return
    }

    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

    if (dragDepthRef.current === 0) {
      setIsDraggingVideo(false)
    }
  }

  function handleVideoDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingVideo(false)

    const file = event.dataTransfer.files?.[0] ?? null
    attachVideoFile(file)
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!videoFile || !isLikelyVideoFile(videoFile)) {
      setJobState({
        tone: "error",
        title: "Source video missing",
        detail:
          "Upload a source video first.",
      })
      return
    }

    setJobState({
      tone: "success",
      title: "Generate button pressed",
      detail:
        "The callback is stubbed and ready for the next pass.",
    })
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
              Everything centered. The generate action stays stubbed for now.
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
                    MP4, MOV, WebM, AVI, or MKV.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {uploadTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.26em] text-white/45"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </label>

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
                description="Paste the spoken content here. The ticket also calls for a transcript-file path, so this card includes a small upload stub too."
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

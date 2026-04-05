import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useRef, useState } from "react"

import type {
  FerroCaption,
  FerroGenerationSession,
} from "@/lib/ferro-contracts"
import type { TranscribeStreamEvent } from "@/app/api/transcribe/route"
import type { Resolution } from "@/components/ui/resolution-selector"
import type { JobState } from "@/components/upload/generation-status"
import type { UpdateSessionFn } from "@/hooks/use-generation-session"
import { getVideoMeta } from "@/helpers/video-meta"
import { readNdjsonStream } from "@/lib/ndjson"

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

interface UseVideoOptions {
  updateSession: UpdateSessionFn
  setFallbackJobState: (state: JobState) => void
  initialJobState: JobState
}

export function useVideo({
  updateSession,
  setFallbackJobState,
  initialJobState,
}: UseVideoOptions) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [resolution, setResolution] = useState<Resolution>({
    width: 1920,
    height: 1080,
  })

  // Transcription state
  const [transcriptText, setTranscriptText] = useState("")
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(
    null,
  )
  const [captions, setCaptions] = useState<FerroCaption[] | null>(null)
  const [detectedVideoFps, setDetectedVideoFps] = useState<number | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeStatus, setTranscribeStatus] = useState<string | null>(null)
  const [includeCaptionLayer, setIncludeCaptionLayer] = useState(false)

  const formVideoInputRef = useRef<HTMLInputElement>(null)
  const previewVideoInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl)
    }
  }, [videoObjectUrl])

  function syncVideoInputs(file: File | null) {
    if (typeof DataTransfer === "undefined") return

    for (const input of [
      formVideoInputRef.current,
      previewVideoInputRef.current,
    ]) {
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

  function resetVideoState() {
    setTranscriptFileName(null)
    setVideoFile(null)
    syncVideoInputs(null)
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl)
      setVideoObjectUrl(null)
    }
  }

  function restoreSessionVideo(session: FerroGenerationSession) {
    setResolution({ width: session.width, height: session.height })
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
      file
        .text()
        .then((text) => setTranscriptText(text))
        .catch(() => null)
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
            setTranscribeStatus(
              `Transcribing… ${Math.round(event.pct * 100)}%`,
            )
            break
          case "segment": {
            const { startMs, endMs, text } = event.segment
            const fmt = (ms: number) => (ms / 1000).toFixed(2) + "s"
            segmentBuffer += `[${fmt(startMs)} → ${fmt(endMs)}] ${text}\n`
            setTranscriptText(segmentBuffer)
            break
          }
          case "captions": {
            const mapped: FerroCaption[] = event.captions.map((c) => ({
              text: c.text,
              startMs: c.startMs,
              endMs: c.endMs,
            }))
            setCaptions(mapped)
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

  return {
    videoFile,
    videoObjectUrl,
    isDraggingVideo,
    resolution,
    setResolution,
    transcriptText,
    setTranscriptText,
    transcriptFileName,
    captions,
    detectedVideoFps,
    isTranscribing,
    transcribeStatus,
    includeCaptionLayer,
    setIncludeCaptionLayer,
    formVideoInputRef,
    previewVideoInputRef,
    attachVideoFile,
    resetVideoState,
    restoreSessionVideo,
    handleVideoChange,
    handlePreviewVideoChange,
    handleTranscriptFileChange,
    handleTranscribe,
    handleVideoDragEnter,
    handleVideoDragOver,
    handleVideoDragLeave,
    handleVideoDrop,
  }
}

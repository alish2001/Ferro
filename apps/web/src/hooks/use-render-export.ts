import { useEffect, useState } from "react"

import type {
  FerroRenderJobAcceptedResponse,
  FerroRenderJobResponse,
  FerroRenderMode,
  FerroRenderPayload,
} from "@/lib/ferro-contracts"
import {
  checkBrowserRenderSupport,
  exportInBrowser,
} from "@/remotion/client-render"

function downloadFromUrl(url: string, filename: string) {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
}

interface UseRenderExportOptions {
  payload: FerroRenderPayload | null
  videoFile: File | null
  videoObjectUrl: string | null
  needsVideoReattach: boolean
}

export function useRenderExport({
  payload,
  videoFile,
  videoObjectUrl,
  needsVideoReattach,
}: UseRenderExportOptions) {
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
  const [clientDownloadUrl, setClientDownloadUrl] = useState<string | null>(null)

  // Cleanup client download URL
  useEffect(() => {
    return () => {
      if (clientDownloadUrl) URL.revokeObjectURL(clientDownloadUrl)
    }
  }, [clientDownloadUrl])

  // Poll render job with exponential backoff (fix #13)
  useEffect(() => {
    if (!renderJobId) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let pollInterval = 1000

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
          timeoutId = setTimeout(poll, pollInterval)
          pollInterval = Math.min(pollInterval * 2, 8000)
          return
        }

        if (data.status === "rendering") {
          setRenderMessage("Server render in progress.")
          // Reset to fast polling when actively rendering
          pollInterval = 1000
          timeoutId = setTimeout(poll, pollInterval)
          return
        }

        if (data.status === "complete") {
          setRenderError(data.error)
          setRenderMessage(
            data.downloadUrl
              ? "Server render finished. Download the MP4 when ready."
              : (data.error ??
                  "Server render finished, but the MP4 is unavailable."),
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

  return {
    renderMode,
    setRenderMode,
    renderJob,
    renderProgress,
    renderMessage,
    renderError,
    isExporting,
    serverIsBusy,
    isStartingServerRender,
    canDownloadServer,
    canRetryClient,
    canDownloadClient,
    clientDownloadUrl,
    handleExport,
    resetRenderState,
    downloadFromUrl,
  }
}

"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { FormView } from "@/components/form-view"
import { PreviewView } from "@/components/preview-view"
import { ThemeSelector } from "@/components/ui/theme-selector"
import type {
  FerroGenerateRequest,
  FerroGenerateStreamEvent,
  FerroLayerEditStreamEvent,
  FerroLayerMessage,
} from "@/lib/ferro-contracts"
import { markRunningSessionsInterrupted } from "@/lib/local-generation-store"
import { readNdjsonStream } from "@/lib/ndjson"
import { getVideoMeta } from "@/helpers/video-meta"
import {
  useGenerationSession,
  createVersion,
} from "@/hooks/use-generation-session"

// Preload preview chunks when generation starts so they're ready when we switch to preview
function preloadPreviewChunks() {
  void import("@remotion/player")
  void import("@/components/preview/CompositorPreview")
  void import("@/components/preview/GraphicCard")
}
import { useVideo } from "@/hooks/use-video"
import { useRenderExport } from "@/hooks/use-render-export"
import { useDevMode, loadStageTraces } from "@/hooks/use-dev-mode"

export default function Home() {
  const [step, setStep] = useState<"form" | "preview">("form")
  const [selectedModel, setSelectedModel] = useState(
    "anthropic:claude-sonnet-4-6",
  )
  const prefersReducedMotion = useReducedMotion()
  const stepMotionTransition = useMemo(
    () => ({
      duration: prefersReducedMotion ? 0 : 0.22,
      ease: [0.22, 1, 0.36, 1] as const,
    }),
    [prefersReducedMotion],
  )

  const session = useGenerationSession()
  const video = useVideo({
    updateSession: session.updateSession,
    setFallbackJobState: session.setFallbackJobState,
    initialJobState: session.initialJobState,
  })

  const needsVideoReattach = Boolean(
    session.currentSession?.request.hasSourceVideo && !video.videoObjectUrl,
  )

  const render = useRenderExport({
    payload: session.payload,
    videoFile: video.videoFile,
    videoObjectUrl: video.videoObjectUrl,
    needsVideoReattach,
  })

  const dev = useDevMode(session.currentSession, session.updateSession)

  // Focus management: move focus to preview when step changes
  const previewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (step === "preview") {
      previewRef.current?.focus()
    }
  }, [step])

  // Mount: restore interrupted sessions and setup drag prevention
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
    session.refreshRecentSessions()

    if (interruptedSessions[0]) {
      const interrupted = interruptedSessions[0]
      session.commitSession(interrupted, true)
      setSelectedModel(interrupted.request.model)
      video.restoreSessionVideo(interrupted)
      dev.setStageTraces(loadStageTraces(interrupted.id))
    }

    window.addEventListener("dragover", preventWindowFileDrop)
    window.addEventListener("drop", preventWindowFileDrop)

    return () => {
      window.removeEventListener("dragover", preventWindowFileDrop)
      window.removeEventListener("drop", preventWindowFileDrop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openStoredSession(sessionId: string) {
    const restored = session.openStoredSession(sessionId)
    if (!restored) return

    setSelectedModel(restored.request.model)
    video.restoreSessionVideo(restored)
    render.resetRenderState()
    dev.setStageTraces(loadStageTraces(sessionId))
    setStep(restored.layers.length > 0 ? "preview" : "form")
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const taste = (formData.get("taste") as string) ?? ""
    const transcript = (formData.get("transcript") as string) ?? ""
    const instructions = (formData.get("prompt") as string) ?? ""
    const finalTranscript = video.transcriptText || transcript
    const hasCaptionData = Boolean(video.captions?.length)

    if (
      !taste.trim() &&
      !finalTranscript.trim() &&
      !instructions.trim() &&
      !hasCaptionData
    ) {
      session.setFallbackJobState({
        tone: "error",
        title: "Nothing to generate",
        detail:
          "Add taste, transcript, instructions, or attach caption timing before generating.",
      })
      return
    }

    session.commitSession(null, true)
    setStep("form")
    render.resetRenderState()
    dev.setStageTraces(new Map())
    session.setFallbackJobState({
      tone: "loading",
      title: "Generating graphics…",
      detail:
        "Detecting skills, planning layers, and generating code in parallel.",
    })

    // Warm preview chunks while generation runs
    preloadPreviewChunks()

    const request: FerroGenerateRequest = {
      taste,
      transcript: finalTranscript,
      instructions,
      model: selectedModel,
      width: video.resolution.width,
      height: video.resolution.height,
      videoDurationSeconds: undefined,
      videoFps: video.detectedVideoFps ?? undefined,
      hasSourceVideo: Boolean(video.videoFile),
      sourceVideoName: video.videoFile?.name ?? null,
      captions: video.captions ?? undefined,
      includeCaptionLayer: video.includeCaptionLayer || undefined,
      devMode: dev.devMode || undefined,
    }

    // Get video meta in parallel with fetch (fix #12)
    const metaPromise = video.videoFile
      ? getVideoMeta(video.videoFile).catch(() => null)
      : Promise.resolve(null)

    try {
      const [res, meta] = await Promise.all([
        fetch("/api/generate/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...request,
            videoDurationSeconds: undefined, // Will be set below if available
          }),
        }),
        metaPromise,
      ])

      // If we got meta, update the request with duration
      if (meta) {
        request.videoDurationSeconds = meta.durationSeconds
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      await readNdjsonStream<FerroGenerateStreamEvent>(
        res,
        async (streamEvent) => {
          switch (streamEvent.type) {
            case "job-started": {
              session.commitSession({
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
              session.updateSession((s) => ({
                ...s,
                skills: streamEvent.skills,
                updatedAt: new Date().toISOString(),
              }))
              break
            }
            case "plan-ready": {
              session.updateSession((s) => ({
                ...s,
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
              session.updateSession((s) => ({
                ...s,
                layers: s.layers.map((layer) =>
                  layer.id === streamEvent.layerId
                    ? { ...layer, status: "generating", error: null }
                    : layer,
                ),
                updatedAt: new Date().toISOString(),
              }))
              break
            }
            case "layer-completed": {
              session.updateSession((s) => ({
                ...s,
                layers: s.layers.map((layer) =>
                  layer.id === streamEvent.layer.id
                    ? streamEvent.layer
                    : layer,
                ),
                versions: [...s.versions, streamEvent.version],
                updatedAt: new Date().toISOString(),
              }))
              break
            }
            case "layer-failed": {
              session.updateSession((s) => ({
                ...s,
                layers: s.layers.map((layer) =>
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
              session.updateSession((s) => ({
                ...s,
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
              session.flushSession()
              setStep("preview")
              break
            }
            case "job-failed": {
              session.updateSession((s) => ({
                ...s,
                status: "failed",
                error: streamEvent.error,
                updatedAt: streamEvent.completedAt,
                completedAt: streamEvent.completedAt,
              }))
              session.flushSession()
              break
            }
            case "debug-stage-update": {
              dev.handleStageTraceUpdate(
                streamEvent.generationId,
                streamEvent.trace,
              )
              break
            }
          }
        },
      )
    } catch (error) {
      session.updateSession((s) => ({
        ...s,
        status: "failed",
        error: error instanceof Error ? error.message : "Generation failed",
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }))
      session.flushSession()

      session.setFallbackJobState({
        tone: "error",
        title: "Generation failed",
        detail:
          error instanceof Error ? error.message : "Something went wrong.",
      })
    }
  }

  function handleLayerCodeChange(layerId: string, code: string) {
    const version = createVersion("manual", layerId, code)

    session.updateSession((s) => ({
      ...s,
      layers: s.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, code, currentVersionId: version.id, error: null }
          : layer,
      ),
      versions: [...s.versions, version],
      updatedAt: version.createdAt,
    }))
  }

  async function handleLayerEditPrompt(layerId: string, prompt: string) {
    const currentSessionSnapshot = session.sessionRef.current
    if (!currentSessionSnapshot) return

    const layer = currentSessionSnapshot.layers.find(
      (candidate) => candidate.id === layerId,
    )
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
      ...(session.messagesByLayer.get(layerId) ?? []).filter(
        (message) => message.status === "complete",
      ),
      userMessage,
    ]

    session.updateSession((activeSession) => ({
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
          generationId: currentSessionSnapshot.id,
          layerId,
          model: currentSessionSnapshot.request.model,
          skills: currentSessionSnapshot.skills,
          layer,
          currentCode: layer.code,
          messages: requestMessages,
        }),
      })

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Layer edit failed" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      await readNdjsonStream<FerroLayerEditStreamEvent>(
        res,
        async (streamEvent) => {
          switch (streamEvent.type) {
            case "edit-started":
              break
            case "edit-completed": {
              session.updateSession((activeSession) => ({
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
              session.updateSession((activeSession) => ({
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
        },
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Layer edit failed"

      session.updateSession((activeSession) => ({
        ...activeSession,
        messages: activeSession.messages.map((candidate) =>
          candidate.id === pendingAssistantMessage.id
            ? { ...candidate, text: message, status: "failed" }
            : candidate,
        ),
        updatedAt: new Date().toISOString(),
      }))
    }
  }

  const previewSession = session.currentSession
  const showPreview =
    step === "preview" &&
    Boolean(previewSession && previewSession.layers.length > 0)

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-end p-4 sm:p-6">
        <div className="pointer-events-auto">
          <ThemeSelector />
        </div>
      </div>
      <div className="pt-14 sm:pt-16">
      <AnimatePresence mode="wait">
      {showPreview && previewSession ? (
        <motion.div
          key="preview"
          initial={{
            opacity: prefersReducedMotion ? 1 : 0,
            y: prefersReducedMotion ? 0 : 10,
          }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: prefersReducedMotion ? 1 : 0,
            y: prefersReducedMotion ? 0 : -8,
          }}
          transition={stepMotionTransition}
        >
          <PreviewView
            ref={previewRef}
            session={previewSession}
            videoObjectUrl={video.videoObjectUrl}
            needsVideoReattach={needsVideoReattach}
            payload={session.payload}
            messagesByLayer={session.messagesByLayer}
            versionsByLayer={session.versionsByLayer}
            renderMode={render.renderMode}
            setRenderMode={render.setRenderMode}
            renderJob={render.renderJob}
            renderProgress={render.renderProgress}
            renderMessage={render.renderMessage}
            renderError={render.renderError}
            isExporting={render.isExporting}
            serverIsBusy={render.serverIsBusy}
            canDownloadServer={render.canDownloadServer}
            canRetryClient={render.canRetryClient}
            canDownloadClient={render.canDownloadClient}
            clientDownloadUrl={render.clientDownloadUrl}
            handleExport={render.handleExport}
            downloadFromUrl={render.downloadFromUrl}
            devMode={dev.devMode}
            stageTraces={dev.stageTraces}
            isRerunning={dev.isRerunning}
            handleRerunStage={dev.handleRerunStage}
            onBackToForm={() => setStep("form")}
            previewVideoInputRef={video.previewVideoInputRef}
            handlePreviewVideoChange={video.handlePreviewVideoChange}
            onLayerCodeChange={handleLayerCodeChange}
            onLayerEditPrompt={handleLayerEditPrompt}
          />
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{
            opacity: prefersReducedMotion ? 1 : 0,
            y: prefersReducedMotion ? 0 : 10,
          }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: prefersReducedMotion ? 1 : 0,
            y: prefersReducedMotion ? 0 : -8,
          }}
          transition={stepMotionTransition}
        >
          <FormView
            videoFile={video.videoFile}
            isDraggingVideo={video.isDraggingVideo}
            resolution={video.resolution}
            setResolution={video.setResolution}
            formVideoInputRef={video.formVideoInputRef}
            handleVideoChange={video.handleVideoChange}
            handleVideoDragEnter={video.handleVideoDragEnter}
            handleVideoDragOver={video.handleVideoDragOver}
            handleVideoDragLeave={video.handleVideoDragLeave}
            handleVideoDrop={video.handleVideoDrop}
            transcriptText={video.transcriptText}
            setTranscriptText={video.setTranscriptText}
            transcriptFileName={video.transcriptFileName}
            captions={video.captions}
            detectedVideoFps={video.detectedVideoFps}
            isTranscribing={video.isTranscribing}
            transcribeStatus={video.transcribeStatus}
            includeCaptionLayer={video.includeCaptionLayer}
            setIncludeCaptionLayer={video.setIncludeCaptionLayer}
            handleTranscriptFileChange={video.handleTranscriptFileChange}
            handleTranscribe={video.handleTranscribe}
            currentSession={session.currentSession}
            layers={session.layers}
            layerCounts={session.layerCounts}
            displayedJobState={session.displayedJobState}
            generationProgress={session.generationProgress}
            recentSessions={session.recentSessions}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            devMode={dev.devMode}
            toggleDevMode={dev.toggleDevMode}
            stageTraces={dev.stageTraces}
            isRerunning={dev.isRerunning}
            handleRerunStage={dev.handleRerunStage}
            onGenerate={handleGenerate}
            onOpenPreview={() => setStep("preview")}
            onOpenStoredSession={openStoredSession}
          />
        </motion.div>
      )}
    </AnimatePresence>
      </div>
    </>
  )
}

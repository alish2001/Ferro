"use client"

import type { FormEvent } from "react"
import { useMemo } from "react"
import {
  Captions,
  Clapperboard,
  FileVideo,
  Loader2,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

import { PipelineFlowchart } from "@/components/dev-mode/pipeline-flowchart"
import { HeroBackdrop } from "@/components/hero-backdrop"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import { Button, buttonVariants } from "@/components/ui/button"
import { ModelSelector } from "@/components/ui/model-selector"
import { ResolutionSelector } from "@/components/ui/resolution-selector"
import { FieldCard } from "@/components/upload/field-card"
import { TranscriptionDebugPanel } from "@/components/upload/transcription-debug-panel"
import {
  GenerationStatus,
  type GenerationCounts,
  type JobState,
} from "@/components/upload/generation-status"
import type {
  DevModeStageTrace,
  FerroCaption,
  FerroGenerationSession,
  FerroLayer,
} from "@/lib/ferro-contracts"
import type { Resolution } from "@/components/ui/resolution-selector"
import { StatusPill } from "@/components/ui/status-pill"
import { getLayerProgressState } from "@/hooks/use-generation-session"
import { cn } from "@/lib/utils"

interface FormViewProps {
  videoFile: File | null
  isDraggingVideo: boolean
  resolution: Resolution
  setResolution: (r: Resolution) => void
  formVideoInputRef: React.RefObject<HTMLInputElement | null>
  handleVideoChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleVideoDragEnter: (event: React.DragEvent<HTMLLabelElement>) => void
  handleVideoDragOver: (event: React.DragEvent<HTMLLabelElement>) => void
  handleVideoDragLeave: (event: React.DragEvent<HTMLLabelElement>) => void
  handleVideoDrop: (event: React.DragEvent<HTMLLabelElement>) => void
  transcriptText: string
  setTranscriptText: (text: string) => void
  transcriptFileName: string | null
  captions: FerroCaption[] | null
  detectedVideoFps: number | null
  isTranscribing: boolean
  transcribeStatus: string | null
  includeCaptionLayer: boolean
  setIncludeCaptionLayer: (checked: boolean) => void
  handleTranscriptFileChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void
  handleTranscribe: () => void
  currentSession: FerroGenerationSession | null
  layers: FerroLayer[]
  layerCounts: GenerationCounts
  displayedJobState: JobState
  generationProgress: number | null
  recentSessions: {
    id: string
    title: string
    status: string
    model: string
    layerCount: number
  }[]
  selectedModel: string
  setSelectedModel: (model: string) => void
  devMode: boolean
  toggleDevMode: (on: boolean) => void
  stageTraces: Map<string, DevModeStageTrace>
  isRerunning: boolean
  handleRerunStage: (
    stageId: string,
    overrides: { systemPrompt?: string; userPrompt?: string },
    cascade: boolean,
  ) => void
  onGenerate: (event: FormEvent<HTMLFormElement>) => void
  onOpenPreview: () => void
  onOpenStoredSession: (sessionId: string) => void
}

export function FormView({
  videoFile,
  isDraggingVideo,
  resolution,
  setResolution,
  formVideoInputRef,
  handleVideoChange,
  handleVideoDragEnter,
  handleVideoDragOver,
  handleVideoDragLeave,
  handleVideoDrop,
  transcriptText,
  setTranscriptText,
  transcriptFileName,
  captions,
  detectedVideoFps,
  isTranscribing,
  transcribeStatus,
  includeCaptionLayer,
  setIncludeCaptionLayer,
  handleTranscriptFileChange,
  handleTranscribe,
  currentSession,
  layers,
  layerCounts,
  displayedJobState,
  generationProgress,
  recentSessions,
  selectedModel,
  setSelectedModel,
  devMode,
  toggleDevMode,
  stageTraces,
  isRerunning,
  handleRerunStage,
  onGenerate,
  onOpenPreview,
  onOpenStoredSession,
}: FormViewProps) {
  const prefersReducedMotion = useReducedMotion()

  const fieldGridVariants = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: {
          staggerChildren: prefersReducedMotion ? 0 : 0.07,
          delayChildren: prefersReducedMotion ? 0 : 0.04,
        },
      },
    }),
    [prefersReducedMotion],
  )

  const fieldItemVariants = useMemo(
    () => ({
      hidden: prefersReducedMotion
        ? { opacity: 1, y: 0 }
        : { opacity: 0, y: 12 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0 : 0.24,
          ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
      },
    }),
    [prefersReducedMotion],
  )

  return (
    <main className="min-h-screen px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-6xl">
        <form
          className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:gap-y-0 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-x-14"
          onSubmit={onGenerate}
        >
          <header className="space-y-5 text-center lg:sticky lg:top-24 lg:max-w-none lg:self-start lg:text-left">
            <div className="space-y-4">
              <span className="block font-mono text-5xl font-semibold tracking-[0.08em] text-foreground sm:text-6xl lg:text-7xl">
                FERRO
              </span>
              <div className="ferro-flare-underline" aria-hidden>
                <span className="ferro-flare-underline__halo" />
                <span className="ferro-flare-underline__core" />
                <span className="ferro-flare-underline__shimmer" />
              </div>
            </div>
            <h1 className="text-balance text-3xl font-medium tracking-[-0.05em] text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
              AI motion graphics from your footage.
            </h1>
            <p className="text-pretty text-sm leading-7 text-muted-foreground sm:text-base lg:max-w-md">
              Upload a clip, add taste and notes, and generate overlays timed
              to speech — then tweak the code.
            </p>
          </header>

          <div className="min-w-0 space-y-6">
            <label
              htmlFor="source-video"
              className={cn(
                "glass-panel-hero group relative block cursor-pointer overflow-hidden p-8 text-center transition-[box-shadow,border-color] sm:p-10 lg:p-9 lg:text-left",
                isDraggingVideo &&
                  "!border-border shadow-[0_28px_90px_rgba(0,0,0,0.18)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.5)]",
              )}
              onDragEnter={handleVideoDragEnter}
              onDragLeave={handleVideoDragLeave}
              onDragOver={handleVideoDragOver}
              onDrop={handleVideoDrop}
            >
              <HeroBackdrop />
              <input
                id="source-video"
                type="file"
                accept="video/*"
                ref={formVideoInputRef}
                className="sr-only"
                onChange={handleVideoChange}
              />

              <div className="absolute inset-x-1/4 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent dark:via-white/35" />

              <div className="relative flex flex-col items-center lg:items-start">
                <div
                  className={cn(
                    "flex size-16 items-center justify-center rounded-2xl border border-border bg-muted/80 transition-colors dark:bg-white/[0.06]",
                    isDraggingVideo && "border-border bg-muted dark:border-white/35 dark:bg-white/[0.12]",
                  )}
                >
                  <FileVideo className="size-6 text-foreground" />
                </div>
                <h2 className="mt-6 text-3xl font-medium tracking-[-0.05em] text-foreground sm:text-4xl">
                  {isDraggingVideo
                    ? "Drop source video here"
                    : videoFile
                      ? "Replace source video"
                      : "Upload source video"}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Drag a file from Finder or click to browse. Transcription
                  starts as soon as a clip is attached.
                </p>
                <div
                  className={cn(
                    "glass-panel-inner mt-6 min-w-[260px] rounded-2xl border border-dashed border-border px-5 py-4 transition-colors dark:border-white/18",
                    isDraggingVideo && "border-border dark:border-white/40",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">
                    {isDraggingVideo
                      ? "Release to attach video"
                      : videoFile?.name ?? "Choose a video file"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {videoFile
                      ? `${resolution.width}×${resolution.height}`
                      : "MP4, MOV, WebM, AVI, or MKV."}
                  </p>
                </div>

                {videoFile ? (
                  <div
                    className="mt-5 flex max-w-md flex-col items-center gap-2"
                    aria-live="polite"
                  >
                    {isTranscribing ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2
                          className="size-4 shrink-0 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                        <span>
                          {transcribeStatus ?? "Preparing transcription…"}
                        </span>
                      </p>
                    ) : transcribeStatus ? (
                      <p className="text-sm text-emerald-300/90">
                        {transcribeStatus}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </label>

            {!videoFile ? (
              <div className="glass-panel rounded-card p-5">
                <ResolutionSelector
                  value={resolution}
                  onChange={setResolution}
                />
              </div>
            ) : null}

            <motion.div
              className="grid gap-4 md:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={fieldGridVariants}
            >
              <motion.div variants={fieldItemVariants} className="min-h-0">
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
              </motion.div>

              <motion.div variants={fieldItemVariants} className="min-h-0">
                <FieldCard
                  id="transcript"
                  name="transcript"
                  label="Transcript"
                  title="Transcript"
                  description="With a video attached, speech is transcribed automatically. Edit the plain text anytime, or paste / import a file instead."
                  placeholder="Plain transcript text — filled automatically after upload, or paste your own."
                  icon={Captions}
                  iconClassName="text-foreground"
                  maxLength={12000}
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
                          "cursor-pointer rounded-full border-border bg-muted text-foreground shadow-none hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]",
                        )}
                      >
                        <Captions className="size-3.5" />
                        {isTranscribing
                          ? transcribeStatus ?? "Transcribing…"
                          : "Transcribe again"}
                      </button>
                      <label
                        htmlFor="transcript-file"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "cursor-pointer rounded-full border-border bg-muted text-foreground shadow-none hover:bg-muted/80 dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]",
                        )}
                      >
                        <Upload className="size-3.5" />
                        {transcriptFileName ? "Replace file" : "Add file"}
                      </label>
                      <input
                        id="transcript-file"
                        type="file"
                        accept=".srt,.vtt,.txt,.md"
                        className="sr-only"
                        onChange={handleTranscriptFileChange}
                      />
                    </>
                  }
                >
                  {transcriptFileName ? (
                    <p className="rounded-2xl border border-border bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                      Transcript file ready:{" "}
                      <span className="font-medium text-foreground">
                        {transcriptFileName}
                      </span>
                    </p>
                  ) : null}
                  {captions && captions.length > 0 ? (
                    <p className="rounded-2xl border border-[#39E508]/25 bg-[#39E508]/[0.08] px-3 py-2 text-center text-xs text-[#39E508]/85">
                      {captions.length} word-level timestamps ready for the
                      planner
                    </p>
                  ) : null}
                  {videoFile ? (
                    <TranscriptionDebugPanel
                      hasVideo
                      captions={captions}
                      detectedVideoFps={detectedVideoFps}
                      devMode={devMode}
                      isTranscribing={isTranscribing}
                      transcribeStatus={transcribeStatus}
                      className="mt-2"
                    />
                  ) : null}
                </FieldCard>
              </motion.div>

              <motion.div variants={fieldItemVariants} className="min-h-0">
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
              </motion.div>
            </motion.div>

            {captions && captions.length > 0 && (
              <label className="mx-auto flex max-w-xs cursor-pointer items-center gap-3 rounded-full border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground shadow-[var(--glass-shadow)] backdrop-blur-xl transition hover:border-border hover:bg-muted/60 dark:border-white/14 dark:bg-white/[0.05] dark:text-white/75 dark:hover:border-white/20 dark:hover:bg-white/[0.08]">
                <input
                  type="checkbox"
                  checked={includeCaptionLayer}
                  onChange={(e) => setIncludeCaptionLayer(e.target.checked)}
                  className="size-4 accent-[#39E508]"
                />
                <span>Include TikTok-style captions layer</span>
              </label>
            )}

            <div className="glass-panel flex w-full flex-col gap-4 rounded-card p-5">
              <GenerationStatus
                jobState={displayedJobState}
                progress={generationProgress}
                totalLayers={layers.length}
                layerCounts={currentSession ? layerCounts : null}
              />

              {currentSession ? (
                <div className="glass-panel-muted rounded-card-status px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                        Current local session
                      </p>
                      <p className="mt-1 text-sm text-foreground/90">
                        {layerCounts.ready}/{layers.length} ready
                        {layerCounts.generating
                          ? ` · ${layerCounts.generating} generating`
                          : ""}
                        {layerCounts.failed
                          ? ` · ${layerCounts.failed} failed`
                          : ""}
                      </p>
                    </div>

                    {currentSession.status !== "running" &&
                    currentSession.layers.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onOpenPreview}
                        className="rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
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
                          className="rounded-xl border border-border bg-muted/40 px-3 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {layer.title}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {Math.round(
                                  (layer.from /
                                    (currentSession.fps ?? 30)) *
                                    10,
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
                            <StatusPill status={layer.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Waiting for the planner to return the first set of layers.
                    </p>
                  )}
                </div>
              ) : null}

              {recentSessions.length > 0 ? (
                <div className="glass-panel-muted rounded-card-status px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                        Recent local sessions
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Reopen a locally stored generation session in this
                        browser.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {recentSessions.map((sess) => (
                      <button
                        key={sess.id}
                        type="button"
                        onClick={() => onOpenStoredSession(sess.id)}
                        className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {sess.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {sess.layerCount} layer
                            {sess.layerCount === 1 ? "" : "s"} · {sess.model}
                          </p>
                        </div>
                        <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground dark:border-white/12 dark:bg-white/[0.06] dark:text-white/58">
                          {sess.status}
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
                <label className="glass-panel-inner flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground dark:border-white/12 dark:text-white/55 dark:hover:border-white/18 dark:hover:text-white/75">
                  <input
                    type="checkbox"
                    checked={devMode}
                    onChange={(e) => toggleDevMode(e.target.checked)}
                    className="rounded border-border accent-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:border-white/22"
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
                className="h-14 min-w-[240px] self-center rounded-full bg-primary px-8 text-primary-foreground shadow-lg hover:bg-primary/90 dark:shadow-[0_12px_40px_rgba(255,255,255,0.12)] lg:self-start"
              >
                <Sparkles className="size-4" />
                {currentSession?.status === "running"
                  ? "Generating overlays…"
                  : "Generate overlays"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}

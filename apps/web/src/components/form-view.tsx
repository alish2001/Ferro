"use client"

import type { FormEvent } from "react"
import {
  Captions,
  Clapperboard,
  FileVideo,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react"

import { PipelineFlowchart } from "@/components/dev-mode/pipeline-flowchart"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import { Button, buttonVariants } from "@/components/ui/button"
import { ModelSelector } from "@/components/ui/model-selector"
import { ResolutionSelector } from "@/components/ui/resolution-selector"
import { FieldCard } from "@/components/upload/field-card"
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
  // Video
  videoFile: File | null
  videoObjectUrl: string | null
  isDraggingVideo: boolean
  resolution: Resolution
  setResolution: (r: Resolution) => void
  formVideoInputRef: React.RefObject<HTMLInputElement | null>
  handleVideoChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleVideoDragEnter: (event: React.DragEvent<HTMLLabelElement>) => void
  handleVideoDragOver: (event: React.DragEvent<HTMLLabelElement>) => void
  handleVideoDragLeave: (event: React.DragEvent<HTMLLabelElement>) => void
  handleVideoDrop: (event: React.DragEvent<HTMLLabelElement>) => void
  // Transcript
  transcriptText: string
  setTranscriptText: (text: string) => void
  transcriptFileName: string | null
  captions: FerroCaption[] | null
  isTranscribing: boolean
  transcribeStatus: string | null
  includeCaptionLayer: boolean
  setIncludeCaptionLayer: (checked: boolean) => void
  handleTranscriptFileChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void
  handleTranscribe: () => void
  // Session
  currentSession: FerroGenerationSession | null
  layers: FerroLayer[]
  layerCounts: GenerationCounts
  displayedJobState: JobState
  generationProgress: number | null
  recentSessions: { id: string; title: string; status: string; model: string; layerCount: number }[]
  // Model & dev mode
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
  // Actions
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

          <form className="space-y-6" onSubmit={onGenerate}>
            <label
              htmlFor="source-video"
              className={cn(
                "group relative block cursor-pointer overflow-hidden rounded-hero border border-white/12 bg-white/[0.035] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.05] sm:p-10",
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
              <div className="rounded-card border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
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
                        "cursor-pointer rounded-full border-white/10 bg-white/[0.05] text-white shadow-none hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40",
                      )}
                    >
                      <Captions className="size-3.5" />
                      {isTranscribing
                        ? transcribeStatus ?? "Transcribing…"
                        : "Transcribe"}
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

            {captions && captions.length > 0 && (
              <label className="mx-auto flex max-w-xs cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06]">
                <input
                  type="checkbox"
                  checked={includeCaptionLayer}
                  onChange={(e) => setIncludeCaptionLayer(e.target.checked)}
                  className="size-4 accent-[#39E508]"
                />
                <span>Include TikTok-style captions layer</span>
              </label>
            )}

            <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-card border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
              <GenerationStatus
                jobState={displayedJobState}
                progress={generationProgress}
                totalLayers={layers.length}
                layerCounts={currentSession ? layerCounts : null}
              />

              {currentSession ? (
                <div className="rounded-card-status border border-white/10 bg-black/35 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
                        Current local session
                      </p>
                      <p className="mt-1 text-sm text-white/72">
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
                    <p className="mt-4 text-sm text-white/55">
                      Waiting for the planner to return the first set of layers.
                    </p>
                  )}
                </div>
              ) : null}

              {recentSessions.length > 0 ? (
                <div className="rounded-card-status border border-white/10 bg-black/35 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
                        Recent local sessions
                      </p>
                      <p className="mt-1 text-sm text-white/62">
                        Reopen a locally stored generation session in this
                        browser.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {recentSessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => onOpenStoredSession(session.id)}
                        className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white/85">
                            {session.title}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {session.layerCount} layer
                            {session.layerCount === 1 ? "" : "s"} ·{" "}
                            {session.model}
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
                    onChange={(e) => toggleDevMode(e.target.checked)}
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
                className="h-14 min-w-[240px] self-center rounded-button-lg bg-white px-6 text-black hover:bg-zinc-200"
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

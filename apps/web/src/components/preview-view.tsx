"use client"

import React, { useCallback } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Download,
  Sparkles,
  Upload,
} from "lucide-react"

import { PipelineFlowchart } from "@/components/dev-mode/pipeline-flowchart"
import { CompositorPreview } from "@/components/preview/CompositorPreview"
import { GraphicCard } from "@/components/preview/GraphicCard"
import { Button, buttonVariants } from "@/components/ui/button"
import type {
  DevModeStageTrace,
  FerroGenerationSession,
  FerroLayerMessage,
  FerroLayerVersion,
  FerroRenderMode,
  FerroRenderJobResponse,
  FerroRenderPayload,
} from "@/lib/ferro-contracts"
import { cn } from "@/lib/utils"

interface PreviewViewProps {
  session: FerroGenerationSession
  videoObjectUrl: string | null
  needsVideoReattach: boolean
  payload: FerroRenderPayload | null
  messagesByLayer: Map<string, FerroLayerMessage[]>
  versionsByLayer: Map<string, FerroLayerVersion[]>
  // Render state
  renderMode: FerroRenderMode
  setRenderMode: (mode: FerroRenderMode) => void
  renderJob: FerroRenderJobResponse | null
  renderProgress: number | null
  renderMessage: string
  renderError: string | null
  isExporting: boolean
  serverIsBusy: boolean
  canDownloadServer: boolean
  canRetryClient: boolean
  canDownloadClient: boolean
  clientDownloadUrl: string | null
  handleExport: () => Promise<void>
  downloadFromUrl: (url: string, filename: string) => void
  // Dev mode
  devMode: boolean
  stageTraces: Map<string, DevModeStageTrace>
  isRerunning: boolean
  handleRerunStage: (
    stageId: string,
    overrides: { systemPrompt?: string; userPrompt?: string },
    cascade: boolean,
  ) => void
  // Focus management
  ref?: React.Ref<HTMLDivElement>
  // Navigation
  onBackToForm: () => void
  // Refs
  previewVideoInputRef: React.RefObject<HTMLInputElement | null>
  handlePreviewVideoChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void
  // Layer editing
  onLayerCodeChange: (layerId: string, code: string) => void
  onLayerEditPrompt: (layerId: string, prompt: string) => Promise<void>
}

export function PreviewView({
  ref,
  session,
  videoObjectUrl,
  needsVideoReattach,
  payload,
  messagesByLayer,
  versionsByLayer,
  renderMode,
  setRenderMode,
  renderJob,
  renderProgress,
  renderMessage,
  renderError,
  isExporting,
  serverIsBusy,
  canDownloadServer,
  canRetryClient,
  canDownloadClient,
  clientDownloadUrl,
  handleExport,
  downloadFromUrl,
  devMode,
  stageTraces,
  isRerunning,
  handleRerunStage,
  onBackToForm,
  previewVideoInputRef,
  handlePreviewVideoChange,
  onLayerCodeChange,
  onLayerEditPrompt,
}: PreviewViewProps) {
  // Stabilize callbacks for GraphicCard memoization
  const handleCodeChange = useCallback(
    (layerId: string) => (code: string) => onLayerCodeChange(layerId, code),
    [onLayerCodeChange],
  )

  const handleEditPrompt = useCallback(
    (layerId: string) => (prompt: string) => onLayerEditPrompt(layerId, prompt),
    [onLayerEditPrompt],
  )

  return (
    <main
      ref={ref}
      tabIndex={-1}
      className="min-h-screen px-4 py-8 text-foreground outline-none sm:px-6 sm:py-10"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBackToForm}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to form
          </Button>
          <div className="flex flex-wrap gap-2">
            {session.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground dark:border-white/12 dark:bg-white/[0.06] dark:text-white/55"
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
          <div className="glass-panel-muted mb-8 rounded-[1.5rem] border-amber-400/25 bg-amber-500/[0.12] px-5 py-4">
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
                    "cursor-pointer rounded-xl border-border bg-muted px-4 text-foreground hover:bg-muted/80 dark:border-white/10 dark:bg-black/35 dark:text-white dark:hover:bg-white/[0.08]",
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
                  className="sr-only"
                  onChange={handlePreviewVideoChange}
                />
              </div>
            </div>
          </div>
        ) : null}

        {payload ? (
          <div className="glass-panel mb-8 rounded-card p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                  Export
                </p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-foreground">
                  Render MP4 output
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
                    "rounded-xl border border-border px-4 text-foreground dark:border-white/10 dark:text-white",
                    renderMode === "server"
                      ? "bg-muted hover:bg-muted/80 dark:bg-white/15 dark:hover:bg-white/20"
                      : "bg-muted/60 hover:bg-muted dark:bg-black/30 dark:hover:bg-white/[0.08]",
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
                    "rounded-xl border border-border px-4 text-foreground dark:border-white/10 dark:text-white",
                    renderMode === "client"
                      ? "bg-muted hover:bg-muted/80 dark:bg-white/15 dark:hover:bg-white/20"
                      : "bg-muted/60 hover:bg-muted dark:bg-black/30 dark:hover:bg-white/[0.08]",
                  )}
                >
                  Client
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="glass-panel-inner rounded-2xl border border-border px-4 py-4 dark:border-white/12">
                <p className="text-sm font-medium text-foreground">
                  {renderMode === "server"
                    ? "Server render mode"
                    : "Client render mode"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {needsVideoReattach
                    ? "Reattach the original source video before exporting."
                    : renderMessage}
                </p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  {payload.width}×{payload.height} · {payload.fps}fps ·{" "}
                  {payload.durationInFrames} frames
                </p>
                {typeof renderProgress === "number" ? (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-muted dark:bg-white/8">
                      <div
                        className="h-full bg-foreground transition-[width] dark:bg-white"
                        style={{
                          width: `${Math.round(renderProgress * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Math.round(renderProgress * 100)}% complete
                    </p>
                  </div>
                ) : null}
                {renderError ? (
                  <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300">
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
                  className="h-12 rounded-[1rem] bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="size-4" />
                  {renderMode === "server"
                    ? serverIsBusy
                      ? "Rendering on server…"
                      : "Start server render"
                    : isExporting
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
                    className="h-12 rounded-[1rem] border-border bg-muted px-5 text-foreground hover:bg-muted/80 dark:border-white/10 dark:bg-black/35 dark:text-white dark:hover:bg-white/[0.08]"
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
                    className="h-12 rounded-[1rem] border-border bg-muted px-5 text-foreground hover:bg-muted/80 dark:border-white/10 dark:bg-black/35 dark:text-white dark:hover:bg-white/[0.08]"
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
                    className="h-12 rounded-[1rem] border-border bg-muted px-5 text-foreground hover:bg-muted/80 dark:border-white/10 dark:bg-black/35 dark:text-white dark:hover:bg-white/[0.08]"
                  >
                    Retry with client rendering
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel-muted mb-8 rounded-[1.5rem] px-5 py-4">
            <p className="text-sm font-medium text-foreground">
              Export unavailable for incomplete local sessions.
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Finish a full generation before exporting. You can still inspect
              completed layers and continue editing them below.
            </p>
          </div>
        )}

        <div className="mb-8">
          <CompositorPreview
            videoObjectUrl={videoObjectUrl}
            layers={session.layers}
            fps={session.fps ?? 30}
            width={session.width}
            height={session.height}
            durationInFrames={session.durationInFrames ?? 1}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {session.layers.map((layer) => (
            <GraphicCard
              key={layer.id}
              layer={layer}
              fps={session.fps ?? 30}
              width={session.width}
              height={session.height}
              messages={messagesByLayer.get(layer.id) ?? []}
              versionCount={(versionsByLayer.get(layer.id) ?? []).length}
              onCodeChange={handleCodeChange(layer.id)}
              onEditPrompt={handleEditPrompt(layer.id)}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

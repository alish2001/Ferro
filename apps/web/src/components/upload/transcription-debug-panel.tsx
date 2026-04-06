"use client"

import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"

import type { FerroCaption } from "@/lib/ferro-contracts"
import { cn } from "@/lib/utils"

interface TranscriptionDebugPanelProps {
  hasVideo: boolean
  captions: FerroCaption[] | null
  detectedVideoFps: number | null
  devMode: boolean
  isTranscribing: boolean
  transcribeStatus: string | null
  className?: string
}

export function TranscriptionDebugPanel({
  hasVideo,
  captions,
  detectedVideoFps,
  devMode,
  isTranscribing,
  transcribeStatus,
  className,
}: TranscriptionDebugPanelProps) {
  const [showRaw, setShowRaw] = useState(false)
  const panelId = useId()

  const hasPayload =
    (captions?.length ?? 0) > 0 || detectedVideoFps != null || isTranscribing

  if (!hasVideo || !hasPayload) return null

  return (
    <div
      className={cn(
        "glass-panel-inner rounded-2xl border border-border px-3 py-2 text-left dark:border-white/10",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        aria-expanded={showRaw}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground transition hover:text-foreground dark:text-white/70 dark:hover:text-white/90"
      >
        <span>
          {devMode
            ? "Transcription debug"
            : "Transcription details (inspect timing data)"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform dark:text-white/45",
            showRaw && "rotate-180",
          )}
        />
      </button>

      {showRaw ? (
        <div
          id={panelId}
          className="mt-3 space-y-3 border-t border-border pt-3 dark:border-white/10"
        >
          {detectedVideoFps != null ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Detected video FPS:{" "}
              <span className="text-foreground dark:text-white/80">
                {detectedVideoFps}
              </span>
            </p>
          ) : null}
          {isTranscribing && !captions?.length ? (
            <p className="text-xs text-muted-foreground dark:text-white/55">
              {transcribeStatus ?? "Transcribing…"}
            </p>
          ) : null}
          {captions && captions.length > 0 ? (
            <>
              <p className="font-mono text-[11px] text-muted-foreground">
                Word-level entries:{" "}
                <span className="text-foreground dark:text-white/80">
                  {captions.length}
                </span>
              </p>
              <pre className="max-h-48 overflow-auto rounded-xl border border-border bg-muted p-3 font-mono text-[10px] leading-relaxed text-foreground/90 dark:border-white/8 dark:bg-black/50 dark:text-white/70">
                {JSON.stringify(captions, null, 2)}
              </pre>
            </>
          ) : !isTranscribing ? (
            <p className="text-xs text-muted-foreground dark:text-white/45">
              No caption payload yet.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

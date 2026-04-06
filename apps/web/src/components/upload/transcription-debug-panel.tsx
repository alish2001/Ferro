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
        "glass-panel-inner rounded-2xl border border-white/10 px-3 py-2 text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        aria-expanded={showRaw}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 text-xs font-medium text-white/70 transition hover:text-white/90"
      >
        <span>
          {devMode
            ? "Transcription debug"
            : "Transcription details (inspect timing data)"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-white/45 transition-transform",
            showRaw && "rotate-180",
          )}
        />
      </button>

      {showRaw ? (
        <div
          id={panelId}
          className="mt-3 space-y-3 border-t border-white/10 pt-3"
        >
          {detectedVideoFps != null ? (
            <p className="font-mono text-[11px] text-white/55">
              Detected video FPS:{" "}
              <span className="text-white/80">{detectedVideoFps}</span>
            </p>
          ) : null}
          {isTranscribing && !captions?.length ? (
            <p className="text-xs text-white/55">
              {transcribeStatus ?? "Transcribing…"}
            </p>
          ) : null}
          {captions && captions.length > 0 ? (
            <>
              <p className="font-mono text-[11px] text-white/55">
                Word-level entries:{" "}
                <span className="text-white/80">{captions.length}</span>
              </p>
              <pre className="max-h-48 overflow-auto rounded-xl border border-white/8 bg-black/50 p-3 font-mono text-[10px] leading-relaxed text-white/70">
                {JSON.stringify(captions, null, 2)}
              </pre>
            </>
          ) : !isTranscribing ? (
            <p className="text-xs text-white/45">No caption payload yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

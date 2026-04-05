import { LoaderCircle } from "lucide-react"

import { AnimatedProgress } from "@/components/ui/animated-progress"
import { cn } from "@/lib/utils"

export type JobTone = "idle" | "success" | "error" | "loading"

export type JobState = {
  detail: string
  title: string
  tone: JobTone
}

export type GenerationCounts = {
  failed: number
  generating: number
  queued: number
  ready: number
}

const toneClasses: Record<JobTone, string> = {
  idle: "border-white/10 bg-white/[0.04]",
  success: "border-emerald-400/30 bg-emerald-500/10",
  error: "border-red-400/30 bg-red-500/10",
  loading: "border-blue-400/30 bg-blue-500/10",
}

type GenerationStatusProps = {
  jobState: JobState
  progress?: number | null
  totalLayers?: number
  layerCounts?: GenerationCounts | null
}

const progressToneClasses: Record<JobTone, "idle" | "success" | "error" | "loading"> = {
  idle: "idle",
  success: "success",
  error: "error",
  loading: "loading",
}

export function GenerationStatus({
  jobState,
  progress,
  totalLayers,
  layerCounts,
}: GenerationStatusProps) {
  const roundedProgress =
    typeof progress === "number" ? Math.round(progress * 100) : null
  const showProgress = typeof roundedProgress === "number"

  const summaryPills = layerCounts
    ? [
        {
          label: "ready",
          value: layerCounts.ready,
          className:
            "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
        },
        {
          label: "generating",
          value: layerCounts.generating,
          className: "border-sky-400/20 bg-sky-500/10 text-sky-100",
        },
        {
          label: "queued",
          value: layerCounts.queued,
          className: "border-white/10 bg-white/[0.05] text-white/60",
        },
        {
          label: "failed",
          value: layerCounts.failed,
          className: "border-red-400/20 bg-red-500/10 text-red-100",
        },
      ].filter((pill) => pill.value > 0)
    : []

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "w-full rounded-card-status border px-4 py-3 text-center",
        toneClasses[jobState.tone],
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">
          Generation status
        </p>
        {jobState.tone === "loading" ? (
          <LoaderCircle className="size-3.5 animate-spin text-sky-100/80" />
        ) : null}
      </div>
      <p className="mt-2 text-base font-semibold text-white">
        {jobState.title}
      </p>
      <p className="mt-1 text-sm leading-6 text-white/65">
        {jobState.detail}
      </p>

      {showProgress ? (
        <div className="mt-4 text-left">
          <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
            <span>Live progress</span>
            <span>{roundedProgress}%</span>
          </div>
          <AnimatedProgress
            value={progress}
            indeterminate={jobState.tone === "loading" && roundedProgress < 100}
            tone={progressToneClasses[jobState.tone]}
            className="mt-3"
          />
        </div>
      ) : null}

      {totalLayers ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/50">
          {totalLayers} layer{totalLayers === 1 ? "" : "s"} in this pass
        </p>
      ) : null}

      {summaryPills.length > 0 ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {summaryPills.map((pill) => (
            <span
              key={pill.label}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em]",
                pill.className,
              )}
            >
              {pill.value} {pill.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

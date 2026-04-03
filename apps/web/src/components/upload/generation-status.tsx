import { cn } from "@/lib/utils"

export type JobTone = "idle" | "success" | "error"

export type JobState = {
  detail: string
  title: string
  tone: JobTone
}

const toneClasses: Record<JobTone, string> = {
  idle: "border-white/10 bg-white/[0.04]",
  success: "border-emerald-400/30 bg-emerald-500/10",
  error: "border-red-400/30 bg-red-500/10",
}

type GenerationStatusProps = {
  jobState: JobState
}

export function GenerationStatus({ jobState }: GenerationStatusProps) {
  return (
    <div
      className={cn(
        "w-full rounded-[1.35rem] border px-4 py-3 text-center",
        toneClasses[jobState.tone]
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">
        Generation status
      </p>
      <p className="mt-2 text-base font-semibold text-white">
        {jobState.title}
      </p>
      <p className="mt-1 text-sm leading-6 text-white/65">
        {jobState.detail}
      </p>
    </div>
  )
}

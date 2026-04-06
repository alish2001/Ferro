import { cn } from "@/lib/utils"

const STATUS_CLASSES: Record<string, string> = {
  ready: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  generating: "border-blue-400/30 bg-blue-500/10 text-blue-200",
  queued:
    "border-border bg-muted text-muted-foreground dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55",
  failed: "border-red-400/30 bg-red-500/10 text-red-200",
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em]",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {status}
    </span>
  )
}

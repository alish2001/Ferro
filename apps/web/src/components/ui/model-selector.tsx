"use client"

import { MODELS, type ModelId } from "@/lib/models"
import { cn } from "@/lib/utils"

interface ModelSelectorProps {
  value: ModelId | string
  onChange: (value: string) => void
  className?: string
}

export function ModelSelector({ value, onChange, className }: ModelSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor="model-select"
        className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
      >
        Model
      </label>
      <select
        id="model-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 rounded-xl border border-border bg-background/80 px-3",
          "font-mono text-xs text-foreground",
          "appearance-none cursor-pointer",
          "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50",
          "transition-colors hover:border-border",
          "dark:border-white/12 dark:bg-black/40 dark:text-white dark:focus:border-white/24 dark:focus:ring-white/15 dark:hover:border-white/20",
        )}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id} className="bg-background dark:bg-zinc-900">
            {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}

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
        className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45"
      >
        Model
      </label>
      <select
        id="model-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 rounded-xl border border-white/12 bg-black/40 px-3",
          "font-mono text-xs text-white",
          "appearance-none cursor-pointer",
          "focus:border-white/24 focus:outline-none focus:ring-1 focus:ring-white/15",
          "transition-colors hover:border-white/20",
        )}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id} className="bg-zinc-900">
            {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}

"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"

export interface Resolution {
  width: number
  height: number
}

const PRESETS: Array<Resolution & { label: string }> = [
  { label: "1920×1080", width: 1920, height: 1080 },
  { label: "1280×720", width: 1280, height: 720 },
  { label: "1080×1920", width: 1080, height: 1920 },
  { label: "1080×1080", width: 1080, height: 1080 },
]

interface ResolutionSelectorProps {
  value: Resolution
  onChange: (r: Resolution) => void
  className?: string
}

export function ResolutionSelector({ value, onChange, className }: ResolutionSelectorProps) {
  const [aspectInput, setAspectInput] = useState("")
  const [widthInput, setWidthInput] = useState(String(value.width))
  const [heightInput, setHeightInput] = useState(String(value.height))

  const activePreset = PRESETS.find(
    (p) => p.width === value.width && p.height === value.height,
  )

  function applyPreset(preset: Resolution) {
    setWidthInput(String(preset.width))
    setHeightInput(String(preset.height))
    setAspectInput("")
    onChange(preset)
  }

  function applyFreeInput() {
    const w = parseInt(widthInput, 10)
    const h = parseInt(heightInput, 10)
    if (w > 0 && h > 0) onChange({ width: w, height: h })
  }

  function applyAspectRatio() {
    const match = aspectInput.match(/^(\d+)\s*[:/]\s*(\d+)$/)
    if (!match) return
    const [, aw, ah] = match.map(Number)
    const w = parseInt(widthInput, 10) || 1920
    const h = Math.round((w * Number(ah)) / Number(aw))
    setHeightInput(String(h))
    onChange({ width: w, height: h })
  }

  const inputClass =
    "w-20 rounded-lg border border-border bg-background/80 px-2 py-1.5 text-center font-mono text-xs text-foreground focus:border-ring focus:outline-none dark:border-white/12 dark:bg-black/40 dark:text-white dark:focus:border-white/24"

  return (
    <div className={cn("space-y-3", className)}>
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Canvas resolution
      </p>

      {/* Preset pills */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors",
              activePreset?.label === p.label
                ? "border-border bg-muted text-foreground dark:border-white/40 dark:bg-white/10 dark:text-white"
                : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:text-foreground dark:border-white/12 dark:bg-white/[0.04] dark:text-white/55 dark:hover:border-white/24 dark:hover:text-white/80",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Free input row */}
      <div className="flex items-center gap-2">
        <input
          aria-label="Width"
          type="number"
          value={widthInput}
          onChange={(e) => setWidthInput(e.target.value)}
          onBlur={applyFreeInput}
          placeholder="Width"
          className={inputClass}
        />
        <span className="text-muted-foreground">×</span>
        <input
          aria-label="Height"
          type="number"
          value={heightInput}
          onChange={(e) => setHeightInput(e.target.value)}
          onBlur={applyFreeInput}
          placeholder="Height"
          className={inputClass}
        />
        <span className="text-xs text-muted-foreground">or</span>
        <input
          aria-label="Aspect ratio"
          type="text"
          value={aspectInput}
          onChange={(e) => setAspectInput(e.target.value)}
          onBlur={applyAspectRatio}
          placeholder="16:9"
          className="w-16 rounded-lg border border-border bg-background/80 px-2 py-1.5 text-center font-mono text-xs text-foreground focus:border-ring focus:outline-none dark:border-white/12 dark:bg-black/40 dark:text-white dark:focus:border-white/24"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Current: {value.width}×{value.height}
      </p>
    </div>
  )
}

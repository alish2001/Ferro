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

  return (
    <div className={cn("space-y-3", className)}>
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">
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
                ? "border-white/40 bg-white/10 text-white"
                : "border-white/12 bg-white/[0.04] text-white/55 hover:border-white/24 hover:text-white/80",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Free input row */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={widthInput}
          onChange={(e) => setWidthInput(e.target.value)}
          onBlur={applyFreeInput}
          placeholder="Width"
          className="w-20 rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-center font-mono text-xs text-white focus:border-white/24 focus:outline-none"
        />
        <span className="text-white/40">×</span>
        <input
          type="number"
          value={heightInput}
          onChange={(e) => setHeightInput(e.target.value)}
          onBlur={applyFreeInput}
          placeholder="Height"
          className="w-20 rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-center font-mono text-xs text-white focus:border-white/24 focus:outline-none"
        />
        <span className="text-white/25 text-xs">or</span>
        <input
          type="text"
          value={aspectInput}
          onChange={(e) => setAspectInput(e.target.value)}
          onBlur={applyAspectRatio}
          placeholder="16:9"
          className="w-16 rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-center font-mono text-xs text-white focus:border-white/24 focus:outline-none"
        />
      </div>

      <p className="text-[11px] text-white/30">
        Current: {value.width}×{value.height}
      </p>
    </div>
  )
}

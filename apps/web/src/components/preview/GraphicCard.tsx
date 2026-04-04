"use client"

import { compileCode } from "@/remotion/compiler"
import type { FerroLayer } from "@/app/api/generate/route"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"

const Player = dynamic(
  () => import("@remotion/player").then((m) => m.Player),
  { ssr: false },
)

interface GraphicCardProps {
  layer: FerroLayer
  fps: number
  width: number
  height: number
  onCodeChange: (code: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  "lower-third": "Lower Third",
  "title-card": "Title Card",
  "stat-callout": "Stat Callout",
  "quote-overlay": "Quote Overlay",
  "outro-card": "Outro Card",
}

export function GraphicCard({ layer, fps, width, height, onCodeChange }: GraphicCardProps) {
  const [editCode, setEditCode] = useState(layer.code)
  const [compiledComponent, setCompiledComponent] = useState<React.ComponentType | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Compile on mount and whenever layer.code changes externally
  useEffect(() => {
    const { Component, error } = compileCode(layer.code)
    setCompiledComponent(() => Component)
    setCompileError(error)
    setEditCode(layer.code)
    setIsDirty(false)
  }, [layer.code])

  function handleRerun() {
    const { Component, error } = compileCode(editCode)
    setCompiledComponent(() => Component)
    setCompileError(error)
    if (!error) {
      onCodeChange(editCode)
      setIsDirty(false)
    }
  }

  const playerComponent = useMemo(
    () => compiledComponent ?? (() => null),
    [compiledComponent],
  )

  const typeLabel = TYPE_LABELS[layer.type] ?? layer.type

  return (
    <div className="flex flex-col gap-3 rounded-[1.75rem] border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/55">
            {typeLabel}
          </span>
          <p className="mt-1.5 text-sm font-medium text-white/80 leading-5">
            {layer.title}
          </p>
        </div>
        <span className="font-mono text-[10px] text-white/30">
          {Math.round(layer.from / fps * 10) / 10}s — {Math.round((layer.from + layer.durationInFrames) / fps * 10) / 10}s
        </span>
      </div>

      {/* Player preview */}
      <div className="overflow-hidden rounded-xl border border-white/8 bg-black/60">
        {compiledComponent ? (
          <div className="aspect-video w-full">
            <Player
              component={playerComponent}
              durationInFrames={layer.durationInFrames}
              fps={fps}
              compositionWidth={width}
              compositionHeight={height}
              style={{ width: "100%", height: "100%" }}
              controls
              loop
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center">
            <p className="font-mono text-xs text-white/30">
              {compileError ? "Compilation error" : "No component"}
            </p>
          </div>
        )}
      </div>

      {/* Error display */}
      {compileError && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2">
          <p className="font-mono text-xs text-red-400">{compileError}</p>
        </div>
      )}

      {/* Code editor */}
      <div className="relative">
        <textarea
          value={editCode}
          onChange={(e) => {
            setEditCode(e.target.value)
            setIsDirty(true)
          }}
          className={cn(
            "w-full rounded-xl border bg-black/50 px-3 py-3",
            "font-mono text-[11px] leading-5 text-white/80",
            "resize-none focus:outline-none focus:ring-1 focus:ring-white/15",
            "min-h-[160px] placeholder:text-white/25",
            isDirty ? "border-white/20" : "border-white/10",
          )}
          rows={8}
          spellCheck={false}
        />
      </div>

      {/* Rerun button */}
      {isDirty && (
        <Button
          type="button"
          onClick={handleRerun}
          size="sm"
          className="self-end rounded-xl bg-white px-4 text-black hover:bg-zinc-200"
        >
          Apply changes
        </Button>
      )}
    </div>
  )
}

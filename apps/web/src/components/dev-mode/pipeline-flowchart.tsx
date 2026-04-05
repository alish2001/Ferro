"use client"

import { useCallback, useMemo, useState } from "react"
import type { DevModeStageTrace } from "@/lib/ferro-contracts"
import { StageDetail } from "./stage-detail"

const STAGE_ORDER = [
  "skill-detection",
  "planning",
  "system-prompt-build",
] as const

const STAGE_LABELS: Record<string, string> = {
  "skill-detection": "Skills",
  planning: "Planning",
  "system-prompt-build": "Sys Prompt",
}

function StatusDot({ status }: { status: DevModeStageTrace["status"] }) {
  const label =
    status === "pending"
      ? "Pending"
      : status === "running"
        ? "Running"
        : status === "complete"
          ? "Complete"
          : "Failed"

  const className =
    status === "pending"
      ? "block size-2.5 rounded-full bg-white/20"
      : status === "running"
        ? "block size-2.5 rounded-full bg-sky-400 motion-safe:animate-pulse"
        : status === "complete"
          ? "block size-2.5 rounded-full bg-emerald-400"
          : "block size-2.5 rounded-full bg-red-400"

  return <span className={className} role="status" aria-label={label} />
}

function Arrow() {
  return (
    <div className="hidden items-center text-white/15 sm:flex" aria-hidden="true">
      <div className="h-px w-6 bg-white/15" />
      <div className="border-y-[4px] border-l-[6px] border-y-transparent border-l-white/15" />
    </div>
  )
}

function DurationLabel({ ms }: { ms: number | null }) {
  if (ms == null) return null
  return (
    <span className="tabular-nums text-[10px] text-white/35">
      {(ms / 1000).toFixed(1)}s
    </span>
  )
}

function TokenLabel({ usage }: { usage: DevModeStageTrace["tokenUsage"] }) {
  if (!usage) return null
  const total = usage.inputTokens + usage.outputTokens
  if (total === 0) return null
  return (
    <span className="tabular-nums text-[10px] text-white/30">
      {(total / 1000).toFixed(1)}k tok
    </span>
  )
}

interface StageNodeProps {
  trace: DevModeStageTrace | undefined
  label: string
  isSelected: boolean
  onClick: () => void
}

function StageNode({ trace, label, isSelected, onClick }: StageNodeProps) {
  const status = trace?.status ?? "pending"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`${label} stage — ${status}`}
      className={`flex min-w-[120px] flex-col items-center gap-1 rounded-xl border px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:outline-none ${
        isSelected
          ? "border-white/20 bg-white/[0.06]"
          : "border-white/[0.08] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className="text-xs font-medium text-white/70">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <DurationLabel ms={trace?.durationMs ?? null} />
        <TokenLabel usage={trace?.tokenUsage ?? null} />
      </div>
    </button>
  )
}

export interface PipelineFlowchartProps {
  traces: Map<string, DevModeStageTrace>
  onRerunStage?: (
    stageId: string,
    overrides: { systemPrompt?: string; userPrompt?: string },
    cascade: boolean,
  ) => void
  isRerunning?: boolean
}

export function PipelineFlowchart({
  traces,
  onRerunStage,
  isRerunning,
}: PipelineFlowchartProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  const layerStages = useMemo(() => {
    const stages: DevModeStageTrace[] = []
    for (const [key, trace] of traces) {
      if (key.startsWith("layer-gen-")) {
        stages.push(trace)
      }
    }
    return stages
  }, [traces])

  const selectedTrace = selectedStageId ? traces.get(selectedStageId) ?? null : null

  const handleNodeClick = useCallback((stageId: string) => {
    setSelectedStageId((prev) => (prev === stageId ? null : stageId))
  }, [])

  const handleRerun = useCallback(
    (overrides: { systemPrompt?: string; userPrompt?: string }, cascade: boolean) => {
      if (selectedStageId && onRerunStage) {
        onRerunStage(selectedStageId, overrides, cascade)
      }
    },
    [selectedStageId, onRerunStage],
  )

  return (
    <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-4">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
          Pipeline
        </span>
      </div>

      {/* Flowchart nodes */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-0" role="toolbar" aria-label="Pipeline stages">
        {STAGE_ORDER.map((stageId, index) => (
          <div key={stageId} className="flex items-center">
            {index > 0 ? <Arrow /> : null}
            <StageNode
              trace={traces.get(stageId)}
              label={STAGE_LABELS[stageId] ?? stageId}
              isSelected={selectedStageId === stageId}
              onClick={() => handleNodeClick(stageId)}
            />
          </div>
        ))}

        {/* Layer generation fan-out */}
        {layerStages.length > 0 ? (
          <>
            <Arrow />
            <div className="flex flex-col gap-1">
              {layerStages.map((trace) => (
                <StageNode
                  key={trace.stageId}
                  trace={trace}
                  label={trace.stageName}
                  isSelected={selectedStageId === trace.stageId}
                  onClick={() => handleNodeClick(trace.stageId)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Expanded detail panel */}
      {selectedTrace ? (
        <StageDetail
          trace={selectedTrace}
          onRerun={onRerunStage ? handleRerun : undefined}
          isRerunning={isRerunning}
        />
      ) : null}
    </div>
  )
}

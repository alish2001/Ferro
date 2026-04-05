"use client"

import dynamic from "next/dynamic"
import { useCallback, useState } from "react"
import type { DevModeStageTrace } from "@/lib/ferro-contracts"
import { Button } from "@/components/ui/button"

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false },
)

function detectLanguage(stageId: string, label: string): string {
  if (label === "Output") {
    // Layer gen output is TSX, plan output is JSON
    if (stageId.startsWith("layer-gen-")) return "typescript"
    return "json"
  }
  // System/user prompts are markdown-ish
  return "markdown"
}

function formatContent(content: string, language: string): string {
  if (language === "json") {
    try {
      return JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      return content
    }
  }
  return content
}

function CodeBlock({
  stageId,
  label,
  content,
  isEditing,
  editValue,
  onEditChange,
}: {
  stageId: string
  label: string
  content: string | null
  isEditing: boolean
  editValue: string
  onEditChange: (value: string) => void
}) {
  if (!content && !isEditing) return null

  const language = detectLanguage(stageId, label)
  const displayContent = content ? formatContent(content, language) : ""
  const lineCount = (isEditing ? editValue : displayContent).split("\n").length

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
        {label}
      </label>
      <div
        className="overflow-hidden rounded-lg border border-white/[0.06]"
        style={{ height: Math.min(Math.max(lineCount * 19 + 16, 120), 400) }}
      >
        <MonacoEditor
          value={isEditing ? editValue : displayContent}
          language={language}
          onChange={(value) => {
            if (isEditing && value != null) onEditChange(value)
          }}
          theme="vs-dark"
          options={{
            readOnly: !isEditing,
            minimap: { enabled: false },
            wordWrap: "on",
            lineNumbers: "off",
            folding: false,
            scrollBeyondLastLine: false,
            fontSize: 12,
            lineHeight: 19,
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              vertical: "auto",
              horizontal: "hidden",
              verticalScrollbarSize: 6,
            },
            domReadOnly: !isEditing,
            contextmenu: false,
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            parameterHints: { enabled: false },
            tabCompletion: "off",
            guides: { indentation: false },
          }}
        />
      </div>
    </div>
  )
}

function TokenBadge({ label, value }: { label: string; value: number }) {
  if (value === 0) return null
  return (
    <span className="rounded bg-white/[0.06] px-2 py-0.5 tabular-nums text-[11px] text-white/50">
      {label}: {value.toLocaleString()}
    </span>
  )
}

export interface StageDetailProps {
  trace: DevModeStageTrace
  onRerun?: (overrides: { systemPrompt?: string; userPrompt?: string }, cascade: boolean) => void
  isRerunning?: boolean
}

export function StageDetail({ trace, onRerun, isRerunning }: StageDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editSystemPrompt, setEditSystemPrompt] = useState(trace.systemPrompt ?? "")
  const [editUserPrompt, setEditUserPrompt] = useState(trace.userPrompt ?? "")
  const [cascade, setCascade] = useState(false)

  const handleStartEditing = useCallback(() => {
    setEditSystemPrompt(trace.systemPrompt ?? "")
    setEditUserPrompt(trace.userPrompt ?? "")
    setIsEditing(true)
  }, [trace.systemPrompt, trace.userPrompt])

  const handleRerun = useCallback(() => {
    const overrides: { systemPrompt?: string; userPrompt?: string } = {}
    if (editSystemPrompt !== trace.systemPrompt) overrides.systemPrompt = editSystemPrompt
    if (editUserPrompt !== trace.userPrompt) overrides.userPrompt = editUserPrompt
    onRerun?.(overrides, cascade)
    setIsEditing(false)
  }, [editSystemPrompt, editUserPrompt, trace.systemPrompt, trace.userPrompt, onRerun, cascade])

  const handleCancelEditing = useCallback(() => {
    setIsEditing(false)
  }, [])

  return (
    <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-2">
        {trace.modelId ? (
          <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/60">
            {trace.modelId}
          </span>
        ) : null}
        {trace.durationMs != null ? (
          <span className="rounded bg-white/[0.06] px-2 py-0.5 tabular-nums text-[11px] text-white/50">
            {(trace.durationMs / 1000).toFixed(1)}s
          </span>
        ) : null}
        {trace.finishReason && trace.finishReason !== "unknown" ? (
          <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
            {trace.finishReason}
          </span>
        ) : null}
        {trace.tokenUsage ? (
          <>
            <TokenBadge label="in" value={trace.tokenUsage.inputTokens} />
            <TokenBadge label="out" value={trace.tokenUsage.outputTokens} />
            <TokenBadge label="cache read" value={trace.tokenUsage.cacheReadTokens} />
            <TokenBadge label="cache write" value={trace.tokenUsage.cacheWriteTokens} />
          </>
        ) : null}
      </div>

      {/* Prompts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CodeBlock
          stageId={trace.stageId}
          label="System Prompt"
          content={trace.systemPrompt}
          isEditing={isEditing}
          editValue={editSystemPrompt}
          onEditChange={setEditSystemPrompt}
        />
        <CodeBlock
          stageId={trace.stageId}
          label="User Prompt"
          content={trace.userPrompt}
          isEditing={isEditing}
          editValue={editUserPrompt}
          onEditChange={setEditUserPrompt}
        />
      </div>

      {/* Output */}
      {trace.rawOutput ? (
        <CodeBlock
          stageId={trace.stageId}
          label="Output"
          content={trace.rawOutput}
          isEditing={false}
          editValue=""
          onEditChange={() => {}}
        />
      ) : null}

      {/* Error */}
      {trace.error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3" role="alert">
          <span className="text-sm text-red-400">{trace.error}</span>
        </div>
      ) : null}

      {/* Edit & Re-run controls */}
      {onRerun && trace.status === "complete" ? (
        <div className="flex items-center gap-3 border-t border-white/[0.06] pt-3">
          {isEditing ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={handleRerun}
                disabled={isRerunning}
                className="h-8 rounded-lg bg-white/10 px-3 text-xs text-white hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:outline-none"
              >
                {isRerunning ? "Re-running\u2026" : "Re-run this stage"}
              </Button>
              <label className="flex items-center gap-1.5 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={cascade}
                  onChange={(e) => setCascade(e.target.checked)}
                  className="rounded border-white/20 focus-visible:ring-2 focus-visible:ring-sky-400/50"
                />
                Cascade downstream
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCancelEditing}
                className="ml-auto h-8 px-3 text-xs text-white/40 hover:text-white/60 focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:outline-none"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleStartEditing}
              className="h-8 px-3 text-xs text-white/50 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:outline-none"
            >
              Edit & Re-run
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

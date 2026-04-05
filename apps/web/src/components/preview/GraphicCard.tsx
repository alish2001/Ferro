"use client"

import { motion } from "framer-motion"
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"

import { AnimatedProgress } from "@/components/ui/animated-progress"
import type { FerroLayer, FerroLayerMessage } from "@/lib/ferro-contracts"
import { compileCode } from "@/remotion/compiler"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const Player = dynamic(
  () => import("@remotion/player").then((module) => module.Player),
  { ssr: false },
)

interface GraphicCardProps {
  layer: FerroLayer
  fps: number
  width: number
  height: number
  messages: FerroLayerMessage[]
  versionCount: number
  onCodeChange: (code: string) => void
  onEditPrompt: (prompt: string) => void | Promise<void>
}

const TYPE_LABELS: Record<string, string> = {
  "lower-third": "Lower Third",
  "title-card": "Title Card",
  "stat-callout": "Stat Callout",
  "quote-overlay": "Quote Overlay",
  "outro-card": "Outro Card",
}

const THINKING_WORDS = ["Assistant", "is", "revising", "this", "layer"]

function PendingAssistantText() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-white/72">
      {THINKING_WORDS.map((word, index) => (
        <motion.span
          key={word}
          animate={{ opacity: [0.28, 1, 0.28] }}
          transition={{
            duration: 1.45,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: index * 0.12,
          }}
        >
          {word}
        </motion.span>
      ))}
      <motion.span
        className="inline-flex"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{
          duration: 1.1,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        …
      </motion.span>
    </div>
  )
}

export function GraphicCard({
  layer,
  fps,
  width,
  height,
  messages,
  versionCount,
  onCodeChange,
  onEditPrompt,
}: GraphicCardProps) {
  const [editCode, setEditCode] = useState(layer.code)
  const [prompt, setPrompt] = useState("")
  const [isDirty, setIsDirty] = useState(false)

  const isReady = layer.status === "ready" && layer.code.trim().length > 0
  const isEditPending = messages.some(
    (message) => message.role === "assistant" && message.status === "pending",
  )

  function handleApplyChanges() {
    const { error } = compileCode(editCode)

    if (!error) {
      onCodeChange(editCode)
      setIsDirty(false)
    }
  }

  async function handleSubmitPrompt() {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || isEditPending || !isReady) return
    setPrompt("")
    await onEditPrompt(trimmedPrompt)
  }

  const compilation = useMemo(() => {
    if (!isReady) {
      return {
        Component: null,
        error: layer.error,
      }
    }

    return compileCode(layer.code)
  }, [isReady, layer.code, layer.error])

  const playerComponent = useMemo(
    () => compilation.Component ?? (() => null),
    [compilation.Component],
  )

  const typeLabel = TYPE_LABELS[layer.type] ?? layer.type

  return (
    <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/12 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/55">
              {typeLabel}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em]",
                layer.status === "ready" &&
                  "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
                layer.status === "generating" &&
                  "border-blue-400/30 bg-blue-500/10 text-blue-200",
                layer.status === "queued" &&
                  "border-white/10 bg-white/[0.06] text-white/55",
                layer.status === "failed" &&
                  "border-red-400/30 bg-red-500/10 text-red-200",
              )}
            >
              {layer.status}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-5 font-medium text-white/80">
            {layer.title}
          </p>
          <p className="mt-1 text-xs text-white/38">
            {versionCount} local version{versionCount === 1 ? "" : "s"}
          </p>
        </div>

        <span className="font-mono text-[10px] text-white/30">
          {Math.round((layer.from / fps) * 10) / 10}s -{" "}
          {Math.round(((layer.from + layer.durationInFrames) / fps) * 10) / 10}s
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/8 bg-black/60">
        {compilation.Component ? (
          <div className="aspect-video w-full">
            <Player
              acknowledgeRemotionLicense={true}
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
          <div className="flex aspect-video items-center justify-center px-4 text-center">
            <p className="font-mono text-xs text-white/35">
              {layer.status === "queued" && "Waiting for generation to start."}
              {layer.status === "generating" &&
                "Generating this motion graphic…"}
              {layer.status === "failed" &&
                (layer.error ?? "This layer failed to generate.")}
              {!["queued", "generating", "failed"].includes(layer.status) &&
                (compilation.error ?? "No component available.")}
            </p>
          </div>
        )}
      </div>

      {compilation.error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2">
          <p className="font-mono text-xs text-red-400">{compilation.error}</p>
        </div>
      ) : null}

      <div className="rounded-[1.25rem] border border-white/8 bg-black/35 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">
            Layer chat
          </p>
          {isEditPending ? (
            <span className="inline-flex items-center gap-2 text-xs text-white/45">
              <Spinner className="size-3.5 text-sky-100/80" />
              Updating…
            </span>
          ) : null}
        </div>

        {isEditPending ? (
          <AnimatedProgress
            indeterminate
            tone="loading"
            value={0.56}
            className="mt-3 h-1.5"
          />
        ) : null}

        <div className="mt-3 space-y-2">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm leading-6",
                  message.role === "user"
                    ? "border border-white/10 bg-white/[0.06] text-white/85"
                    : "border border-white/8 bg-black/45 text-white/72",
                  message.status === "failed" &&
                    "border-red-400/20 bg-red-500/10 text-red-200",
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
                  {message.role}
                </p>
                <div className="mt-1 whitespace-pre-wrap">
                  {message.role === "assistant" &&
                  message.status === "pending" ? (
                    <PendingAssistantText />
                  ) : (
                    <p>{message.text}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/8 bg-white/[0.02] px-3 py-3 text-sm text-white/45">
              No follow-up edits yet. Ask for a revision and the latest code
              will replace this layer in place.
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={!isReady || isEditPending}
            rows={3}
            placeholder={
              isReady
                ? "Tighten the typography, change the entrance motion, simplify the color palette…"
                : "Layer edits unlock after generation completes."
            }
            className="min-h-[96px] rounded-xl border-white/10 bg-black/50 px-3 py-3 text-[13px] leading-6 text-white/80 placeholder:text-white/25"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmitPrompt()}
              disabled={!prompt.trim() || !isReady || isEditPending}
              className="rounded-xl bg-white px-4 text-black hover:bg-zinc-200"
            >
              {isEditPending ? (
                <>
                  <Spinner className="text-black" />
                  Updating…
                </>
              ) : (
                "Send edit prompt"
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={editCode}
          onChange={(event) => {
            setEditCode(event.target.value);
            setIsDirty(true);
          }}
          disabled={!isReady}
          className={cn(
            "min-h-[160px] w-full resize-none rounded-xl border bg-black/50 px-3 py-3 font-mono text-[11px] leading-5 text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-white/15",
            isDirty ? "border-white/20" : "border-white/10",
            !isReady && "opacity-55",
          )}
          rows={8}
          spellCheck={false}
        />
      </div>

      {isDirty ? (
        <Button
          type="button"
          onClick={handleApplyChanges}
          size="sm"
          disabled={!isReady}
          className="self-end rounded-xl bg-white px-4 text-black hover:bg-zinc-200"
        >
          Apply changes
        </Button>
      ) : null}
    </div>
  );
}

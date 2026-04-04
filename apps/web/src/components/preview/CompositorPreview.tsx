"use client"

import { compileCode } from "@/remotion/compiler"
import type { FerroLayer } from "@/lib/ferro-contracts"
import dynamic from "next/dynamic"
import React, { useMemo } from "react"
import { AbsoluteFill, Sequence, Video } from "remotion"

const Player = dynamic(
  () => import("@remotion/player").then((m) => m.Player),
  { ssr: false },
)

interface CompositorPreviewProps {
  videoObjectUrl: string | null
  layers: FerroLayer[]
  fps: number
  width: number
  height: number
  durationInFrames: number
}

export function CompositorPreview({
  videoObjectUrl,
  layers,
  fps,
  width,
  height,
  durationInFrames,
}: CompositorPreviewProps) {
  const CompositeComponent = useMemo(() => {
    const compiled = layers.map((layer) => ({
      Component: compileCode(layer.code).Component,
      from: layer.from,
      durationInFrames: layer.durationInFrames,
    }))

    const videoSrc = videoObjectUrl

    return function FerroComposite() {
      return (
        <AbsoluteFill>
          {videoSrc ? (
            <Video
              src={videoSrc}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
          {compiled.map(({ Component, from, durationInFrames }, index) =>
            Component ? (
              <Sequence key={index} from={from} durationInFrames={durationInFrames}>
                <Component />
              </Sequence>
            ) : null,
          )}
        </AbsoluteFill>
      )
    }
  }, [layers, videoObjectUrl])

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-black/60 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
      <div className="px-5 pt-5 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">
          Compositor preview
        </p>
        <p className="mt-1 text-xs text-white/35">
          All {layers.length} layer{layers.length !== 1 ? "s" : ""} composited over video · {width}×{height} · {fps}fps
        </p>
      </div>

      <div className="px-5 pb-5">
        <div className="overflow-hidden rounded-xl border border-white/8">
          <Player
            component={CompositeComponent}
            durationInFrames={Math.max(durationInFrames, 1)}
            fps={fps}
            compositionWidth={width}
            compositionHeight={height}
            style={{ width: "100%", aspectRatio: `${width}/${height}` }}
            controls
            loop
          />
        </div>
      </div>
    </div>
  )
}

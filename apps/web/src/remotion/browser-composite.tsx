"use client"

import type { FerroLayer } from "@/lib/ferro-contracts"
import { compileCode } from "@/remotion/compiler"
import { Video } from "@remotion/media"
import React from "react"
import { AbsoluteFill, Sequence } from "remotion"

interface BrowserCompositeOptions {
  layers: FerroLayer[]
  videoSrc: string | null
}

export function createBrowserCompositeComponent({
  layers,
  videoSrc,
}: BrowserCompositeOptions): React.ComponentType {
  const compiled = layers
    .filter((layer) => layer.status === "ready" && layer.code.trim().length > 0)
    .map((layer) => ({
      id: layer.id,
      Component: compileCode(layer.code).Component,
      from: layer.from,
      durationInFrames: layer.durationInFrames,
    }))

  return function FerroBrowserComposite() {
    return (
      <AbsoluteFill>
        {videoSrc ? (
          <Video
            src={videoSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        {compiled.map(({ id, Component, from, durationInFrames }) =>
          Component ? (
            <Sequence key={id} from={from} durationInFrames={durationInFrames}>
              <Component />
            </Sequence>
          ) : null,
        )}
      </AbsoluteFill>
    )
  }
}

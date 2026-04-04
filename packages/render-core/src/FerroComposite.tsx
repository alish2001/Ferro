import React from "react"
import { AbsoluteFill, OffthreadVideo, Sequence, getInputProps } from "remotion"
import { compileCode } from "./compiler"

export interface FerroCompositeProps {
  layers: Array<{
    code: string
    type: string
    from: number
    durationInFrames: number
  }>
  videoSrc: string
  width: number
  height: number
  fps: number
  durationInFrames: number
}

export const FerroComposite: React.FC = () => {
  const { layers, videoSrc } = getInputProps() as unknown as FerroCompositeProps

  const compiled = layers.map((layer) => ({
    Component: compileCode(layer.code).Component,
    from: layer.from,
    durationInFrames: layer.durationInFrames,
  }))

  return (
    <AbsoluteFill>
      {videoSrc && (
        <OffthreadVideo
          src={videoSrc}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {compiled.map(({ Component, from, durationInFrames }, i) =>
        Component ? (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            <Component />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  )
}

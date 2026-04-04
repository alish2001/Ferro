"use client"

import type { FerroRenderPayload } from "@/lib/ferro-contracts"
import { createBrowserCompositeComponent } from "@/remotion/browser-composite"
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer"

export async function checkBrowserRenderSupport(
  payload: FerroRenderPayload,
  hasAudio: boolean,
) {
  return canRenderMediaOnWeb({
    container: "mp4",
    videoCodec: "h264",
    audioCodec: hasAudio ? "aac" : null,
    muted: !hasAudio,
    width: payload.width,
    height: payload.height,
  })
}

interface ExportInBrowserOptions {
  payload: FerroRenderPayload
  videoSrc: string | null
  onProgress?: (progress: number) => void
}

export async function exportInBrowser({
  payload,
  videoSrc,
  onProgress,
}: ExportInBrowserOptions) {
  const component = createBrowserCompositeComponent({
    layers: payload.layers,
    videoSrc,
  })

  const result = await renderMediaOnWeb({
    composition: {
      id: "FerroBrowserComposite",
      component,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
      durationInFrames: payload.durationInFrames,
    },
    container: "mp4",
    videoCodec: "h264",
    audioCodec: videoSrc ? "aac" : null,
    muted: !videoSrc,
    outputTarget: "arraybuffer",
    onProgress: (progress) => {
      onProgress?.(progress.progress)
    },
  })

  return result.getBlob()
}

import { renderMedia, selectComposition } from "@remotion/renderer"
import type { RenderMediaProgress } from "@remotion/renderer"
import type { FerroRenderJobProgress } from "@/lib/ferro-contracts"
import type { StoredRenderJob } from "@/render/job-store"
import { assertRenderBundleExists } from "@/render/paths"

const FERRO_COMPOSITION_ID = "FerroComposite"

function toJobProgress(progress: RenderMediaProgress): FerroRenderJobProgress {
  return {
    progress: progress.progress,
    renderedFrames: progress.renderedFrames,
    encodedFrames: progress.encodedFrames,
    renderEstimatedTime: progress.renderEstimatedTime,
    renderedDoneIn: progress.renderedDoneIn,
    encodedDoneIn: progress.encodedDoneIn,
    stitchStage: progress.stitchStage,
  }
}

export async function runServerRenderJob(
  job: StoredRenderJob,
  onProgress: (progress: FerroRenderJobProgress) => void,
) {
  const serveUrl = assertRenderBundleExists()
  const inputProps = {
    ...job.payload,
    videoSrc: job.inputVideoPath
      ? new URL(`/api/render/${job.id}/source`, job.origin).toString()
      : "",
  }

  const composition = await selectComposition({
    id: FERRO_COMPOSITION_ID,
    serveUrl,
    inputProps,
    logLevel: "error",
  })

  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: "h264",
    outputLocation: job.outputPath,
    overwrite: true,
    muted: !job.inputVideoPath,
    logLevel: "error",
    onProgress: (progress) => onProgress(toJobProgress(progress)),
  })
}

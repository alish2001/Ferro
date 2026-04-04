export interface VideoMeta {
  width: number
  height: number
  durationSeconds: number
}

/**
 * Read video dimensions and duration from a File object using the browser's
 * native video element. Call this client-side only.
 */
export function getVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"

    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: video.duration,
      })
      URL.revokeObjectURL(video.src)
    }

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error("Failed to read video metadata"))
    }

    video.src = URL.createObjectURL(file)
  })
}

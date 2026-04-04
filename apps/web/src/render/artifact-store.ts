import { mkdir, rm, stat, writeFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { getArtifactsRoot } from "@/render/paths"

// Dev-only artifact adapter. Later this should become persistent blob/object
// storage while preserving the render orchestrator API and route contracts.

function guessExtension(file: File) {
  const fromName = extname(file.name)
  if (fromName) return fromName

  switch (file.type) {
    case "video/mp4":
      return ".mp4"
    case "video/quicktime":
      return ".mov"
    case "video/webm":
      return ".webm"
    default:
      return ".bin"
  }
}

export async function ensureArtifactsRoot() {
  await mkdir(getArtifactsRoot(), { recursive: true })
}

export async function getJobDirectory(jobId: string) {
  const jobDirectory = resolve(getArtifactsRoot(), jobId)
  await mkdir(jobDirectory, { recursive: true })
  return jobDirectory
}

export async function saveUploadedVideo(jobId: string, file: File | null) {
  if (!file) return null

  const jobDirectory = await getJobDirectory(jobId)
  const filePath = resolve(jobDirectory, `source${guessExtension(file)}`)
  const buffer = Buffer.from(await file.arrayBuffer())

  await writeFile(filePath, buffer)

  return {
    path: filePath,
    type: file.type || "application/octet-stream",
  }
}

export async function getRenderOutputPath(jobId: string) {
  const jobDirectory = await getJobDirectory(jobId)
  return resolve(jobDirectory, "render.mp4")
}

export async function removeFile(filePath: string | null) {
  if (!filePath) return

  await rm(filePath, { force: true })
}

export async function removeJobDirectory(jobId: string) {
  await rm(resolve(getArtifactsRoot(), jobId), {
    force: true,
    recursive: true,
  })
}

export async function fileExists(filePath: string | null) {
  if (!filePath) return false

  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"

export function getRepoRoot() {
  return resolve(process.cwd(), "..", "..")
}

export function getRenderBundlePath() {
  return resolve(getRepoRoot(), "packages", "render-core", "build")
}

export function assertRenderBundleExists() {
  const bundlePath = getRenderBundlePath()
  const indexPath = resolve(bundlePath, "index.html")

  if (!existsSync(indexPath)) {
    throw new Error(
      "Render bundle missing at packages/render-core/build. Run `bun run build:render-bundle` before exporting on the server.",
    )
  }

  return bundlePath
}

export function getArtifactsRoot() {
  return resolve(tmpdir(), "ferro-render-jobs")
}

#!/usr/bin/env bun
/**
 * Records a short browser video of the Ferro homepage (glass UI + form).
 * Prerequisite: dev server running — `bun run dev:web` from repo root (port 3000).
 *
 * Headless Chromium often records a black frame for dark / backdrop-blur UIs.
 * This script defaults to a **visible** browser. Use `DEMO_HEADLESS=1` only when
 * no display is available (e.g. CI).
 *
 *   BASE_URL=http://127.0.0.1:3000 bun run scripts/record-homepage-demo.ts
 *
 * Outputs:
 *   docs/demos/ferro-homepage-demo.webm
 *   docs/demos/ferro-homepage-demo.mp4  (if ffmpeg is on PATH)
 */

import { execFileSync } from "node:child_process"
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises"
import path from "node:path"
import { chromium, type Browser, type Page } from "playwright"

const appRoot = path.join(import.meta.dir, "..")
const outDir = path.join(appRoot, "docs", "demos")
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000"

/** Prefer headless only in CI / no display — default is headed so the video is not black. */
const useHeadless = process.env.DEMO_HEADLESS === "1"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function waitForPaint(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready.catch(() => undefined)
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })
  })
}

async function launchBrowserForDemo(): Promise<Browser> {
  const baseOpts = {
    headless: useHeadless,
    slowMo: useHeadless ? 0 : 55,
  } as const

  if (!useHeadless && process.env.PW_CHANNEL !== "chromium") {
    try {
      return await chromium.launch({
        ...baseOpts,
        channel: "chrome",
      })
    } catch {
      console.warn(
        "[demo] Google Chrome not found (channel: chrome); using bundled Chromium headed.",
      )
    }
  }

  return await chromium.launch({
    ...baseOpts,
    // When headless is unavoidable, prefer flags that reduce blank GPU captures on some setups.
    ...(useHeadless
      ? {
          args: [
            "--disable-dev-shm-usage",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ],
        }
      : {}),
  })
}

async function newestWebmIn(dir: string): Promise<string | null> {
  const names = await readdir(dir)
  const webms = names.filter((n) => n.endsWith(".webm"))
  if (webms.length === 0) return null
  let best = webms[0]!
  let bestM = (await stat(path.join(dir, best))).mtimeMs
  for (const n of webms.slice(1)) {
    const m = (await stat(path.join(dir, n))).mtimeMs
    if (m > bestM) {
      best = n
      bestM = m
    }
  }
  return path.join(dir, best)
}

async function main() {
  await mkdir(outDir, { recursive: true })

  const browser = await launchBrowserForDemo()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    recordVideo: {
      dir: outDir,
      size: { width: 1280, height: 720 },
    },
  })

  try {
    const page = await context.newPage()
    page.on("pageerror", (err) => {
      console.error("[demo] page error:", err)
    })

    await page.goto(baseURL, { waitUntil: "networkidle", timeout: 120_000 })
    await page
      .getByText("Ferro", { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })

    await waitForPaint(page)
    await sleep(300)
    await waitForPaint(page)

    await sleep(800)
    await page.mouse.wheel(0, 420)
    await sleep(1200)
    await page.mouse.wheel(0, -120)
    await sleep(600)

    const debugBtn = page.getByRole("button", {
      name: /Transcription details/i,
    })
    if (await debugBtn.isVisible().catch(() => false)) {
      await debugBtn.click()
      await sleep(1200)
    }

    await sleep(800)
    await waitForPaint(page)
  } finally {
    await context.close()
    await browser.close()
  }

  await sleep(500)

  const recorded = await newestWebmIn(outDir)
  if (!recorded) {
    throw new Error(`No .webm found in ${outDir} after recording`)
  }

  const webmOut = path.join(outDir, "ferro-homepage-demo.webm")
  try {
    await unlink(webmOut)
  } catch {
    // ignore missing
  }
  await rename(recorded, webmOut)

  console.info(`Wrote ${webmOut}`)

  try {
    const mp4Out = path.join(outDir, "ferro-homepage-demo.mp4")
    execFileSync("ffmpeg", [
      "-y",
      "-i",
      webmOut,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Out,
    ])
    console.info(`Wrote ${mp4Out}`)
  } catch {
    console.warn(
      "ffmpeg not available or failed — only .webm was produced. Install ffmpeg for H.264 MP4.",
    )
  }
}

void main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Current Web Conventions

- Keep the main upload flow in `src/app/page.tsx`. Do not move the whole page into `src/components`.
- Use Geist from Vercel via `geist/font/sans` and `geist/font/mono` in `src/app/layout.tsx`.
- Keep the current product direction centered, dark, and shadcn-based rather than adding extra marketing chrome.
- The source video surface should support both click-to-pick and drag-and-drop from Finder.
- When changing the upload experience or visual design, verify the actual rendered page in a browser during development instead of relying on source inspection alone.

## AI SDK Version

This app uses **Vercel AI SDK v6**. The API changed significantly from v5:

- `generateObject` is **deprecated** — do not use it
- Use `generateText` with `output: Output.object({ schema })` instead
- Import `Output` (capital O) from `"ai"` — `output` (lowercase) is not exported
- `result.output` is synchronous — do not `await` it

## Remotion in the Browser

- `@remotion/player` is used for browser-side preview — always dynamic-import with `ssr: false`
- `compileCode()` from `src/remotion/compiler.ts` turns LLM-generated code strings into React components via Babel + `new Function`
- The compiler injects all Remotion APIs (Lottie, ThreeCanvas, Three.js, shapes, transitions, `Video`) plus `createTikTokStyleCaptions` from `@remotion/captions` — do not remove any injected APIs
- `Video` from `remotion` is used in the browser compiler (not `OffthreadVideo` — that is for `packages/render-core`)
- Keep the current preview path intact. The working browser preview is not the same thing as MP4 export.
- Generated components must NEVER hardcode absolute frame numbers. They are always wrapped in `<Sequence from={layer.from}>` by the compositor, so `useCurrentFrame()` returns 0 at the layer's start. Animate from frame 0 to `useVideoConfig().durationInFrames`.

## Server Render Export

- `/api/render` is now the primary MP4 export path for development
- The Next.js app hosts the backend renderer directly; there is no separate render service to start
- The API routes in `src/app/api/render/` call the local service modules in `src/render/`
- `src/render/render-runner.ts` uses `@remotion/renderer` against the prebuilt `packages/render-core/build` bundle
- `src/remotion/browser-composite.tsx` and `src/remotion/client-render.ts` exist only for the manual client-render fallback export path
- If you change `packages/render-core`, the server export path needs a fresh bundle
- `bun run dev` from the repo root builds that bundle once before starting the app
- If you only run `bun run dev:web`, remember to run `bun run build:render-bundle` first or the server export route will return a bundle-missing error

## Generation Flow

The form submits to `POST /api/generate/stream` (NDJSON streaming). The API route is a thin orchestrator that calls pure functions from `src/generation/`. Do not put generation logic in the route handler itself — keep it in the appropriate `generation/*.ts` module.

Layer types understood by the planner: `lower-third`, `title-card`, `stat-callout`, `quote-overlay`, `outro-card`, `captions`.

The `captions` layer type is special — it bypasses LLM generation entirely. `pipeline.ts` detects `planLayer.type === "captions"` and calls `buildCaptionsLayerCode(captions)` instead of `generateLayer()`. It is only planned when `includeCaptionLayer: true` is in the request.

## Transcription Flow

`POST /api/transcribe` accepts a video file and streams NDJSON. The client stores:
- `FerroCaption[]` — word-level captions with `startMs`/`endMs` in milliseconds
- `detectedVideoFps` — native fps detected via ffprobe

Both are passed to `POST /api/generate/stream`. The planner receives captions pre-converted to `{ text, fromFrame, toFrame }` so it can place layers without doing any math. `videoFps` overrides the planner's own fps choice via `canonicalFps = request.videoFps ?? plan.fps` in `pipeline.ts`.

## Page State

`page.tsx` uses a `step` state (`"form"` | `"preview"`). The form step collects inputs and POSTs to the API. The preview step shows `<CompositorPreview>` and a grid of `<GraphicCard>` components. Do not split these into separate routes.

- The preview step also owns render/export state: selected render mode, server job polling state, client fallback progress, and download links

## Dev Mode (Pipeline Inspector)

When `devMode: true` is included in a `FerroGenerateRequest`, the pipeline emits `debug-stage-update` NDJSON events alongside the regular stream events. These carry the full system prompt, user prompt, raw output, token usage, timing, model ID, and finish reason for each stage.

### Architecture

- Each stage function (`detectSkills`, `planGraphics`, `generateLayer`) supports a `returnTrace` overload that returns an enriched result including prompts and `generateText()` metadata. The pipeline calls this overload only when `devMode` is true — zero overhead otherwise.
- `DevModeStageTrace` is the contract type for debug data (defined in `ferro-contracts.ts`).
- The `PipelineFlowchart` and `StageDetail` components live in `src/components/dev-mode/`. They receive traces via a `Map<string, DevModeStageTrace>` managed in `page.tsx`.

### Stage re-runs

`POST /api/generate/rerun` accepts a `FerroDevRerunRequestSchema` with a `stageId`, optional prompt overrides, a `cascade` flag, and the previous run's context. It re-executes just that stage (or cascades downstream) and streams back both `debug-stage-update` and standard events so the client can update both the flowchart and the session state.

### Stage IDs

- `"skill-detection"` — skill detection
- `"planning"` — graphic planning
- `"system-prompt-build"` — system prompt assembly (no LLM, deterministic)
- `"layer-gen-{layerId}"` — per-layer code generation

### Adding new stages

If you add a new pipeline stage, follow the existing pattern: emit a `debug-stage-update` with `status: "running"` before the call, call the stage function with `{ returnTrace: true }`, then emit with `status: "complete"` and the trace data. Use the `makeTrace()` helper in `pipeline.ts`.

## Resolution

- If a video is uploaded, `getVideoMeta(file)` reads real dimensions and updates `resolution` state automatically
- If no video is uploaded, `<ResolutionSelector>` is shown so the user can pick or type dimensions
- Always pass `resolution.width` and `resolution.height` to the API — never hardcode 1920×1080

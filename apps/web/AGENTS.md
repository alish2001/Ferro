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
- The compiler injects all Remotion APIs (Lottie, ThreeCanvas, Three.js, shapes, transitions, `Video`) — do not remove any injected APIs
- `Video` from `remotion` is used in the browser compiler (not `OffthreadVideo` — that is for `packages/render-core`)
- Keep the current preview path intact. The working browser preview is not the same thing as MP4 export.

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

The form submits to `POST /api/generate`. The API route is a thin orchestrator that calls pure functions from `src/generation/`. Do not put generation logic in the route handler itself — keep it in the appropriate `generation/*.ts` module.

Layer types understood by the planner: `lower-third`, `title-card`, `stat-callout`, `quote-overlay`, `outro-card`.

## Page State

`page.tsx` uses a `step` state (`"form"` | `"preview"`). The form step collects inputs and POSTs to the API. The preview step shows `<CompositorPreview>` and a grid of `<GraphicCard>` components. Do not split these into separate routes.

- The preview step also owns render/export state: selected render mode, server job polling state, client fallback progress, and download links

## Resolution

- If a video is uploaded, `getVideoMeta(file)` reads real dimensions and updates `resolution` state automatically
- If no video is uploaded, `<ResolutionSelector>` is shown so the user can pick or type dimensions
- Always pass `resolution.width` and `resolution.height` to the API — never hardcode 1920×1080

# Ferro Agent Notes

Ferro is a Bun workspace monorepo with two intentional surfaces:

- `apps/web`: the product-facing Next.js app
- `packages/render-core`: the Remotion package that owns compositions and local rendering

This split is deliberate. Do not collapse the product back into the Remotion package, and do not recreate a top-level `kitchen/` app. The old `kitchen/` folder was moved into `packages/render-core/` so the repo can support a real web app outside the renderer.

## Package Manager

Use Bun for repo operations.

- Install from the repo root with `bun install`
- Run workspace scripts through the root `package.json`
- Do not introduce `package-lock.json`, `pnpm-lock.yaml`, or Yarn-specific setup

Canonical root commands:

```bash
bun run dev
bun run dev:web
bun run dev:render
bun run build:render-bundle
bun run test
bun run lint
bun run typecheck
```

## Project Structure

### `apps/web`

This is the Next.js App Router surface for the product flow.

- The current upload / transcript / instructions / taste flow lives here
- Keep the current flow as a single page in `apps/web`
- If you edit this app, read `apps/web/AGENTS.md` first because the Next.js version is newer than many default assumptions

#### Generation Pipeline (`src/generation/`)

Pure async functions — no React, no Next.js imports. Each module does one thing and can be swapped independently.

| File | Purpose |
|---|---|
| `generation/prompts.ts` | `OVERLAY_SYSTEM_PROMPT` and `buildSystemPrompt(skillContent)` |
| `generation/skills.ts` | `detectSkills(prompt, model)` → `SkillName[]` |
| `generation/planner.ts` | `planGraphics(brief, model)` → layer plan with timing |
| `generation/generator.ts` | `generateLayer(brief, systemPrompt, model)` → code string |

All generation calls use the Vercel AI SDK v6 pattern: `generateText` with `output: Output.object({ schema })`. **Do not use `generateObject`** — it is deprecated in AI SDK v6. Import `Output` (capital O) from `"ai"`.

#### Model Registry (`src/lib/models.ts`)

`getModel(id)` splits on the first `:` — e.g. `"anthropic:claude-sonnet-4-6"` or `"openai:gpt-4o"`. Add new providers/models here only.

`FAST_MODEL_ID` is used for cheap skill detection and planning calls. The user-selected model is used for layer code generation.

#### Skills System (`src/skills/`)

- `index.ts` loads `.md` files at runtime via `fs.readFileSync` from `process.cwd()/src/skills/` — server-side only, called from the API route
- Active skills: `typography`, `spring-physics`, `charts`, `transitions`, `sequencing`, `video-overlay`
- `video-overlay.md` is Ferro-specific: overlay rules (no `backgroundColor` on `AbsoluteFill`, position constants, min font sizes, frame coverage limits)
- To add a skill: create a `.md` file in `src/skills/` and add its name to `SKILL_NAMES` in `index.ts`

#### API Route (`src/app/api/generate/route.ts`)

Thin orchestrator. Sequence: `detectSkills` → `planGraphics` → `getCombinedSkillContent` → `buildSystemPrompt` → `Promise.all(generateLayer×N)` → sanitize → respond.

Request shape: `{ taste, transcript, instructions, model, width, height, videoDurationSeconds? }`
Response shape: `{ layers, fps, width, height, durationInFrames, skills }`

#### Render Export (`src/app/api/render/` and `src/render/`)

Server-side MP4 export now lives in the web app.

- `POST /api/render` accepts `multipart/form-data` with `payload` JSON and an optional `video` file
- `GET /api/render/[jobId]` returns local render job status and progress
- `GET /api/render/[jobId]/download` streams the finished MP4
- `GET /api/render/[jobId]/source` serves the uploaded source video back to the Remotion renderer
- `src/render/` contains the local dev render service split into `request.ts`, `orchestrator.ts`, `job-store.ts`, `artifact-store.ts`, `paths.ts`, and `render-runner.ts`
- `src/lib/ferro-contracts.ts` is the shared contract surface for generation and rendering payloads; keep it web-local and do not invent a new shared package
- The queue and artifact store are intentionally dev-local adapters with comments marking where they should later be replaced by a durable queue and persistent object storage
- There is no separate render host to boot in development; the Next.js app handles `/api/render` directly

#### Browser Compiler (`src/remotion/compiler.ts`)

Ported from `template-prompt-to-motion-graphics-saas`. Strips imports from LLM-generated code, wraps in a function, transpiles with `@babel/standalone`, and evals via `new Function(...)` with all Remotion APIs injected. Keep all injected APIs (Lottie, ThreeCanvas, Three.js, shapes, transitions). The `Video` component from `remotion` is injected for use in browser preview.

Do not remove injected APIs to "clean up" — the LLM generates code that depends on them.

#### Preview Components (`src/components/preview/`)

- `GraphicCard.tsx` — per-layer preview: `<Player>` (dynamic import, `ssr: false`), editable code textarea, "Apply changes" rerun button
- `CompositorPreview.tsx` — all layers stacked via `<Sequence>` over `<Video>` in a single `<Player>`

Both compile code via `compileCode()` on mount and on user edits. The `<Player>` is always dynamically imported with `ssr: false`.

#### UI Components (`src/components/ui/`)

- `model-selector.tsx` — dark-styled `<select>` driven by the `MODELS` array from `lib/models.ts`
- `resolution-selector.tsx` — preset pills (1920×1080, 1280×720, 1080×1920, 1080×1080) + free width/height inputs + aspect ratio input. Shown on the form only when no video is attached.

#### Page Flow (`src/app/page.tsx`)

Two-step UI: `step === "form"` shows the upload form; `step === "preview"` shows the compositor and per-layer cards.

- Video upload reads real dimensions via `getVideoMeta()` and updates the resolution state
- `<ResolutionSelector>` is hidden once a video is attached (video dimensions take precedence)
- `handleGenerate` POSTs to `/api/generate` and transitions to the preview step on success
- The preview step now also owns export state and exposes a render-mode toggle: server-first MP4 export through `/api/render`, with browser export as a manual fallback

#### Helpers (`src/helpers/`)

- `sanitize-response.ts` — `stripMarkdownFences`, `extractComponentCode` (brace counting). Used to sanitize LLM output even when using structured outputs.
- `video-meta.ts` — browser-only `getVideoMeta(file)`: reads `videoWidth`, `videoHeight`, and `duration` from a `<video>` element.

### `packages/render-core`

This is the Remotion render package.

- It owns compositions, Studio entrypoints, and render-time React code
- It should stay independently runnable via `bun run dev:render`
- Keep render-specific logic here instead of pushing it into `apps/web`

#### `FerroComposite` Composition

`src/FerroComposite.tsx` is the render-time composition. It reads all props via `getInputProps()` at runtime — layers, videoSrc, width, height, fps, durationInFrames. All dimensions are fully dynamic via `calculateMetadata` in `Root.tsx`.

The `defaultProps` on the `<Composition>` in `Root.tsx` are **Studio preview defaults only**. At actual render time, pass real values via `inputProps` to `renderMedia()`.

#### Render Bundle Requirement

The web app's server renderer consumes the prebuilt bundle output at `packages/render-core/build`.

- There is no separate render host or background service to start in development
- The backend renderer is the Next.js Node runtime handling `/api/render`
- For server export to work, the `render-core` bundle must exist and be current
- `packages/render-core/build` should stay ignored; it is a generated artifact consumed by the server renderer
- `bun run dev` now does the minimum setup: build the bundle once, then start the web app
- If you change `packages/render-core` while `bun run dev:web` is already running, rerun `bun run build:render-bundle` before exporting again
- `bun run dev:render` is still only for Remotion Studio and composition debugging, not for hosting the server renderer

#### Current State Of Affairs

As of the current implementation:

- MP4 export is server-first, but the "server" is still the Next.js app in `apps/web`
- The render queue is process-local and in-memory in `apps/web/src/render/job-store.ts`
- Uploaded source videos and rendered MP4s are stored in temp files, not persistent storage
- Browser export exists as a manual fallback in the preview UI
- This is suitable for local development and simple self-hosting, but not yet for multi-instance or restart-heavy deployments

#### Local Development Right Now

To use the current export pipeline locally:

```bash
bun install
bun run dev
```

What this does:

- `bun run build:render-bundle` creates the Remotion bundle used by the server renderer
- `bun run dev:web` starts the Next.js app that hosts `/api/render`

Important caveats:

- If you only run `bun run dev:web`, server export will fail until you also run `bun run build:render-bundle`
- If you edit `packages/render-core`, rerun `bun run build:render-bundle` before testing server export again
- `bun run dev:render` is optional and only for Remotion Studio / composition debugging

#### Hosting The Current Version

The current implementation is intended for a single self-hosted instance, not Vercel Functions.

Expected hosted workflow:

```bash
bun install
bun run build:render-bundle
bun run --cwd apps/web build
bun run --cwd apps/web start
```

Operational assumptions of the current version:

- one long-lived app process
- writable temp filesystem for uploads and rendered MP4s
- the `packages/render-core/build` artifact available on disk alongside the app
- no horizontal scaling assumptions
- no durable queue or persistent blob storage yet

Because job state is stored in memory and artifacts are local temp files, restarts lose in-flight jobs and multiple replicas will not share render state correctly.

#### Future Direction

The current Next-hosted renderer is an MVP-oriented implementation.

The planned later direction is:

- move the renderer into a dedicated service instead of hosting `/api/render` inside the web app
- keep `apps/web` focused on generation, preview, export UI, and polling
- let the renderer service own rendering, queueing, artifact storage, and Remotion runtime concerns
- align more closely with a Vercel-template / self-hosted-render-service model when the project is ready for that complexity

That later split is mainly about cleaner deployment boundaries and better long-term scalability. It is not required for the current local/self-hosted MVP flow.

#### `src/compiler.ts` (render-core variant)

Same logic as the web compiler, but injects `OffthreadVideo` instead of `Video`. This is required for correct frame-accurate rendering on the server. Do not swap them — `Video` will not render correctly at non-realtime speeds.

## Prompt Caching

- `generateLayer` calls cache the system prompt across parallel calls via `providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } }`
- OpenAI caches automatically for prompts >1024 tokens (no explicit config needed)
- `detectSkills` and `planGraphics` do not use caching — their system prompts are short

## Important Intentionality

- There is no shared package — do not invent a premature `packages/shared`
- There is now a web-triggered render pipeline in `apps/web`, but it is intentionally local and dev-oriented
- There is still no durable job orchestration, auth, persistence, or progress streaming transport yet
- Do not prematurely refactor the current MVP renderer into infrastructure that assumes the later split has already happened

## Symlink Guardrail

`packages/render-core` contains an intentional multi-CLI skill setup:

- `.agents/skills/remotion-best-practices` is the source directory
- `.claude/skills/remotion-best-practices`
- `.codex/skills/remotion-best-practices`
- `.cursor/skills/remotion-best-practices`
- `.github/skills/remotion-best-practices`

Those four entries are symlinks pointing back to `../../.agents/skills/remotion-best-practices`.

Do not flatten, regenerate, or "clean up" this structure.
If `packages/render-core` is ever moved again, preserve those relative links exactly or update them carefully so the CLIs continue to work.

## Editing Expectations

- Prefer repo-root changes over per-package one-off tooling
- Keep the workspace install graph clean and Bun-managed
- Preserve the current package boundary: web in `apps/web`, rendering in `packages/render-core`
- Update root docs when changing the workspace shape or canonical commands

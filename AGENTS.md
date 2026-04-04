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
bun run dev:web
bun run dev:render
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

#### `src/compiler.ts` (render-core variant)

Same logic as the web compiler, but injects `OffthreadVideo` instead of `Video`. This is required for correct frame-accurate rendering on the server. Do not swap them — `Video` will not render correctly at non-realtime speeds.

## Prompt Caching

- `generateLayer` calls cache the system prompt across parallel calls via `providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } }`
- OpenAI caches automatically for prompts >1024 tokens (no explicit config needed)
- `detectSkills` and `planGraphics` do not use caching — their system prompts are short

## Important Intentionality

- There is no shared package — do not invent a premature `packages/shared`
- There is no web-triggered render pipeline yet (`/api/render` is Phase 2)
- There is no job orchestration or streaming layer yet

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

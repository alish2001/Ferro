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

### `packages/render-core`

This is the Remotion render package.

- It owns compositions, Studio entrypoints, and render-time React code
- It should stay independently runnable via `bun run dev:render`
- Keep render-specific logic here instead of pushing it into `apps/web`

## Important Intentionality

The current architecture is intentionally not fully integrated yet.

- There is no shared package yet
- There is no web-triggered render pipeline yet
- There is no job orchestration layer yet

That is expected. Do not invent a premature `packages/shared` or server render API unless the current task explicitly calls for it.

## Symlink Guardrail

`packages/render-core` contains an intentional multi-CLI skill setup:

- `.agents/skills/remotion-best-practices` is the source directory
- `.claude/skills/remotion-best-practices`
- `.codex/skills/remotion-best-practices`
- `.cursor/skills/remotion-best-practices`
- `.github/skills/remotion-best-practices`

Those four entries are symlinks pointing back to `../../.agents/skills/remotion-best-practices`.

Do not flatten, regenerate, or “clean up” this structure.
If `packages/render-core` is ever moved again, preserve those relative links exactly or update them carefully so the CLIs continue to work.

## Editing Expectations

- Prefer repo-root changes over per-package one-off tooling
- Keep the workspace install graph clean and Bun-managed
- Preserve the current package boundary: web in `apps/web`, rendering in `packages/render-core`
- Update root docs when changing the workspace shape or canonical commands

## Current Direction

The repo foundation is in place. The current direction is iterating on the first upload page in `apps/web`, not another structural rewrite.

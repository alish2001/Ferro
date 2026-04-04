# Ferro

Ferro is a Bun workspace monorepo with a thin web shell and a dedicated
Remotion render package.

## Workspace

- `apps/web`: Next.js App Router shell for the upcoming upload and job flow
- `packages/render-core`: Remotion compositions, Studio entrypoint, and render bundle source

## Commands

```bash
bun install
bun run dev
bun run dev:web
bun run dev:render
bun run build:render-bundle
bun run lint
bun run test
bun run typecheck
```

`bun run dev` is the easiest development entrypoint for export work. It builds the `render-core` bundle once and then starts the web app. `packages/render-core/build` is a generated artifact and stays ignored. There is no separate render backend to host; `/api/render` runs inside the Next.js app and consumes that bundle. If you change `packages/render-core` while developing, rerun `bun run build:render-bundle` before testing server export again.

## Notes

- The former `kitchen/` app now lives at `packages/render-core/`.
- The multi-CLI skill setup inside `render-core` is preserved, including the
  `.claude`, `.codex`, `.cursor`, and `.github` symlinks back to `.agents`.
- `FER-6` is the next step and will build the first upload and generation flow
  on top of `apps/web`.

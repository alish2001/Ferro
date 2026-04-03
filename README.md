# Ferro

Ferro is a Bun workspace monorepo with a thin web shell and a dedicated
Remotion render package.

## Workspace

- `apps/web`: Next.js App Router shell for the upcoming upload and job flow
- `packages/render-core`: Remotion compositions, Studio entrypoint, and render bundle source

## Commands

```bash
bun install
bun run dev:web
bun run dev:render
bun run lint
bun run typecheck
```

## Notes

- The former `kitchen/` app now lives at `packages/render-core/`.
- The multi-CLI skill setup inside `render-core` is preserved, including the
  `.claude`, `.codex`, `.cursor`, and `.github` symlinks back to `.agents`.
- `FER-6` is the next step and will build the first upload and generation flow
  on top of `apps/web`.

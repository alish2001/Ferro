# Render Core

`@ferro/render-core` contains the Remotion compositions and local Studio setup
for Ferro.

## From the repo root

```bash
bun install
bun run dev:render
bun run build:render-bundle
bun run test
```

## From this package

```bash
bun run dev
bun run build
bun run typecheck
```

## Notes

- This package was moved from `kitchen/` into `packages/render-core/`.
- The `.agents` skill source and the `.claude`, `.codex`, `.cursor`, and
  `.github` symlinks are intentionally preserved so the multi-CLI setup keeps
  working after the move.

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

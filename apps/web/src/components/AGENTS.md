# Components — AI Agent Guide

## Playground Fixtures

When creating or modifying a UI component in this directory, ensure a corresponding
`.fixture.ts` exists in `src/app/playground/fixtures/` and is registered in
`src/app/playground/registry.ts`. Update the fixture if you change the component's
props interface.

## Profiling Components with next-devtools MCP

Use the `next-devtools` MCP tools to profile components in the playground:

1. Ensure the dev server is running (`bun run dev:web` on port 3000)
2. Discover the server: `mcp__next-devtools__nextjs_index()`
3. Check errors: `mcp__next-devtools__nextjs_call(port="3000", toolName="get_errors")`
4. Inspect page render: `mcp__next-devtools__nextjs_call(port="3000", toolName="get_page_metadata")`
5. Browser screenshots: `mcp__next-devtools__browser_eval(action="screenshot")`
6. Console warnings: `mcp__next-devtools__browser_eval(action="console_messages")`
7. See `src/app/playground/AGENTS.md` for the full profiling workflow with all tool examples

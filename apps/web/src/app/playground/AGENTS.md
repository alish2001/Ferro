# Playground — AI Agent Guide

## Adding a new component fixture

1. Create `fixtures/<component-name>.fixture.ts`
2. Export a `ComponentFixture<Props>` — see `types.ts` for the interface
3. Add the export to `registry.ts`
4. Include at minimum: `id`, `name`, `category`, `description`, `defaultProps`, and at least 2 states
5. If the component is streaming/animated, add a `streamSimulator`
6. If the component uses Remotion or Monaco, wrap it in `next/dynamic` with `ssr: false`

## Fixture conventions

- `defaultProps` should represent the most common/happy-path usage
- States should cover: default, loading/streaming, success/complete, error/failed
- `tags` should include "streaming" if it has a stream simulator, "animated" if it uses framer-motion
- Keep fixture files focused — mock data factories go in the fixture, not in shared utils

## Profiling & Diagnosing Components with next-devtools MCP

The playground runs on the Next.js 16 dev server, which exposes MCP at `/_next/mcp`
automatically. The `next-devtools` MCP plugin provides tools to interact with both the
Next.js runtime and the browser. Use these to profile and diagnose component behavior
in real time.

### next-devtools MCP tools

**Discovery** — call first to find running servers:

- `mcp__next-devtools__nextjs_index()` — discovers all running Next.js dev servers and
  lists their available runtime tools with input schemas

**Next.js runtime tools** — call via `mcp__next-devtools__nextjs_call(port, toolName, args?)`:

| Runtime tool | Purpose | Playground use case |
|-------------|---------|---------------------|
| `get_errors` | Compilation errors, browser runtime errors, build errors with source-mapped stack traces | Check if a component change broke the playground — catches errors without opening browser console |
| `get_page_metadata` | What contributes to the current page render from active browser sessions | See which components/modules are involved in the playground render, understand bundle composition |
| `get_routes` | All filesystem routes grouped by router type (`app`/`pages`), supports `routerType` filter | Verify `/playground` route is registered: `args='{"routerType": "app"}'` |
| `get_project_metadata` | Project path, dev server URL | Confirm dev server is running and accessible |
| `get_logs` | Returns path to the Next.js dev log file for direct reading | Read server-side logs when errors aren't surfacing in `get_errors` |
| `get_server_action_by_id` | Locates a Server Action by ID in the manifest | Not typically needed for playground |

**Browser automation** — via `mcp__next-devtools__browser_eval(action, ...)`:

| Action | Parameters | Playground use case |
|--------|-----------|---------------------|
| `start` | `browser?: "chrome"` | Initialize Playwright browser session — do this first |
| `navigate` | `url: string` | Open `http://localhost:3000/playground` |
| `screenshot` | `fullPage?: boolean` | Capture visual state of components on canvas for verification |
| `evaluate` | `script: string` | Run JS in browser context — query DOM node counts, measure paint times, read `performance.getEntriesByType('paint')`, check React DevTools hook |
| `console_messages` | `errorsOnly?: boolean` | Catch React warnings: missing keys, state updates on unmounted components, deprecated APIs |
| `click` | `element: string` | Interact with playground controls — click state dropdowns, ⌘K items, close buttons |
| `fill` | `element: string, text: string` | Type into the ⌘K search input or props JSON editor |

### Setup

1. Start the dev server: `bun run dev:web` (port 3000)
2. Discover the server and its tools:
   ```
   mcp__next-devtools__nextjs_index()
   ```
3. Open the playground in the browser:
   ```
   mcp__next-devtools__browser_eval(action="start")
   mcp__next-devtools__browser_eval(action="navigate", url="http://localhost:3000/playground")
   ```

### Diagnosing render issues

```
# Check for compilation/runtime/build errors (source-mapped stacks)
mcp__next-devtools__nextjs_call(port="3000", toolName="get_errors")

# Verify /playground route is registered
mcp__next-devtools__nextjs_call(port="3000", toolName="get_routes", args='{"routerType": "app"}')

# See what contributes to the current page render
mcp__next-devtools__nextjs_call(port="3000", toolName="get_page_metadata")

# Read server logs for deeper issues
mcp__next-devtools__nextjs_call(port="3000", toolName="get_logs")
# Then use Read tool on the returned log file path
```

### Browser-based profiling

```
# Capture current playground state visually
mcp__next-devtools__browser_eval(action="screenshot")

# Check for React warnings and errors in console
mcp__next-devtools__browser_eval(action="console_messages")

# Count DOM nodes in sandbox cards (detect bloat)
mcp__next-devtools__browser_eval(action="evaluate", script="document.querySelectorAll('[data-sandbox-card]').length")

# Measure paint performance
mcp__next-devtools__browser_eval(action="evaluate", script="JSON.stringify(performance.getEntriesByType('paint'))")

# Check if React DevTools hook is available for deeper profiling
mcp__next-devtools__browser_eval(action="evaluate", script="!!window.__REACT_DEVTOOLS_GLOBAL_HOOK__")
```

### Workflow for optimizing a component

1. Start browser session and navigate to playground:
   ```
   mcp__next-devtools__browser_eval(action="start")
   mcp__next-devtools__browser_eval(action="navigate", url="http://localhost:3000/playground")
   ```
2. Add the component to the canvas via ⌘K, switch between states / start stream simulation
3. Check for errors from the Next.js runtime:
   ```
   mcp__next-devtools__nextjs_call(port="3000", toolName="get_errors")
   ```
4. Check browser console for React warnings:
   ```
   mcp__next-devtools__browser_eval(action="console_messages")
   ```
5. Screenshot to verify visual output:
   ```
   mcp__next-devtools__browser_eval(action="screenshot")
   ```
6. Inspect what's contributing to the render:
   ```
   mcp__next-devtools__nextjs_call(port="3000", toolName="get_page_metadata")
   ```
7. Check the render counter badge — if counts are unexpectedly high, evaluate in browser:
   ```
   mcp__next-devtools__browser_eval(action="evaluate", script="...")
   ```
8. Make code changes → Fast Refresh applies instantly → repeat from step 3
9. If something breaks silently, read the server logs:
   ```
   mcp__next-devtools__nextjs_call(port="3000", toolName="get_logs")
   ```

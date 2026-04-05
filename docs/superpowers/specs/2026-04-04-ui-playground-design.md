# UI Playground — Design Spec

> Dev-only sandbox page for testing, refining, and optimizing Ferro's UI components in isolation with mock data.

## Goals

1. **Isolate components** — render any Ferro UI component with mock props, independent of the generation pipeline and API tokens
2. **Generic fixture system** — typed, expandable format so onboarding a new component is: write one fixture file, add to registry
3. **Streaming simulation** — mock streaming behavior (progress ticks, NDJSON events, incremental traces) with play/pause/restart/speed controls
4. **At-a-glance debug** — ref-based render counter per component, zero measurement overhead
5. **Production coupling** — components render with the exact same code and styles as production; if it works in the playground, it works in the app

## Non-Goals

- Not a full Storybook replacement (no addon ecosystem, no visual regression)
- No production data or localStorage integration
- No API calls from the playground page

---

## Route & Access

- Path: `/playground`
- Dev-only: the page checks `process.env.NODE_ENV === 'development'` and renders a "not available" message (or redirects to `/`) in production
- No link from the main app UI — accessed directly by URL or ⌘K habit

---

## Fixture Type System

```typescript
// playground/types.ts

type FixtureCategory = "base-ui" | "upload" | "preview" | "dev-mode";

interface ComponentFixture<P = Record<string, unknown>> {
  id: string;
  name: string;
  category: FixtureCategory;
  description: string;
  tags: string[];
  component: ComponentType<P>;
  defaultProps: P;
  states: Record<string, Partial<P>>;
  thumbnail?: ComponentType;
  streamSimulator?: StreamSimulator<P>;
}

interface StreamSimulator<P> {
  durationMs: number;
  getPropsAtTime: (elapsedMs: number) => Partial<P>;
}
```

### Key design decisions

- `states` is `Record<string, Partial<P>>` — each named state only specifies props that differ from `defaultProps`. The sandbox card merges them: `{ ...fixture.defaultProps, ...fixture.states[selectedState] }`
- `StreamSimulator` is a pure function of elapsed time. This makes play/pause/restart trivial (just manipulate the elapsed clock) and avoids async/callback complexity
- `thumbnail` is an optional lightweight component rendered at ~64×40px in the CMD-K palette. For simple components, this can be the component itself at `transform: scale(0.4)`. For heavy ones (Remotion-based), it's a static CSS/SVG representation
- Categories exist only for CMD-K grouping — they have no architectural significance

---

## File Structure

```
apps/web/src/app/playground/
├── page.tsx                        # Dev-only route entry
├── AGENTS.md                       # AI agent instructions for playground
├── types.ts                        # ComponentFixture, StreamSimulator, FixtureCategory
├── registry.ts                     # Barrel: exports fixtures array
├── playground-provider.tsx         # Context: active fixtures, state, add/remove
├── components/
│   ├── sandbox-card.tsx            # Compound component: card + header + controls + body
│   ├── command-palette.tsx         # shadcn CommandDialog with mini previews
│   ├── playground-canvas.tsx       # Canvas layout rendering active sandbox cards
│   ├── stream-transport.tsx        # Play/pause/restart/speed controls
│   └── render-counter.tsx          # Ref-based render count badge
└── fixtures/
    ├── animated-progress.fixture.ts
    ├── status-pill.fixture.ts
    ├── button.fixture.ts
    ├── spinner.fixture.ts
    ├── card.fixture.ts
    ├── field-card.fixture.ts
    ├── generation-status.fixture.ts
    ├── resolution-selector.fixture.ts
    ├── model-selector.fixture.ts
    ├── pipeline-flowchart.fixture.ts
    ├── stage-detail.fixture.ts
    ├── graphic-card.fixture.ts
    ├── compositor-preview.fixture.ts
    └── pending-assistant-text.fixture.ts
```

---

## Component Architecture

### PlaygroundProvider (context)

Holds canvas state. Interface:

```typescript
interface PlaygroundContext {
  activeFixtures: Map<string, { fixtureId: string; selectedState: string }>;
  addFixture: (fixtureId: string) => void;
  removeFixture: (instanceId: string) => void;
  setFixtureState: (instanceId: string, stateName: string) => void;
}
```

- Consumed by both the command palette (to show "on canvas" badges, add/remove) and sandbox cards (to read/update selected state)
- Uses React 19 `use()` instead of `useContext()`

### CommandPalette

Built on shadcn's `CommandDialog` (`cmdk` underneath):

```
CommandDialog (⌘K toggle)
├── CommandInput (fuzzy search)
└── CommandList
    └── CommandGroup (per category)
        └── CommandItem (per fixture)
            ├── Mini thumbnail (64×40px, clipped)
            ├── Name + description
            └── "on canvas" badge (if active)
```

- ⌘K opens/closes
- Enter adds fixture to canvas (generates unique instance ID)
- Backspace on a highlighted "on canvas" item removes it
- Fuzzy search matches against `name`, `description`, `tags`
- Lazy-loaded on first ⌘K press (`next/dynamic`)

### SandboxCard (compound component)

```tsx
<SandboxCard fixture={fixture} instanceId={id}>
  <SandboxCard.Header>
    <SandboxCard.RenderCounter />
    <SandboxCard.StateDropdown />
    <SandboxCard.PropsDropdown />    {/* hidden by default, expand for JSON editing */}
    <SandboxCard.StreamTransport />  {/* only if fixture.streamSimulator exists */}
    <SandboxCard.CloseButton />
  </SandboxCard.Header>
  <SandboxCard.Body />               {/* renders component with resolved props */}
</SandboxCard>
```

Follows composition pattern — each sub-component is standalone, no boolean props controlling behavior.

### SandboxCard.Body

- Renders `fixture.component` with merged props: `{ ...fixture.defaultProps, ...fixture.states[selectedState], ...streamOverrides }`
- Full-width, natural sizing — no artificial constraints
- Wrapped in an `ErrorBoundary` so a crashing component doesn't take down the page

### RenderCounter

```typescript
// Zero overhead — ref increment, no state
const renderCount = useRef(0);
renderCount.current++;
// Reads renderCount.current in JSX
```

Displayed as a small badge in the card header: `renders: 14`

### StreamTransport

- Controls: ▶ play, ⏸ pause, ↺ restart, speed selector (0.5×, 1×, 2×)
- Uses `requestAnimationFrame` loop with a ref for elapsed time
- Each frame: calls `fixture.streamSimulator.getPropsAtTime(elapsed * speed)` → merges result into props via state update
- Only the derived prop update triggers a re-render, not the elapsed time tracking

### PlaygroundCanvas

- Renders active sandbox cards in a responsive grid (auto-fill, min 400px columns)
- Each card is a stable component identity (keyed by instance ID, not array index)
- Empty state shows a centered prompt: "Press ⌘K to add components"

---

## Best Practices Applied

### Bundle Size (CRITICAL)
- `/playground` route is dev-only — zero production bundle impact
- Heavy fixture components (GraphicCard, CompositorPreview) use `next/dynamic` with `ssr: false` inside their fixture files
- CommandPalette is lazy-loaded on first ⌘K press
- Fixtures import components directly, no barrel file re-exports from `components/`

### Re-render Optimization (MEDIUM)
- Render counter uses `useRef` — never causes re-renders (`rerender-use-ref-transient-values`)
- Stream elapsed time lives in a ref; only derived props trigger state updates (`rerender-defer-reads`)
- State dropdown changes update only the individual sandbox card, not the palette or other cards
- No inline component definitions — thumbnails and sandbox cards are stable identities (`rerender-no-inline-components`)
- Default prop objects in fixtures are module-level constants, not inline literals (`rerender-memo-with-default-value`)

### Composition Patterns (HIGH)
- SandboxCard uses compound component pattern — no boolean props (`architecture-compound-components`)
- StreamTransport is a separate component, not a `isStreaming` flag (`architecture-avoid-boolean-props`)
- PlaygroundProvider decouples state implementation from consumers (`state-decouple-implementation`)
- Context interface has clear state/actions shape (`state-context-interface`)

### React 19
- `use()` instead of `useContext()` for PlaygroundProvider (`react19-no-forwardref`)
- No `forwardRef` anywhere

---

## AGENTS.md Files

### `apps/web/src/app/playground/AGENTS.md`

```markdown
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
```

### Addition to `apps/web/src/components/AGENTS.md` (or create if missing)

```markdown
## Playground Fixtures

When creating or modifying a UI component in this directory, ensure a corresponding
`.fixture.ts` exists in `src/app/playground/fixtures/` and is registered in
`src/app/playground/registry.ts`. Update the fixture if you change the component's
props interface.
```

---

## Fixture Examples

### Simple: AnimatedProgress

```typescript
import { AnimatedProgress } from "@/components/ui/animated-progress";
import type { ComponentFixture } from "../types";

const defaultProps = {
  value: 0.65,
  tone: "loading" as const,
  indeterminate: false,
};

export const animatedProgressFixture: ComponentFixture<typeof defaultProps> = {
  id: "animated-progress",
  name: "AnimatedProgress",
  category: "base-ui",
  description: "Gradient progress bar with shimmer animation",
  tags: ["streaming", "animated"],
  component: AnimatedProgress,
  defaultProps,
  states: {
    idle: { value: 0, tone: "idle" },
    loading: { value: 0.65, tone: "loading" },
    success: { value: 1, tone: "success" },
    error: { value: 0.3, tone: "error" },
    indeterminate: { indeterminate: true, tone: "loading" },
  },
  streamSimulator: {
    durationMs: 5000,
    getPropsAtTime: (elapsed) => ({
      value: Math.min(elapsed / 5000, 1),
      tone: elapsed >= 5000 ? "success" : "loading",
    }),
  },
};
```

### Heavy: PipelineFlowchart (dynamic import)

```typescript
import dynamic from "next/dynamic";
import type { ComponentFixture } from "../types";
import type { DevModeStageTrace } from "@/lib/ferro-contracts";

const PipelineFlowchart = dynamic(
  () => import("@/components/dev-mode/pipeline-flowchart").then(m => m.PipelineFlowchart),
  { ssr: false }
);

const mockTraces = new Map<string, DevModeStageTrace>([
  ["skill-detection", { stageId: "skill-detection", stageName: "Skill Detection", status: "complete", /* ... */ }],
  ["planning", { stageId: "planning", stageName: "Planning", status: "running", /* ... */ }],
  // ...
]);

const defaultProps = {
  traces: mockTraces,
  isRerunning: false,
};

export const pipelineFlowchartFixture: ComponentFixture<typeof defaultProps> = {
  id: "pipeline-flowchart",
  name: "PipelineFlowchart",
  category: "dev-mode",
  description: "Pipeline DAG with status dots and timing labels",
  tags: ["streaming", "dev-mode"],
  component: PipelineFlowchart,
  defaultProps,
  states: {
    "all-complete": { traces: makeAllCompleteTraces() },
    "mid-generation": { traces: makeMidGenTraces() },
    "failed": { traces: makeFailedTraces() },
    "rerunning": { isRerunning: true },
  },
  streamSimulator: {
    durationMs: 8000,
    getPropsAtTime: (elapsed) => ({
      traces: buildProgressiveTraces(elapsed),
    }),
  },
};
```

---

## Dependencies to Install

- `shadcn` command component (cmdk-based): `bunx shadcn@latest add command`
- No other new dependencies — everything else is already in the project

---

## What This Spec Does NOT Cover

- Individual fixture implementations for all 14 components (those are implementation details)
- Visual styling of the sandbox cards (follow existing shadcn/dark theme conventions)
- Specific mock data values (fixture authors choose appropriate mocks)
- Keyboard shortcuts beyond ⌘K (can be added incrementally)

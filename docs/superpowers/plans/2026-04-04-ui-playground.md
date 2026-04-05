# UI Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dev-only `/playground` route with a CMD-K command palette for adding Ferro UI components to a sandbox canvas with mock data, state switching, streaming simulation, and render counters.

**Architecture:** Registry-based fixture system where each component gets a typed fixture file defining default props, named states, and optional stream simulators. A PlaygroundProvider context manages which fixtures are active on the canvas. shadcn's CommandDialog provides the CMD-K palette.

**Tech Stack:** Next.js 16 (App Router), React 19, shadcn Command (cmdk), Framer Motion (existing), Tailwind v4, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-04-ui-playground-design.md`

---

## File Structure

```
apps/web/src/app/playground/
├── page.tsx                        # Dev-only route, imports canvas + provider
├── AGENTS.md                       # AI agent instructions
├── types.ts                        # ComponentFixture<P>, StreamSimulator<P>, FixtureCategory
├── registry.ts                     # Barrel: all fixtures array
├── playground-provider.tsx         # React context: active fixtures, add/remove/setState
├── components/
│   ├── sandbox-card.tsx            # Compound component with Header/Body/sub-components
│   ├── command-palette.tsx         # shadcn CommandDialog with thumbnails
│   ├── playground-canvas.tsx       # Grid of active SandboxCards + empty state
│   ├── stream-transport.tsx        # Play/pause/restart/speed for streaming fixtures
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

Also modified:
├── apps/web/src/components/AGENTS.md  (create — fixture maintenance instructions)
```

---

### Task 1: Install shadcn Command component

**Files:**
- Modify: `apps/web/src/components/ui/command.tsx` (created by shadcn CLI)
- Modify: `apps/web/package.json` (cmdk dependency added)

- [ ] **Step 1: Install the command component**

Run from `apps/web/`:
```bash
cd /Users/alish/lab/Ferro/apps/web && bunx shadcn@latest add command
```

- [ ] **Step 2: Verify the component was added**

Run:
```bash
ls apps/web/src/components/ui/command.tsx
```
Expected: file exists

- [ ] **Step 3: Verify cmdk dependency**

Run:
```bash
cd /Users/alish/lab/Ferro/apps/web && bun pm ls | grep cmdk
```
Expected: `cmdk` appears in dependencies

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/command.tsx apps/web/package.json apps/web/bun.lock
git commit -m "feat(playground): add shadcn command component for CMD-K palette"
```

---

### Task 2: Create fixture type system

**Files:**
- Create: `apps/web/src/app/playground/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/src/app/playground/types.ts
import type { ComponentType } from "react";

export type FixtureCategory = "base-ui" | "upload" | "preview" | "dev-mode";

export interface StreamSimulator<P> {
  /** Duration of one full simulation cycle in ms */
  durationMs: number;
  /** Given elapsed time (0 to durationMs), return prop overrides */
  getPropsAtTime: (elapsedMs: number) => Partial<P>;
}

export interface ComponentFixture<P = Record<string, unknown>> {
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
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd /Users/alish/lab/Ferro/apps/web && npx tsc --noEmit --pretty src/app/playground/types.ts 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/playground/types.ts
git commit -m "feat(playground): add ComponentFixture and StreamSimulator type system"
```

---

### Task 3: Create PlaygroundProvider context

**Files:**
- Create: `apps/web/src/app/playground/playground-provider.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// apps/web/src/app/playground/playground-provider.tsx
"use client";

import {
  createContext,
  use,
  useCallback,
  useState,
  type ReactNode,
} from "react";

interface FixtureInstance {
  fixtureId: string;
  selectedState: string;
}

interface PlaygroundContextValue {
  activeFixtures: Map<string, FixtureInstance>;
  addFixture: (fixtureId: string) => void;
  removeFixture: (instanceId: string) => void;
  setFixtureState: (instanceId: string, stateName: string) => void;
}

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

let nextInstanceId = 0;

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [activeFixtures, setActiveFixtures] = useState<
    Map<string, FixtureInstance>
  >(() => new Map());

  const addFixture = useCallback((fixtureId: string) => {
    const instanceId = `${fixtureId}-${nextInstanceId++}`;
    setActiveFixtures((prev) => {
      const next = new Map(prev);
      next.set(instanceId, { fixtureId, selectedState: "default" });
      return next;
    });
  }, []);

  const removeFixture = useCallback((instanceId: string) => {
    setActiveFixtures((prev) => {
      const next = new Map(prev);
      next.delete(instanceId);
      return next;
    });
  }, []);

  const setFixtureState = useCallback(
    (instanceId: string, stateName: string) => {
      setActiveFixtures((prev) => {
        const existing = prev.get(instanceId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(instanceId, { ...existing, selectedState: stateName });
        return next;
      });
    },
    [],
  );

  return (
    <PlaygroundContext
      value={{ activeFixtures, addFixture, removeFixture, setFixtureState }}
    >
      {children}
    </PlaygroundContext>
  );
}

export function usePlayground(): PlaygroundContextValue {
  const ctx = use(PlaygroundContext);
  if (!ctx) throw new Error("usePlayground must be used within PlaygroundProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /Users/alish/lab/Ferro/apps/web && npx tsc --noEmit --pretty 2>&1 | grep playground | head -10
```
Expected: no errors from playground files

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/playground/playground-provider.tsx
git commit -m "feat(playground): add PlaygroundProvider context with add/remove/setState"
```

---

### Task 4: Create RenderCounter component

**Files:**
- Create: `apps/web/src/app/playground/components/render-counter.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/app/playground/components/render-counter.tsx
"use client";

import { useRef } from "react";

export function RenderCounter() {
  const count = useRef(0);
  count.current++;

  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      renders: {count.current}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/playground/components/render-counter.tsx
git commit -m "feat(playground): add ref-based RenderCounter badge"
```

---

### Task 5: Create StreamTransport controls

**Files:**
- Create: `apps/web/src/app/playground/components/stream-transport.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/app/playground/components/stream-transport.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { StreamSimulator } from "../types";

interface StreamTransportProps<P> {
  simulator: StreamSimulator<P>;
  onPropsUpdate: (overrides: Partial<P>) => void;
}

const SPEEDS = [0.5, 1, 2] as const;

export function StreamTransport<P>({
  simulator,
  onPropsUpdate,
}: StreamTransportProps<P>) {
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef<number>(0);

  const speed = SPEEDS[speedIndex];

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = now - lastFrameRef.current;
    lastFrameRef.current = now;
    elapsedRef.current = Math.min(
      elapsedRef.current + delta * speed,
      simulator.durationMs,
    );

    onPropsUpdate(simulator.getPropsAtTime(elapsedRef.current));

    if (elapsedRef.current < simulator.durationMs) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setPlaying(false);
    }
  }, [speed, simulator, onPropsUpdate]);

  useEffect(() => {
    if (playing) {
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  const handlePlayPause = () => {
    if (!playing && elapsedRef.current >= simulator.durationMs) {
      elapsedRef.current = 0;
    }
    setPlaying((p) => !p);
  };

  const handleRestart = () => {
    elapsedRef.current = 0;
    onPropsUpdate(simulator.getPropsAtTime(0));
    setPlaying(true);
  };

  const cycleSpeed = () => {
    setSpeedIndex((i) => (i + 1) % SPEEDS.length);
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-xs" onClick={handlePlayPause}>
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={handleRestart}>
        <RotateCcw className="h-3 w-3" />
      </Button>
      <button
        onClick={cycleSpeed}
        className="rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted"
      >
        {speed}x
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/playground/components/stream-transport.tsx
git commit -m "feat(playground): add StreamTransport play/pause/restart/speed controls"
```

---

### Task 6: Create SandboxCard compound component

**Files:**
- Create: `apps/web/src/app/playground/components/sandbox-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/app/playground/components/sandbox-card.tsx
"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { RenderCounter } from "./render-counter";
import { StreamTransport } from "./stream-transport";
import { usePlayground } from "../playground-provider";
import type { ComponentFixture } from "../types";

interface SandboxCardContext {
  fixture: ComponentFixture<any>;
  instanceId: string;
  resolvedProps: Record<string, unknown>;
  streamOverrides: Record<string, unknown>;
  setStreamOverrides: (overrides: Record<string, unknown>) => void;
}

const SandboxCardCtx = createContext<SandboxCardContext | null>(null);

function useSandboxCard() {
  const ctx = use(SandboxCardCtx);
  if (!ctx) throw new Error("SandboxCard sub-components must be used within SandboxCard");
  return ctx;
}

// --- Sub-components ---

function Header({ children }: { children: ReactNode }) {
  return (
    <CardHeader className="flex flex-row flex-wrap items-center gap-2 border-b px-4 py-2.5">
      {children}
    </CardHeader>
  );
}

function Title() {
  const { fixture } = useSandboxCard();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold">{fixture.name}</span>
      {fixture.tags.map((tag) => (
        <span
          key={tag}
          className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function StateDropdown() {
  const { fixture, instanceId } = useSandboxCard();
  const { setFixtureState } = usePlayground();
  const stateNames = ["default", ...Object.keys(fixture.states)];

  return (
    <select
      className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
      onChange={(e) => setFixtureState(instanceId, e.target.value)}
      defaultValue="default"
    >
      {stateNames.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

function StreamControls() {
  const { fixture, setStreamOverrides } = useSandboxCard();
  if (!fixture.streamSimulator) return null;

  return (
    <StreamTransport
      simulator={fixture.streamSimulator}
      onPropsUpdate={setStreamOverrides}
    />
  );
}

function CloseButton() {
  const { instanceId } = useSandboxCard();
  const { removeFixture } = usePlayground();

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="ml-auto text-muted-foreground hover:text-destructive"
      onClick={() => removeFixture(instanceId)}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}

function Body() {
  const { fixture, resolvedProps } = useSandboxCard();
  const Component = fixture.component;

  return (
    <CardContent className="p-4">
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Component crashed</p>
            <p className="mt-1 font-mono text-xs">{error.message}</p>
            <button
              onClick={reset}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Reset
            </button>
          </div>
        )}
      >
        <Component {...(resolvedProps as any)} />
      </ErrorBoundary>
    </CardContent>
  );
}

// --- Main component ---

export function SandboxCard({
  fixture,
  instanceId,
  selectedState,
}: {
  fixture: ComponentFixture<any>;
  instanceId: string;
  selectedState: string;
}) {
  const [streamOverrides, setStreamOverrides] = useState<
    Record<string, unknown>
  >({});

  const resolvedProps = useMemo(() => {
    const stateOverrides =
      selectedState !== "default" ? fixture.states[selectedState] ?? {} : {};
    return { ...fixture.defaultProps, ...stateOverrides, ...streamOverrides };
  }, [fixture, selectedState, streamOverrides]);

  const ctx = useMemo<SandboxCardContext>(
    () => ({
      fixture,
      instanceId,
      resolvedProps,
      streamOverrides,
      setStreamOverrides,
    }),
    [fixture, instanceId, resolvedProps, streamOverrides],
  );

  return (
    <SandboxCardCtx value={ctx}>
      <Card data-sandbox-card={fixture.id} className="overflow-hidden">
        <Header>
          <Title />
          <RenderCounter />
          <StateDropdown />
          <StreamControls />
          <CloseButton />
        </Header>
        <Body />
      </Card>
    </SandboxCardCtx>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /Users/alish/lab/Ferro/apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i error | head -10
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/playground/components/sandbox-card.tsx
git commit -m "feat(playground): add SandboxCard compound component with state/stream/error handling"
```

---

### Task 7: Create CommandPalette component

**Files:**
- Create: `apps/web/src/app/playground/components/command-palette.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/app/playground/components/command-palette.tsx
"use client";

import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { usePlayground } from "../playground-provider";
import type { ComponentFixture, FixtureCategory } from "../types";

const CATEGORY_LABELS: Record<FixtureCategory, string> = {
  "base-ui": "Base UI",
  upload: "Upload",
  preview: "Preview",
  "dev-mode": "Dev Mode",
};

const CATEGORY_ORDER: FixtureCategory[] = [
  "base-ui",
  "upload",
  "preview",
  "dev-mode",
];

function groupByCategory(
  fixtures: ComponentFixture<any>[],
): Map<FixtureCategory, ComponentFixture<any>[]> {
  const groups = new Map<FixtureCategory, ComponentFixture<any>[]>();
  for (const f of fixtures) {
    const list = groups.get(f.category) ?? [];
    list.push(f);
    groups.set(f.category, list);
  }
  return groups;
}

export function CommandPalette({
  fixtures,
}: {
  fixtures: ComponentFixture<any>[];
}) {
  const [open, setOpen] = useState(false);
  const { activeFixtures, addFixture, removeFixture } = usePlayground();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const activeFixtureIds = new Set(
    Array.from(activeFixtures.values()).map((f) => f.fixtureId),
  );

  const grouped = groupByCategory(fixtures);

  const handleSelect = (fixture: ComponentFixture<any>) => {
    addFixture(fixture.id);
    setOpen(false);
  };

  const handleRemove = (fixtureId: string) => {
    for (const [instanceId, instance] of activeFixtures) {
      if (instance.fixtureId === fixtureId) {
        removeFixture(instanceId);
        break;
      }
    }
  };

  return (
    <>
      {activeFixtures.size === 0 && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Press{" "}
            <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">
              <span className="text-xs">⌘</span>K
            </kbd>{" "}
            to add components
          </p>
        </div>
      )}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search components..." />
        <CommandList>
          <CommandEmpty>No components found.</CommandEmpty>
          {CATEGORY_ORDER.map((category) => {
            const items = grouped.get(category);
            if (!items?.length) return null;
            return (
              <CommandGroup key={category} heading={CATEGORY_LABELS[category]}>
                {items.map((fixture) => {
                  const isActive = activeFixtureIds.has(fixture.id);
                  return (
                    <CommandItem
                      key={fixture.id}
                      value={`${fixture.name} ${fixture.description} ${fixture.tags.join(" ")}`}
                      onSelect={() =>
                        isActive
                          ? handleRemove(fixture.id)
                          : handleSelect(fixture)
                      }
                    >
                      {fixture.thumbnail && (
                        <div className="flex h-10 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded border bg-background">
                          <div className="scale-[0.4] transform">
                            <fixture.thumbnail />
                          </div>
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-medium">
                          {fixture.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {fixture.description}
                        </div>
                      </div>
                      {isActive && (
                        <span className="flex-shrink-0 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">
                          on canvas
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /Users/alish/lab/Ferro/apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i error | head -10
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/playground/components/command-palette.tsx
git commit -m "feat(playground): add CMD-K CommandPalette with category grouping and thumbnails"
```

---

### Task 8: Create PlaygroundCanvas and page.tsx

**Files:**
- Create: `apps/web/src/app/playground/components/playground-canvas.tsx`
- Create: `apps/web/src/app/playground/page.tsx`

- [ ] **Step 1: Create PlaygroundCanvas**

```tsx
// apps/web/src/app/playground/components/playground-canvas.tsx
"use client";

import { usePlayground } from "../playground-provider";
import { SandboxCard } from "./sandbox-card";
import type { ComponentFixture } from "../types";

export function PlaygroundCanvas({
  fixtures,
}: {
  fixtures: ComponentFixture<any>[];
}) {
  const { activeFixtures } = usePlayground();
  const fixtureMap = new Map(fixtures.map((f) => [f.id, f]));

  if (activeFixtures.size === 0) return null;

  return (
    <div className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-4 p-4">
      {Array.from(activeFixtures.entries()).map(
        ([instanceId, { fixtureId, selectedState }]) => {
          const fixture = fixtureMap.get(fixtureId);
          if (!fixture) return null;
          return (
            <SandboxCard
              key={instanceId}
              fixture={fixture}
              instanceId={instanceId}
              selectedState={selectedState}
            />
          );
        },
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create page.tsx**

```tsx
// apps/web/src/app/playground/page.tsx
import { redirect } from "next/navigation";
import { PlaygroundProvider } from "./playground-provider";
import { PlaygroundCanvas } from "./components/playground-canvas";
import { CommandPalette } from "./components/command-palette";
import { fixtures } from "./registry";

export default function PlaygroundPage() {
  if (process.env.NODE_ENV !== "development") {
    redirect("/");
  }

  return (
    <PlaygroundProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold tracking-tight">
              Component Playground
            </h1>
            <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </header>
        <CommandPalette fixtures={fixtures} />
        <PlaygroundCanvas fixtures={fixtures} />
      </div>
    </PlaygroundProvider>
  );
}
```

- [ ] **Step 3: Create an empty registry (temporary — fixtures added in later tasks)**

```typescript
// apps/web/src/app/playground/registry.ts
import type { ComponentFixture } from "./types";

export const fixtures: ComponentFixture<any>[] = [];
```

- [ ] **Step 4: Verify the page compiles and route is registered**

Run:
```bash
cd /Users/alish/lab/Ferro/apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i error | head -10
```
Expected: no errors

Then verify the route:
```
mcp__next-devtools__nextjs_call(port="3000", toolName="get_routes", args='{"routerType": "app"}')
```
Expected: `/playground` in the route list

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/playground/page.tsx apps/web/src/app/playground/components/playground-canvas.tsx apps/web/src/app/playground/registry.ts
git commit -m "feat(playground): add page.tsx, PlaygroundCanvas, and empty registry"
```

---

### Task 9: Verify end-to-end playground loads

- [ ] **Step 1: Open the playground in a browser**

```
mcp__next-devtools__browser_eval(action="start")
mcp__next-devtools__browser_eval(action="navigate", url="http://localhost:3000/playground")
```

- [ ] **Step 2: Screenshot to verify empty state renders**

```
mcp__next-devtools__browser_eval(action="screenshot")
```
Expected: page shows "Component Playground" header and "Press ⌘K to add components" prompt

- [ ] **Step 3: Check for errors**

```
mcp__next-devtools__nextjs_call(port="3000", toolName="get_errors")
```
Expected: no errors

- [ ] **Step 4: Fix any issues found, then commit**

If issues found, fix and:
```bash
git add -A apps/web/src/app/playground/
git commit -m "fix(playground): fix issues from initial smoke test"
```

---

### Task 10: Create AGENTS.md files

**Files:**
- Create: `apps/web/src/app/playground/AGENTS.md`
- Create: `apps/web/src/components/AGENTS.md`

- [ ] **Step 1: Create playground AGENTS.md**

Write the full content from the spec's "AGENTS.md Files" section — the `apps/web/src/app/playground/AGENTS.md` block. This includes:
- "Adding a new component fixture" instructions (6 steps)
- "Fixture conventions" (4 bullet points)
- "Profiling & Diagnosing Components with next-devtools MCP" (full section with all tool tables, setup, diagnosing, browser profiling, and workflow)

Copy the content verbatim from the spec at `docs/superpowers/specs/2026-04-04-ui-playground-design.md`, lines 217-355.

- [ ] **Step 2: Create components AGENTS.md**

Write the content from the spec's "Addition to `apps/web/src/components/AGENTS.md`" block. This includes:
- "Playground Fixtures" section (fixture maintenance rule)
- "Profiling Components with next-devtools MCP" section (7-step quick reference)

Copy the content verbatim from the spec at `docs/superpowers/specs/2026-04-04-ui-playground-design.md`, lines 359-378.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/playground/AGENTS.md apps/web/src/components/AGENTS.md
git commit -m "docs(playground): add AGENTS.md for playground and components directories"
```

---

### Task 11: Create Batch 1 fixtures — simple components (parallel subagents)

**Dispatch 4 subagents in parallel.** Each agent receives:
1. The `ComponentFixture` type from `apps/web/src/app/playground/types.ts`
2. The target component source files (to read prop interfaces)
3. Relevant types from `apps/web/src/lib/ferro-contracts.ts`
4. The AnimatedProgress fixture example from the spec as reference
5. Instruction to write the fixture file to `apps/web/src/app/playground/fixtures/`

**Agent 1 — Button, Spinner, Label:**

- [ ] **Step 1: Read source files**

Read:
- `apps/web/src/components/ui/button.tsx` (variants: default/outline/secondary/ghost/destructive/link, sizes: default/xs/sm/lg/icon/icon-xs/icon-sm/icon-lg)
- `apps/web/src/components/ui/spinner.tsx` (props: `className?: string`)
- `apps/web/src/components/ui/label.tsx` (standard label props)

- [ ] **Step 2: Create `button.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/button.fixture.ts
import { Button } from "@/components/ui/button";
import type { ComponentFixture } from "../types";

const defaultProps = {
  children: "Click me" as React.ReactNode,
  variant: "default" as const,
  size: "default" as const,
};

export const buttonFixture: ComponentFixture<typeof defaultProps> = {
  id: "button",
  name: "Button",
  category: "base-ui",
  description: "6 variants, 8 sizes, built on Base UI",
  tags: [],
  component: Button as any,
  defaultProps,
  states: {
    outline: { variant: "outline" },
    secondary: { variant: "secondary" },
    ghost: { variant: "ghost" },
    destructive: { variant: "destructive" },
    link: { variant: "link" },
    small: { size: "sm" },
    large: { size: "lg" },
    disabled: { disabled: true } as any,
  },
};
```

- [ ] **Step 3: Create `spinner.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/spinner.fixture.ts
import { Spinner } from "@/components/ui/spinner";
import type { ComponentFixture } from "../types";

const defaultProps = {
  className: "",
};

export const spinnerFixture: ComponentFixture<typeof defaultProps> = {
  id: "spinner",
  name: "Spinner",
  category: "base-ui",
  description: "Animated loader circle",
  tags: ["animated"],
  component: Spinner,
  defaultProps,
  states: {
    large: { className: "h-8 w-8" },
    "text-color": { className: "text-blue-400" },
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/playground/fixtures/button.fixture.ts apps/web/src/app/playground/fixtures/spinner.fixture.ts
git commit -m "feat(playground): add button and spinner fixtures"
```

**Agent 2 — StatusPill, AnimatedProgress:**

- [ ] **Step 1: Read source files**

Read:
- `apps/web/src/components/ui/status-pill.tsx` (props: `status: string`, `className?: string`)
- `apps/web/src/components/ui/animated-progress.tsx` (props: `value?: number`, `indeterminate?: boolean`, `tone?: ProgressTone`, `className?: string`)

- [ ] **Step 2: Create `status-pill.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/status-pill.fixture.ts
import { StatusPill } from "@/components/ui/status-pill";
import type { ComponentFixture } from "../types";

const defaultProps = {
  status: "ready",
};

export const statusPillFixture: ComponentFixture<typeof defaultProps> = {
  id: "status-pill",
  name: "StatusPill",
  category: "base-ui",
  description: "Colored status badge for ready/generating/queued/failed",
  tags: [],
  component: StatusPill,
  defaultProps,
  states: {
    ready: { status: "ready" },
    generating: { status: "generating" },
    queued: { status: "queued" },
    failed: { status: "failed" },
  },
};
```

- [ ] **Step 3: Create `animated-progress.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/animated-progress.fixture.ts
import { AnimatedProgress } from "@/components/ui/animated-progress";
import type { ComponentFixture } from "../types";

const defaultProps = {
  value: 0.65 as number | undefined,
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
    indeterminate: { indeterminate: true, tone: "loading", value: undefined },
  },
  streamSimulator: {
    durationMs: 5000,
    getPropsAtTime: (elapsed) => ({
      value: Math.min(elapsed / 5000, 1),
      tone: elapsed >= 5000 ? ("success" as const) : ("loading" as const),
    }),
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/playground/fixtures/status-pill.fixture.ts apps/web/src/app/playground/fixtures/animated-progress.fixture.ts
git commit -m "feat(playground): add status-pill and animated-progress fixtures"
```

**Agent 3 — Card, FieldCard:**

- [ ] **Step 1: Read source files**

Read:
- `apps/web/src/components/ui/card.tsx` (exports: Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter; Card props: `size?: "default" | "sm"`)
- `apps/web/src/components/upload/field-card.tsx` (props: id, name, label, title, description, placeholder, icon, iconClassName?, action?, children?, plus Textarea props)

- [ ] **Step 2: Create `card.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/card.fixture.ts
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createElement, type ReactNode } from "react";
import type { ComponentFixture } from "../types";

function CardDemo({ size, showFooter }: { size?: "default" | "sm"; showFooter?: boolean }) {
  return createElement(Card, { size },
    createElement(CardHeader, null,
      createElement(CardTitle, null, "Card Title"),
      createElement(CardDescription, null, "Card description text"),
    ),
    createElement(CardContent, null,
      createElement("p", { className: "text-sm text-muted-foreground" }, "Card body content goes here."),
    ),
    showFooter
      ? createElement(CardFooter, null,
          createElement("p", { className: "text-xs text-muted-foreground" }, "Footer text"),
        )
      : null,
  );
}

const defaultProps = {
  size: "default" as const,
  showFooter: true,
};

export const cardFixture: ComponentFixture<typeof defaultProps> = {
  id: "card",
  name: "Card",
  category: "base-ui",
  description: "Composable card with header, content, footer sections",
  tags: [],
  component: CardDemo,
  defaultProps,
  states: {
    small: { size: "sm" },
    "no-footer": { showFooter: false },
  },
};
```

- [ ] **Step 3: Create `field-card.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/field-card.fixture.ts
import { FieldCard } from "@/components/upload/field-card";
import { Sparkles } from "lucide-react";
import type { ComponentFixture } from "../types";

const defaultProps = {
  id: "taste",
  name: "taste",
  label: "Taste / style",
  title: "Taste",
  description: "Describe the visual style you want",
  placeholder: "Minimalist, clean typography, subtle animations...",
  icon: Sparkles,
  value: "Bold typography with neon accents on dark background",
  onChange: (() => {}) as any,
};

export const fieldCardFixture: ComponentFixture<typeof defaultProps> = {
  id: "field-card",
  name: "FieldCard",
  category: "upload",
  description: "Form field with card wrapper, icon, and textarea",
  tags: [],
  component: FieldCard as any,
  defaultProps,
  states: {
    empty: { value: "" },
    long: {
      value:
        "A vibrant, maximalist design with layered textures, bold gradients, and dynamic motion graphics. Think Y2K meets modern editorial with lots of kinetic typography and expressive color transitions.",
    },
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/playground/fixtures/card.fixture.ts apps/web/src/app/playground/fixtures/field-card.fixture.ts
git commit -m "feat(playground): add card and field-card fixtures"
```

**Agent 4 — ResolutionSelector, ModelSelector:**

- [ ] **Step 1: Read source files**

Read:
- `apps/web/src/components/ui/resolution-selector.tsx` (props: `value: Resolution`, `onChange: (r: Resolution) => void`, `className?: string`; Resolution = `{ width: number, height: number }`)
- `apps/web/src/components/ui/model-selector.tsx` (props: `value: ModelId | string`, `onChange: (value: string) => void`, `className?: string`)

- [ ] **Step 2: Create `resolution-selector.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/resolution-selector.fixture.ts
"use client";

import { useState } from "react";
import {
  ResolutionSelector,
  type Resolution,
} from "@/components/ui/resolution-selector";
import type { ComponentFixture } from "../types";

function ResolutionSelectorWrapper(props: {
  initialWidth: number;
  initialHeight: number;
}) {
  const [value, setValue] = useState<Resolution>({
    width: props.initialWidth,
    height: props.initialHeight,
  });
  return <ResolutionSelector value={value} onChange={setValue} />;
}

const defaultProps = {
  initialWidth: 1920,
  initialHeight: 1080,
};

export const resolutionSelectorFixture: ComponentFixture<typeof defaultProps> = {
  id: "resolution-selector",
  name: "ResolutionSelector",
  category: "base-ui",
  description: "Preset pills + free input + aspect ratio calculator",
  tags: [],
  component: ResolutionSelectorWrapper,
  defaultProps,
  states: {
    portrait: { initialWidth: 1080, initialHeight: 1920 },
    square: { initialWidth: 1080, initialHeight: 1080 },
    "4k": { initialWidth: 3840, initialHeight: 2160 },
  },
};
```

- [ ] **Step 3: Create `model-selector.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/model-selector.fixture.ts
"use client";

import { useState } from "react";
import { ModelSelector } from "@/components/ui/model-selector";
import type { ComponentFixture } from "../types";

function ModelSelectorWrapper(props: { initialModel: string }) {
  const [value, setValue] = useState(props.initialModel);
  return <ModelSelector value={value} onChange={setValue} />;
}

const defaultProps = {
  initialModel: "openai:gpt-4o",
};

export const modelSelectorFixture: ComponentFixture<typeof defaultProps> = {
  id: "model-selector",
  name: "ModelSelector",
  category: "base-ui",
  description: "Dropdown for selecting AI model from MODELS array",
  tags: [],
  component: ModelSelectorWrapper,
  defaultProps,
  states: {
    "gpt-4o-mini": { initialModel: "openai:gpt-4o-mini" },
    claude: { initialModel: "anthropic:claude-sonnet-4-6" },
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/playground/fixtures/resolution-selector.fixture.ts apps/web/src/app/playground/fixtures/model-selector.fixture.ts
git commit -m "feat(playground): add resolution-selector and model-selector fixtures"
```

---

### Task 12: Create Batch 2 fixtures — complex/streaming components (parallel subagents)

**Dispatch 3 subagents in parallel.** Same instructions template as Task 11, but these agents also receive `apps/web/src/lib/ferro-contracts.ts` for mock data types.

**Agent 5 — GenerationStatus:**

- [ ] **Step 1: Read source files**

Read:
- `apps/web/src/components/upload/generation-status.tsx` (props: `jobState: JobState`, `progress?: number | null`, `totalLayers?: number`, `layerCounts?: GenerationCounts | null`)
- Types: `JobTone`, `JobState`, `GenerationCounts` from same file

- [ ] **Step 2: Create `generation-status.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/generation-status.fixture.ts
import {
  GenerationStatus,
  type GenerationCounts,
  type JobState,
} from "@/components/upload/generation-status";
import type { ComponentFixture } from "../types";

const loadingState: JobState = {
  tone: "loading",
  title: "Generating layers",
  detail: "Creating lower-third overlay...",
};

const successState: JobState = {
  tone: "success",
  title: "Generation complete",
  detail: "4 layers ready",
};

const errorState: JobState = {
  tone: "error",
  title: "Generation failed",
  detail: "Layer generation timed out after 30s",
};

const idleState: JobState = {
  tone: "idle",
  title: "Ready",
  detail: "Configure your video and hit generate",
};

const midCounts: GenerationCounts = {
  ready: 2,
  generating: 1,
  queued: 3,
  failed: 0,
};

const doneCounts: GenerationCounts = {
  ready: 4,
  generating: 0,
  queued: 0,
  failed: 0,
};

const failedCounts: GenerationCounts = {
  ready: 2,
  generating: 0,
  queued: 0,
  failed: 1,
};

const defaultProps = {
  jobState: loadingState,
  progress: 0.45 as number | null | undefined,
  totalLayers: 6 as number | undefined,
  layerCounts: midCounts as GenerationCounts | null | undefined,
};

export const generationStatusFixture: ComponentFixture<typeof defaultProps> = {
  id: "generation-status",
  name: "GenerationStatus",
  category: "upload",
  description: "Progress bar + status tone + layer count badges",
  tags: ["streaming", "animated"],
  component: GenerationStatus,
  defaultProps,
  states: {
    idle: { jobState: idleState, progress: null, layerCounts: null },
    loading: { jobState: loadingState, progress: 0.45, layerCounts: midCounts },
    success: { jobState: successState, progress: 1, layerCounts: doneCounts },
    error: { jobState: errorState, progress: 0.33, layerCounts: failedCounts },
  },
  streamSimulator: {
    durationMs: 6000,
    getPropsAtTime: (elapsed) => {
      const progress = Math.min(elapsed / 6000, 1);
      const readyCount = Math.floor(progress * 4);
      const generating = readyCount < 4 ? 1 : 0;
      const queued = Math.max(0, 4 - readyCount - generating);
      return {
        jobState:
          progress >= 1
            ? successState
            : {
                tone: "loading" as const,
                title: "Generating layers",
                detail: `Creating layer ${readyCount + 1} of 4...`,
              },
        progress,
        totalLayers: 4,
        layerCounts: {
          ready: readyCount,
          generating,
          queued,
          failed: 0,
        },
      };
    },
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/playground/fixtures/generation-status.fixture.ts
git commit -m "feat(playground): add generation-status fixture with stream simulator"
```

**Agent 6 — PipelineFlowchart, StageDetail:**

- [ ] **Step 1: Read source files**

Read:
- `apps/web/src/components/dev-mode/pipeline-flowchart.tsx` (props: `traces: Map<string, DevModeStageTrace>`, `onRerunStage?: callback`, `isRerunning?: boolean`)
- `apps/web/src/components/dev-mode/stage-detail.tsx` (props: `trace: DevModeStageTrace`, `onRerun?: callback`, `isRerunning?: boolean`)
- `DevModeStageTrace` and `DevModeTokenUsage` from `ferro-contracts.ts`

- [ ] **Step 2: Create `pipeline-flowchart.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/pipeline-flowchart.fixture.ts
import dynamic from "next/dynamic";
import type { DevModeStageTrace, DevModeTokenUsage } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";

const PipelineFlowchart = dynamic(
  () =>
    import("@/components/dev-mode/pipeline-flowchart").then(
      (m) => m.PipelineFlowchart,
    ),
  { ssr: false },
);

const mockTokens: DevModeTokenUsage = {
  inputTokens: 2450,
  outputTokens: 890,
  cacheReadTokens: 1200,
  cacheWriteTokens: 0,
};

function makeTrace(
  id: string,
  name: string,
  status: DevModeStageTrace["status"],
  durationMs: number | null = null,
): DevModeStageTrace {
  return {
    stageId: id,
    stageName: name,
    status,
    systemPrompt: `You are the ${name.toLowerCase()} stage...`,
    userPrompt: `Process the following input for ${name.toLowerCase()}...`,
    rawOutput: status === "complete" ? `{"result": "mock output for ${id}"}` : null,
    modelId: "openai:gpt-4o",
    startedAt: "2026-04-04T10:00:00Z",
    completedAt: status === "complete" ? "2026-04-04T10:00:02Z" : null,
    durationMs,
    tokenUsage: status === "complete" ? mockTokens : null,
    finishReason: status === "complete" ? "stop" : null,
    error: status === "failed" ? "Timeout after 30000ms" : null,
  };
}

const allCompleteTraces = new Map<string, DevModeStageTrace>([
  ["skill-detection", makeTrace("skill-detection", "Skill Detection", "complete", 450)],
  ["planning", makeTrace("planning", "Planning", "complete", 1200)],
  ["system-prompt-build", makeTrace("system-prompt-build", "System Prompt Build", "complete", 12)],
  ["layer-gen-lower-third", makeTrace("layer-gen-lower-third", "Layer: Lower Third", "complete", 3400)],
  ["layer-gen-title-card", makeTrace("layer-gen-title-card", "Layer: Title Card", "complete", 2800)],
]);

const midGenTraces = new Map<string, DevModeStageTrace>([
  ["skill-detection", makeTrace("skill-detection", "Skill Detection", "complete", 450)],
  ["planning", makeTrace("planning", "Planning", "complete", 1200)],
  ["system-prompt-build", makeTrace("system-prompt-build", "System Prompt Build", "complete", 12)],
  ["layer-gen-lower-third", makeTrace("layer-gen-lower-third", "Layer: Lower Third", "running")],
  ["layer-gen-title-card", makeTrace("layer-gen-title-card", "Layer: Title Card", "pending")],
]);

const failedTraces = new Map<string, DevModeStageTrace>([
  ["skill-detection", makeTrace("skill-detection", "Skill Detection", "complete", 450)],
  ["planning", makeTrace("planning", "Planning", "failed")],
]);

const defaultProps = {
  traces: midGenTraces,
  isRerunning: false,
  onRerunStage: (() => {}) as any,
};

export const pipelineFlowchartFixture: ComponentFixture<typeof defaultProps> = {
  id: "pipeline-flowchart",
  name: "PipelineFlowchart",
  category: "dev-mode",
  description: "Pipeline DAG with status dots, timing, and token labels",
  tags: ["streaming", "dev-mode"],
  component: PipelineFlowchart as any,
  defaultProps,
  states: {
    "all-complete": { traces: allCompleteTraces },
    "mid-generation": { traces: midGenTraces },
    failed: { traces: failedTraces },
    rerunning: { isRerunning: true },
  },
  streamSimulator: {
    durationMs: 8000,
    getPropsAtTime: (elapsed) => {
      const stages = [
        { id: "skill-detection", name: "Skill Detection", at: 0 },
        { id: "planning", name: "Planning", at: 1000 },
        { id: "system-prompt-build", name: "System Prompt Build", at: 2500 },
        { id: "layer-gen-lower-third", name: "Layer: Lower Third", at: 3000 },
        { id: "layer-gen-title-card", name: "Layer: Title Card", at: 5000 },
      ];
      const traces = new Map<string, DevModeStageTrace>();
      for (const stage of stages) {
        const stageElapsed = elapsed - stage.at;
        if (stageElapsed < 0) {
          traces.set(stage.id, makeTrace(stage.id, stage.name, "pending"));
        } else if (stageElapsed < 1500) {
          traces.set(stage.id, makeTrace(stage.id, stage.name, "running"));
        } else {
          traces.set(
            stage.id,
            makeTrace(stage.id, stage.name, "complete", 1500),
          );
        }
      }
      return { traces };
    },
  },
};
```

- [ ] **Step 3: Create `stage-detail.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/stage-detail.fixture.ts
import dynamic from "next/dynamic";
import type { DevModeStageTrace } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";

const StageDetail = dynamic(
  () =>
    import("@/components/dev-mode/stage-detail").then((m) => m.StageDetail),
  { ssr: false },
);

const completeTrace: DevModeStageTrace = {
  stageId: "planning",
  stageName: "Planning",
  status: "complete",
  systemPrompt:
    "You are a video graphics planner. Given a transcript and style description, plan the overlay layers.\n\nLayer types: lower-third, title-card, stat-callout, quote-overlay, outro-card, captions.\n\nReturn a JSON array of planned layers with type, title, brief, from (frame), and durationInFrames.",
  userPrompt:
    'Transcript: "Welcome to our Q4 earnings review. Revenue grew 23% year over year..."\n\nStyle: Minimalist, clean typography, subtle animations\n\nVideo: 1920x1080 @ 30fps, 45 seconds',
  rawOutput:
    '[\n  {"type": "title-card", "title": "Q4 Earnings Review", "brief": "Bold title with fade-in", "from": 0, "durationInFrames": 90},\n  {"type": "lower-third", "title": "Revenue Growth", "brief": "23% YoY stat with counter animation", "from": 120, "durationInFrames": 150}\n]',
  modelId: "openai:gpt-4o",
  startedAt: "2026-04-04T10:00:00.500Z",
  completedAt: "2026-04-04T10:00:01.700Z",
  durationMs: 1200,
  tokenUsage: {
    inputTokens: 1850,
    outputTokens: 420,
    cacheReadTokens: 800,
    cacheWriteTokens: 0,
  },
  finishReason: "stop",
  error: null,
};

const runningTrace: DevModeStageTrace = {
  ...completeTrace,
  status: "running",
  rawOutput: null,
  completedAt: null,
  durationMs: null,
  tokenUsage: null,
  finishReason: null,
};

const failedTrace: DevModeStageTrace = {
  ...completeTrace,
  status: "failed",
  rawOutput: null,
  completedAt: "2026-04-04T10:00:31.500Z",
  durationMs: 31000,
  finishReason: null,
  error: "Timeout: model did not respond within 30000ms",
};

const defaultProps = {
  trace: completeTrace,
  isRerunning: false,
  onRerun: (() => {}) as any,
};

export const stageDetailFixture: ComponentFixture<typeof defaultProps> = {
  id: "stage-detail",
  name: "StageDetail",
  category: "dev-mode",
  description: "Expandable detail panel with Monaco, prompts, token badges",
  tags: ["streaming", "dev-mode"],
  component: StageDetail as any,
  defaultProps,
  states: {
    complete: { trace: completeTrace },
    running: { trace: runningTrace },
    failed: { trace: failedTrace },
    rerunning: { isRerunning: true },
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/playground/fixtures/pipeline-flowchart.fixture.ts apps/web/src/app/playground/fixtures/stage-detail.fixture.ts
git commit -m "feat(playground): add pipeline-flowchart and stage-detail fixtures with mock traces"
```

**Agent 7 — GraphicCard, CompositorPreview, PendingAssistantText:**

- [ ] **Step 1: Read source files**

Read:
- `apps/web/src/components/preview/GraphicCard.tsx` (props: `layer: FerroLayer`, `fps: number`, `width: number`, `height: number`, `messages: FerroLayerMessage[]`, `versionCount: number`, `onCodeChange: (code: string) => void`, `onEditPrompt: (prompt: string) => void | Promise<void>`)
- `apps/web/src/components/preview/CompositorPreview.tsx` (props: `videoObjectUrl: string | null`, `layers: FerroLayer[]`, `fps: number`, `width: number`, `height: number`, `durationInFrames: number`)
- `apps/web/src/components/preview/pending-assistant-text.tsx` (no props)
- `FerroLayer`, `FerroLayerMessage`, `FerroLayerVersion` from `ferro-contracts.ts`

- [ ] **Step 2: Create `graphic-card.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/graphic-card.fixture.ts
import dynamic from "next/dynamic";
import type { FerroLayer, FerroLayerMessage } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";

const GraphicCard = dynamic(
  () => import("@/components/preview/GraphicCard").then((m) => m.GraphicCard),
  { ssr: false },
);

const MOCK_CODE = `const { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } = Remotion;

export default function LowerThird() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 15, durationInFrames - 15, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: 40 }}>
      <div style={{ opacity, background: "rgba(0,0,0,0.7)", padding: "12px 24px", borderRadius: 8 }}>
        <div style={{ color: "#fff", fontSize: 24, fontWeight: 700 }}>John Smith</div>
        <div style={{ color: "#aaa", fontSize: 16 }}>CEO, Acme Corp</div>
      </div>
    </AbsoluteFill>
  );
};`;

const mockLayer: FerroLayer = {
  id: "layer-lower-third-1",
  code: MOCK_CODE,
  brief: "Name and title lower third with fade in/out",
  type: "lower-third",
  title: "Lower Third",
  from: 30,
  durationInFrames: 150,
  status: "ready",
  error: null,
  currentVersionId: "v1",
};

const generatingLayer: FerroLayer = {
  ...mockLayer,
  status: "generating",
  code: "",
};

const failedLayer: FerroLayer = {
  ...mockLayer,
  status: "failed",
  error: "SyntaxError: Unexpected token at line 5",
};

const mockMessages: FerroLayerMessage[] = [
  {
    id: "msg-1",
    layerId: mockLayer.id,
    role: "user",
    text: "Make the text larger and add a blue accent line",
    createdAt: "2026-04-04T10:01:00Z",
    versionId: null,
    status: "complete",
  },
  {
    id: "msg-2",
    layerId: mockLayer.id,
    role: "assistant",
    text: "I've increased the font size to 32px and added a blue accent bar above the name.",
    createdAt: "2026-04-04T10:01:05Z",
    versionId: "v2",
    status: "complete",
  },
];

const defaultProps = {
  layer: mockLayer,
  fps: 30,
  width: 1920,
  height: 1080,
  messages: mockMessages,
  versionCount: 2,
  onCodeChange: (() => {}) as (code: string) => void,
  onEditPrompt: (() => {}) as (prompt: string) => void,
};

export const graphicCardFixture: ComponentFixture<typeof defaultProps> = {
  id: "graphic-card",
  name: "GraphicCard",
  category: "preview",
  description: "Remotion player preview + code editor + chat interface",
  tags: ["streaming"],
  component: GraphicCard as any,
  defaultProps,
  states: {
    ready: { layer: mockLayer },
    generating: { layer: generatingLayer, messages: [] },
    failed: { layer: failedLayer },
    "with-chat": { messages: mockMessages },
    "no-chat": { messages: [], versionCount: 1 },
  },
};
```

- [ ] **Step 3: Create `compositor-preview.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/compositor-preview.fixture.ts
import dynamic from "next/dynamic";
import type { FerroLayer } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";

const CompositorPreview = dynamic(
  () =>
    import("@/components/preview/CompositorPreview").then(
      (m) => m.CompositorPreview,
    ),
  { ssr: false },
);

const SIMPLE_CODE = `const { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } = Remotion;
export default function Title() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ color: "white", fontSize: 72, opacity }}>Hello World</h1>
    </AbsoluteFill>
  );
};`;

const mockLayers: FerroLayer[] = [
  {
    id: "layer-1",
    code: SIMPLE_CODE,
    brief: "Title card",
    type: "title-card",
    title: "Title Card",
    from: 0,
    durationInFrames: 90,
    status: "ready",
    error: null,
    currentVersionId: "v1",
  },
  {
    id: "layer-2",
    code: SIMPLE_CODE,
    brief: "Lower third",
    type: "lower-third",
    title: "Lower Third",
    from: 90,
    durationInFrames: 150,
    status: "ready",
    error: null,
    currentVersionId: "v1",
  },
];

const defaultProps = {
  videoObjectUrl: null as string | null,
  layers: mockLayers,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
};

export const compositorPreviewFixture: ComponentFixture<typeof defaultProps> = {
  id: "compositor-preview",
  name: "CompositorPreview",
  category: "preview",
  description: "Composite video preview with all layers stacked",
  tags: ["streaming"],
  component: CompositorPreview as any,
  defaultProps,
  states: {
    "single-layer": { layers: [mockLayers[0]] },
    "multi-layer": { layers: mockLayers },
    "no-layers": { layers: [] },
  },
};
```

- [ ] **Step 4: Create `pending-assistant-text.fixture.ts`**

```typescript
// apps/web/src/app/playground/fixtures/pending-assistant-text.fixture.ts
import { PendingAssistantText } from "@/components/preview/pending-assistant-text";
import type { ComponentFixture } from "../types";

const defaultProps = {};

export const pendingAssistantTextFixture: ComponentFixture<
  typeof defaultProps
> = {
  id: "pending-assistant-text",
  name: "PendingAssistantText",
  category: "preview",
  description: "Staggered word pulse animation while AI edits",
  tags: ["animated"],
  component: PendingAssistantText,
  defaultProps,
  states: {},
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/playground/fixtures/graphic-card.fixture.ts apps/web/src/app/playground/fixtures/compositor-preview.fixture.ts apps/web/src/app/playground/fixtures/pending-assistant-text.fixture.ts
git commit -m "feat(playground): add graphic-card, compositor-preview, and pending-assistant-text fixtures"
```

---

### Task 13: Assemble registry with all fixtures

**Files:**
- Modify: `apps/web/src/app/playground/registry.ts`

- [ ] **Step 1: Update registry.ts with all fixture imports**

```typescript
// apps/web/src/app/playground/registry.ts
import type { ComponentFixture } from "./types";

import { animatedProgressFixture } from "./fixtures/animated-progress.fixture";
import { buttonFixture } from "./fixtures/button.fixture";
import { cardFixture } from "./fixtures/card.fixture";
import { compositorPreviewFixture } from "./fixtures/compositor-preview.fixture";
import { fieldCardFixture } from "./fixtures/field-card.fixture";
import { generationStatusFixture } from "./fixtures/generation-status.fixture";
import { graphicCardFixture } from "./fixtures/graphic-card.fixture";
import { modelSelectorFixture } from "./fixtures/model-selector.fixture";
import { pendingAssistantTextFixture } from "./fixtures/pending-assistant-text.fixture";
import { pipelineFlowchartFixture } from "./fixtures/pipeline-flowchart.fixture";
import { resolutionSelectorFixture } from "./fixtures/resolution-selector.fixture";
import { spinnerFixture } from "./fixtures/spinner.fixture";
import { stageDetailFixture } from "./fixtures/stage-detail.fixture";
import { statusPillFixture } from "./fixtures/status-pill.fixture";

export const fixtures: ComponentFixture<any>[] = [
  // Base UI
  buttonFixture,
  spinnerFixture,
  statusPillFixture,
  animatedProgressFixture,
  cardFixture,
  resolutionSelectorFixture,
  modelSelectorFixture,
  // Upload
  fieldCardFixture,
  generationStatusFixture,
  // Preview
  graphicCardFixture,
  compositorPreviewFixture,
  pendingAssistantTextFixture,
  // Dev Mode
  pipelineFlowchartFixture,
  stageDetailFixture,
];
```

- [ ] **Step 2: Verify full compilation**

Run:
```bash
cd /Users/alish/lab/Ferro/apps/web && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/playground/registry.ts
git commit -m "feat(playground): assemble registry with all 14 component fixtures"
```

---

### Task 14: End-to-end smoke test

- [ ] **Step 1: Start browser and navigate**

```
mcp__next-devtools__browser_eval(action="start")
mcp__next-devtools__browser_eval(action="navigate", url="http://localhost:3000/playground")
```

- [ ] **Step 2: Check for errors**

```
mcp__next-devtools__nextjs_call(port="3000", toolName="get_errors")
```
Expected: no errors

- [ ] **Step 3: Screenshot empty state**

```
mcp__next-devtools__browser_eval(action="screenshot")
```
Expected: "Component Playground" header, "Press ⌘K" prompt

- [ ] **Step 4: Open CMD-K and verify components listed**

```
mcp__next-devtools__browser_eval(action="evaluate", script="document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))")
```
Then screenshot:
```
mcp__next-devtools__browser_eval(action="screenshot")
```
Expected: CommandDialog visible with component groups

- [ ] **Step 5: Add a component and verify it renders**

Click a component in the palette, then screenshot to verify it renders on canvas with state dropdown, render counter, and close button.

- [ ] **Step 6: Check console for React warnings**

```
mcp__next-devtools__browser_eval(action="console_messages")
```
Expected: no React warnings

- [ ] **Step 7: Fix any issues found, then final commit**

```bash
git add -A apps/web/src/app/playground/
git commit -m "fix(playground): fixes from end-to-end smoke test"
```

---

### Task 15: Final verification and cleanup

- [ ] **Step 1: Run typecheck**

```bash
cd /Users/alish/lab/Ferro/apps/web && npx tsc --noEmit --pretty
```
Expected: clean

- [ ] **Step 2: Run lint**

```bash
cd /Users/alish/lab/Ferro/apps/web && bun run lint
```
Expected: clean (or only pre-existing warnings)

- [ ] **Step 3: Verify route is dev-only**

```bash
cd /Users/alish/lab/Ferro/apps/web && NODE_ENV=production npx tsc --noEmit --pretty
```
Expected: compiles — the redirect logic handles prod access

- [ ] **Step 4: Final commit if any lint/type fixes were needed**

```bash
git add -A apps/web/src/app/playground/
git commit -m "chore(playground): lint and type cleanup"
```

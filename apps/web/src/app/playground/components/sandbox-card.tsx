"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { StreamTransport } from "./stream-transport";
import { usePlayground } from "../playground-provider";
import type { ComponentFixture } from "../types";

interface SandboxCardContext {
  fixture: ComponentFixture<any>;
  instanceId: string;
  selectedState: string;
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
  const stateEntries = Object.entries(fixture.states);

  return (
    <select
      className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
      onChange={(e) => setFixtureState(instanceId, e.target.value)}
      defaultValue="default"
    >
      <option value="default">default — baseline props</option>
      {stateEntries.map(([name, state]) => (
        <option key={name} value={name}>
          {name} — {state.description}
        </option>
      ))}
    </select>
  );
}

function StreamControls() {
  const { fixture, setStreamOverrides } = useSandboxCard();
  if (!fixture.streamSimulator) return null;

  return (
    <div className="flex items-center gap-1.5 border-l pl-2">
      <span className="text-[10px] text-muted-foreground">stream</span>
      <StreamTransport
        simulator={fixture.streamSimulator}
        onPropsUpdate={setStreamOverrides}
      />
    </div>
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
  const { fixture, selectedState, resolvedProps } = useSandboxCard();
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
        <Component key={selectedState} {...(resolvedProps as any)} />
      </ErrorBoundary>
    </CardContent>
  );
}

export function SandboxCard({
  fixture,
  instanceId,
  selectedState,
}: {
  fixture: ComponentFixture<any>;
  instanceId: string;
  selectedState: string;
}) {
  const [streamState, setStreamState] = useState({
    stateKey: selectedState,
    overrides: {} as Record<string, unknown>,
  });

  const streamOverrides = useMemo(
    () => (streamState.stateKey === selectedState ? streamState.overrides : {}),
    [streamState, selectedState],
  );

  const setStreamOverrides = useCallback(
    (overrides: Record<string, unknown>) =>
      setStreamState({ stateKey: selectedState, overrides }),
    [selectedState],
  );

  const resolvedProps = useMemo(() => {
    const stateEntry = selectedState !== "default" ? fixture.states[selectedState] : undefined;
    const stateOverrides = stateEntry?.props ?? {};
    return { ...fixture.defaultProps, ...stateOverrides, ...streamOverrides };
  }, [fixture, selectedState, streamOverrides]);

  const ctx: SandboxCardContext = {
    fixture,
    instanceId,
    selectedState,
    resolvedProps,
    streamOverrides,
    setStreamOverrides,
  };

  return (
    <SandboxCardCtx value={ctx}>
      <Card data-sandbox-card={fixture.id} className="overflow-hidden">
        <Header>
          <Title />
          <StateDropdown />
          <StreamControls />
          <CloseButton />
        </Header>
        <Body />
      </Card>
    </SandboxCardCtx>
  );
}

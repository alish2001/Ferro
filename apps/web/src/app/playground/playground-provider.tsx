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

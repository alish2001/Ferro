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

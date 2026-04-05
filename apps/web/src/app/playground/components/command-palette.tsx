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

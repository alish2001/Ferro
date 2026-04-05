"use client";

import { PlaygroundProvider } from "./playground-provider";
import { PlaygroundCanvas } from "./components/playground-canvas";
import { CommandPalette } from "./components/command-palette";
import { fixtures } from "./registry";

export default function PlaygroundPage() {
  if (process.env.NODE_ENV !== "development") {
    return null;
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

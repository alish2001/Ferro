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

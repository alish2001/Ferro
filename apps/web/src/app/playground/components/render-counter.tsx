"use client";

import { useEffect, useRef, useState } from "react";

export function RenderCounter() {
  const count = useRef(0);
  const [display, setDisplay] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fires every render
  useEffect(() => {
    count.current++;
    setDisplay(count.current);
  });

  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      renders: {display}
    </span>
  );
}

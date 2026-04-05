"use client";

import { useEffect, useRef, useState } from "react";
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
  const tickRef = useRef<() => void>(undefined);

  const speed = SPEEDS[speedIndex];

  useEffect(() => {
    tickRef.current = () => {
      const now = performance.now();
      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;
      elapsedRef.current = Math.min(
        elapsedRef.current + delta * speed,
        simulator.durationMs,
      );

      onPropsUpdate(simulator.getPropsAtTime(elapsedRef.current));

      if (elapsedRef.current < simulator.durationMs) {
        rafRef.current = requestAnimationFrame(() => tickRef.current?.());
      } else {
        setPlaying(false);
      }
    };
  }, [speed, simulator, onPropsUpdate]);

  useEffect(() => {
    if (playing) {
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(() => tickRef.current?.());
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

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

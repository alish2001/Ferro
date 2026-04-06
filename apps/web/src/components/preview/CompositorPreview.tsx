"use client";

import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { FerroLayer } from "@/lib/ferro-contracts";
import { createBrowserCompositeComponent } from "@/remotion/browser-composite";
import dynamic from "next/dynamic";
import React, { useMemo } from "react";

const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), {
  ssr: false,
});

interface CompositorPreviewProps {
  videoObjectUrl: string | null;
  layers: FerroLayer[];
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
}

export function CompositorPreview({
  videoObjectUrl,
  layers,
  fps,
  width,
  height,
  durationInFrames,
}: CompositorPreviewProps) {
  const CompositeComponent = useMemo(() => {
    return createBrowserCompositeComponent({
      layers,
      videoSrc: videoObjectUrl,
    });
  }, [layers, videoObjectUrl]);

  return (
    <div className="overflow-hidden rounded-card border border-border bg-muted/80 shadow-lg dark:border-white/12 dark:bg-black/60 dark:shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
      <div className="px-5 pt-5 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Compositor preview
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          All {layers.length} layer{layers.length !== 1 ? "s" : ""} composited
          over video · {width}×{height} · {fps}fps
        </p>
      </div>

      <div className="px-5 pb-5">
        <ErrorBoundary
          fallback={(error, reset) => (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="font-mono text-xs text-red-400">
                  Compositor failed to render: {error.message}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-border bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-muted/80 dark:border-white/12 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1]"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        >
          <div className="overflow-hidden rounded-xl border border-border dark:border-white/8">
            <Player
              acknowledgeRemotionLicense={true}
              component={CompositeComponent}
              durationInFrames={Math.max(durationInFrames, 1)}
              fps={fps}
              compositionWidth={width}
              compositionHeight={height}
              style={{ width: "100%", aspectRatio: `${width}/${height}` }}
              controls
              loop
            />
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}

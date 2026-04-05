import type React from "react";
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

type CompositorPreviewProps = {
  videoObjectUrl: string | null;
  layers: FerroLayer[];
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
};

const LOWER_THIRD_CODE = `
const { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } = window.Remotion;

export default function LowerThird() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", bottom: 120, left: 80, opacity }}>
        <div style={{ background: "rgba(0,0,0,0.75)", borderLeft: "4px solid #3b82f6", padding: "12px 20px", borderRadius: "0 8px 8px 0" }}>
          <p style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0 }}>Jane Doe</p>
          <p style={{ color: "#94a3b8", fontSize: 22, margin: "4px 0 0" }}>Product Designer</p>
        </div>
      </div>
    </AbsoluteFill>
  );
}
`.trim();

const TITLE_CARD_CODE = `
const { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } = window.Remotion;

export default function TitleCard() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 15, durationInFrames - 15, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 15], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity, transform: \`scale(\${scale})\`, textAlign: "center" }}>
        <p style={{ color: "#fff", fontSize: 72, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
          Q4 Results
        </p>
        <p style={{ color: "#94a3b8", fontSize: 36, margin: "16px 0 0" }}>
          Record-breaking growth
        </p>
      </div>
    </AbsoluteFill>
  );
}
`.trim();

const layerA: FerroLayer = {
  id: "layer-a",
  code: LOWER_THIRD_CODE,
  brief: "Lower-third name overlay",
  type: "lower-third",
  title: "Jane Doe — Product Designer",
  from: 0,
  durationInFrames: 300,
  status: "ready",
  error: null,
  currentVersionId: "ver-a1",
};

const layerB: FerroLayer = {
  id: "layer-b",
  code: TITLE_CARD_CODE,
  brief: "Opening title card",
  type: "title-card",
  title: "Q4 Results",
  from: 0,
  durationInFrames: 300,
  status: "ready",
  error: null,
  currentVersionId: "ver-b1",
};

const mockLayers: FerroLayer[] = [layerA, layerB];

export const compositorPreviewFixture: ComponentFixture<CompositorPreviewProps> =
  {
    id: "compositor-preview",
    name: "CompositorPreview",
    category: "preview",
    description:
      "Full-composition Remotion player that stacks all ready layers over optional video",
    tags: ["streaming"],
    component: CompositorPreview as React.ComponentType<CompositorPreviewProps>,
    defaultProps: {
      videoObjectUrl: null,
      layers: mockLayers,
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 300,
    },
    states: {
      "single-layer": {
        layers: [layerA],
      },
      "multi-layer": {
        layers: mockLayers,
      },
      "no-layers": {
        layers: [],
      },
    },
  };

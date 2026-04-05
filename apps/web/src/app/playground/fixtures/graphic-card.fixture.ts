import type React from "react";
import dynamic from "next/dynamic";
import type { FerroLayer, FerroLayerMessage } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";

const GraphicCard = dynamic(
  () => import("@/components/preview/GraphicCard").then((m) => m.GraphicCard),
  { ssr: false },
);

type GraphicCardProps = {
  layer: FerroLayer;
  fps: number;
  width: number;
  height: number;
  messages: FerroLayerMessage[];
  versionCount: number;
  onCodeChange: (code: string) => void;
  onEditPrompt: (prompt: string) => void | Promise<void>;
};

const MOCK_CODE = `
const { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } = window.Remotion;

export default function LowerThird() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const slideIn = interpolate(frame, [0, 18], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 12, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 80,
          transform: \`translateY(\${slideIn}px)\`,
          opacity,
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            borderLeft: "4px solid #3b82f6",
            padding: "12px 20px",
            borderRadius: "0 8px 8px 0",
          }}
        >
          <p style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0 }}>
            John Smith
          </p>
          <p style={{ color: "#94a3b8", fontSize: 22, margin: "4px 0 0" }}>
            Senior Engineer
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}
`.trim();

const mockLayer: FerroLayer = {
  id: "layer-001",
  code: MOCK_CODE,
  brief: "Lower-third name and title overlay for interview subject",
  type: "lower-third",
  title: "John Smith — Senior Engineer",
  from: 30,
  durationInFrames: 120,
  status: "ready",
  error: null,
  currentVersionId: "ver-001",
};

const generatingLayer: FerroLayer = {
  ...mockLayer,
  id: "layer-002",
  code: "",
  status: "generating",
  error: null,
  currentVersionId: null,
};

const failedLayer: FerroLayer = {
  ...mockLayer,
  id: "layer-003",
  code: "",
  status: "failed",
  error: "LLM returned invalid JSX — missing closing tag on line 14.",
  currentVersionId: null,
};

const mockMessages: FerroLayerMessage[] = [
  {
    id: "msg-001",
    layerId: "layer-001",
    role: "user",
    text: "Make the slide-in faster and use a white accent color instead of blue.",
    createdAt: "2026-04-04T10:00:00.000Z",
    versionId: null,
    status: "complete",
  },
  {
    id: "msg-002",
    layerId: "layer-001",
    role: "assistant",
    text: "Updated the entrance animation to 10 frames and swapped the accent to white. The backdrop blur is slightly stronger for contrast.",
    createdAt: "2026-04-04T10:00:05.000Z",
    versionId: "ver-002",
    status: "complete",
  },
];

export const graphicCardFixture: ComponentFixture<GraphicCardProps> = {
  id: "graphic-card",
  name: "GraphicCard",
  category: "preview",
  description: "Card showing a single Remotion layer with inline player, code editor, and layer chat",
  tags: ["streaming"],
  component: GraphicCard as React.ComponentType<GraphicCardProps>,
  defaultProps: {
    layer: mockLayer,
    fps: 30,
    width: 1920,
    height: 1080,
    messages: mockMessages,
    versionCount: 2,
    onCodeChange: () => {},
    onEditPrompt: () => {},
  },
  states: {
    ready: {
      layer: mockLayer,
      messages: mockMessages,
      versionCount: 2,
    },
    generating: {
      layer: generatingLayer,
      messages: [],
      versionCount: 0,
    },
    failed: {
      layer: failedLayer,
      messages: [],
      versionCount: 0,
    },
    "with-chat": {
      layer: mockLayer,
      messages: mockMessages,
      versionCount: 2,
    },
    "no-chat": {
      layer: mockLayer,
      messages: [],
      versionCount: 1,
    },
  },
};

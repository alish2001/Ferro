"use client";

import type React from "react";
import dynamic from "next/dynamic";
import type { FerroLayer, FerroLayerMessage } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";
import { useState, useCallback } from "react";

const GraphicCardInner = dynamic(
  () => import("@/components/preview/GraphicCard").then((m) => m.GraphicCard),
  { ssr: false },
);

// Valid LLM-generated code — uses import syntax that the compiler strips
const MOCK_CODE = `
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const LowerThird = () => {
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
};
`.trim();

const EDITED_CODE = MOCK_CODE
  .replace("4px solid #3b82f6", "4px solid #ffffff")
  .replace("[0, 18]", "[0, 10]");

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

const baseMessages: FerroLayerMessage[] = [
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

// Wrapper that simulates edit prompt flow
function GraphicCardWithEditSim(props: GraphicCardWrapperProps) {
  const [messages, setMessages] = useState<FerroLayerMessage[]>(props.initialMessages);
  const [layer, setLayer] = useState<FerroLayer>(props.initialLayer);

  const handleEditPrompt = useCallback(
    (prompt: string) => {
      // Add user message
      const userMsg: FerroLayerMessage = {
        id: `msg-${Date.now()}`,
        layerId: layer.id,
        role: "user",
        text: prompt,
        createdAt: new Date().toISOString(),
        versionId: null,
        status: "complete",
      };
      setMessages((prev) => [...prev, userMsg]);

      // After 500ms, add pending assistant message
      setTimeout(() => {
        const pendingMsg: FerroLayerMessage = {
          id: `msg-${Date.now()}-assistant`,
          layerId: layer.id,
          role: "assistant",
          text: "",
          createdAt: new Date().toISOString(),
          versionId: null,
          status: "pending",
        };
        setMessages((prev) => [...prev, pendingMsg]);

        // After 2s, complete the assistant message with reply + update code
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.status === "pending"
                ? {
                    ...m,
                    text: "Done! I made the entrance animation snappier (10 frames instead of 18) and changed the accent line to white. The text should pop more against the dark background now.",
                    status: "complete" as const,
                    versionId: "ver-sim",
                  }
                : m,
            ),
          );
          setLayer((prev) => ({ ...prev, code: EDITED_CODE }));
        }, 2000);
      }, 500);
    },
    [layer.id],
  );

  return (
    <GraphicCardInner
      layer={layer}
      fps={props.fps}
      width={props.width}
      height={props.height}
      messages={messages}
      versionCount={props.versionCount}
      onCodeChange={props.onCodeChange}
      onEditPrompt={handleEditPrompt}
    />
  );
}

type GraphicCardWrapperProps = {
  initialLayer: FerroLayer;
  fps: number;
  width: number;
  height: number;
  initialMessages: FerroLayerMessage[];
  versionCount: number;
  onCodeChange: (code: string) => void;
};

export const graphicCardFixture: ComponentFixture<GraphicCardWrapperProps> = {
  id: "graphic-card",
  name: "GraphicCard",
  category: "preview",
  description: "Card showing a single Remotion layer with inline player, code editor, and layer chat",
  tags: ["streaming"],
  component: GraphicCardWithEditSim as React.ComponentType<GraphicCardWrapperProps>,
  defaultProps: {
    initialLayer: mockLayer,
    fps: 30,
    width: 1920,
    height: 1080,
    initialMessages: baseMessages,
    versionCount: 2,
    onCodeChange: () => {},
  },
  states: {
    ready: {
      description: "Ready layer with code preview and 2 chat messages",
      props: {
        initialLayer: mockLayer,
        initialMessages: baseMessages,
        versionCount: 2,
      },
    },
    generating: {
      description: "Layer currently generating — no code, no chat",
      props: {
        initialLayer: generatingLayer,
        initialMessages: [],
        versionCount: 0,
      },
    },
    failed: {
      description: "Failed layer with JSX parse error",
      props: {
        initialLayer: failedLayer,
        initialMessages: [],
        versionCount: 0,
      },
    },
    "fresh-layer": {
      description: "Ready layer, no chat yet — try sending an edit prompt",
      props: {
        initialLayer: mockLayer,
        initialMessages: [],
        versionCount: 1,
      },
    },
  },
};

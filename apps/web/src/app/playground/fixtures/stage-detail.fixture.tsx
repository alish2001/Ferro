"use client";

import dynamic from "next/dynamic";
import type { DevModeStageTrace } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";
import type { StageDetailProps } from "@/components/dev-mode/stage-detail";

const StageDetail = dynamic(
  () =>
    import("@/components/dev-mode/stage-detail").then((m) => m.StageDetail),
  { ssr: false },
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeTrace(
  stageId: string,
  stageName: string,
  overrides: Partial<DevModeStageTrace> = {},
): DevModeStageTrace {
  return {
    stageId,
    stageName,
    status: "pending",
    systemPrompt: null,
    userPrompt: null,
    rawOutput: null,
    modelId: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    tokenUsage: null,
    finishReason: null,
    error: null,
    ...overrides,
  };
}

const NOW = "2026-04-04T12:00:00.000Z";
const DONE_AT = "2026-04-04T12:00:03.200Z";

// ─── realistic trace data ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# Graphic Layer Generator

You are an expert Remotion developer generating React/TypeScript components for motion graphic layers in a video editor.

## Rules
- Export a single default React component named \`Layer\`
- Use \`useCurrentFrame()\` and \`useVideoConfig()\` from \`remotion\`
- Animate from frame 0 to \`durationInFrames\` — never hardcode absolute frame numbers
- All timing must be relative to the layer's own \`from\` offset
- Use \`interpolate\` and \`spring\` for smooth animations
- Do NOT import anything external — all Remotion APIs are injected

## Available APIs (pre-injected)
- \`useCurrentFrame\`, \`useVideoConfig\`, \`Sequence\`, \`interpolate\`, \`spring\`, \`Easing\`
- \`AbsoluteFill\`, \`Series\`, \`Loop\`, \`Audio\`, \`Video\`
- \`Img\` from remotion

## Layer context
\`\`\`json
{
  "type": "stat-callout",
  "title": "+42% Revenue",
  "brief": "Q1 revenue growth stat — animate in from left with a bounce, hold, then fade out",
  "durationInFrames": 60,
  "fps": 30
}
\`\`\``;

const USER_PROMPT = `Generate a stat-callout layer for this brief:

**Title:** +42% Revenue
**Brief:** Q1 revenue growth stat — animate in from left with a bounce, hold, then fade out
**Duration:** 60 frames at 30fps (2 seconds)

Requirements:
- Bold percentage number in large text, centred horizontally in lower third
- Slide in from left with a bounce spring, hold for ~1s, then fade out
- Use a dark semi-transparent pill background
- Accent colour: emerald green (#34d399)`;

const RAW_OUTPUT = `import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

export default function Layer() {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 200, mass: 0.8 },
    durationInFrames: 15,
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const translateX = interpolate(slideIn, [0, 1], [-240, 0]);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 80 }}>
      <div
        style={{
          transform: \`translateX(\${translateX}px)\`,
          opacity: fadeOut,
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 999,
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(52,211,153,0.3)',
        }}
      >
        <span style={{ fontSize: 48, fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
          +42%
        </span>
        <span style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          Revenue YoY
        </span>
      </div>
    </AbsoluteFill>
  );
}`;

// ─── individual traces ────────────────────────────────────────────────────────

const completeTrace = makeTrace("layer-gen-layer-2", "stat-callout", {
  status: "complete",
  systemPrompt: SYSTEM_PROMPT,
  userPrompt: USER_PROMPT,
  rawOutput: RAW_OUTPUT,
  modelId: "claude-sonnet-4-6",
  startedAt: NOW,
  completedAt: DONE_AT,
  durationMs: 2940,
  tokenUsage: {
    inputTokens: 7820,
    outputTokens: 548,
    cacheReadTokens: 7100,
    cacheWriteTokens: 0,
  },
  finishReason: "end_turn",
});

const runningTrace = makeTrace("layer-gen-layer-2", "stat-callout", {
  status: "running",
  systemPrompt: SYSTEM_PROMPT,
  userPrompt: USER_PROMPT,
  modelId: "claude-sonnet-4-6",
  startedAt: NOW,
});

const failedTrace = makeTrace("layer-gen-layer-2", "stat-callout", {
  status: "failed",
  systemPrompt: SYSTEM_PROMPT,
  userPrompt: USER_PROMPT,
  modelId: "claude-sonnet-4-6",
  startedAt: NOW,
  completedAt: DONE_AT,
  durationMs: 420,
  error:
    "Model response was cut off before the closing JSX tag. Output length exceeded context window. Try reducing the layer brief or splitting into smaller layers.",
});

const rerunningTrace = makeTrace("layer-gen-layer-2", "stat-callout", {
  status: "complete",
  systemPrompt: SYSTEM_PROMPT,
  userPrompt: USER_PROMPT,
  rawOutput: RAW_OUTPUT,
  modelId: "claude-sonnet-4-6",
  startedAt: NOW,
  completedAt: DONE_AT,
  durationMs: 2940,
  tokenUsage: {
    inputTokens: 7820,
    outputTokens: 548,
    cacheReadTokens: 7100,
    cacheWriteTokens: 0,
  },
  finishReason: "end_turn",
});

// ─── fixture ─────────────────────────────────────────────────────────────────

export const stageDetailFixture: ComponentFixture<StageDetailProps> = {
  id: "stage-detail",
  name: "StageDetail",
  category: "dev-mode",
  description:
    "Expanded detail panel for a pipeline stage showing prompts, output, token usage, and re-run controls",
  tags: ["streaming", "dev-mode"],
  component: StageDetail,
  defaultProps: {
    trace: completeTrace,
    isRerunning: false,
    onRerun: (() => {}) as any,
  },
  states: {
    complete: {
      trace: completeTrace,
      isRerunning: false,
    },
    running: {
      trace: runningTrace,
      isRerunning: false,
    },
    failed: {
      trace: failedTrace,
      isRerunning: false,
    },
    rerunning: {
      trace: rerunningTrace,
      isRerunning: true,
    },
  },
};

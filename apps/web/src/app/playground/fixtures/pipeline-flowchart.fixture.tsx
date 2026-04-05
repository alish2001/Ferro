"use client";

import dynamic from "next/dynamic";
import type { DevModeStageTrace } from "@/lib/ferro-contracts";
import type { ComponentFixture } from "../types";
import type { PipelineFlowchartProps } from "@/components/dev-mode/pipeline-flowchart";

const PipelineFlowchart = dynamic(
  () =>
    import("@/components/dev-mode/pipeline-flowchart").then(
      (m) => m.PipelineFlowchart,
    ),
  { ssr: false },
);

// ─── helpers ────────────────────────────────────────────────────────────────

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

const SYSTEM_PROMPT_SKILLS = `# Skill Detection

You are an expert at analysing video transcripts and detecting which visual skills would best complement the content.

Available skills: lower-third, title-card, stat-callout, quote-overlay, outro-card, captions`;

const USER_PROMPT_SKILLS = `Transcript: "Today we're looking at Q1 numbers. Revenue was up 42% year-over-year, driven by our new enterprise tier. Churn dropped to 2.1%. We shipped 14 features."

Detect which graphic skills would enhance this video.`;

const RAW_OUTPUT_SKILLS = JSON.stringify(
  { skills: ["lower-third", "stat-callout", "title-card"] },
  null,
  2,
);

// ─── trace Maps ─────────────────────────────────────────────────────────────

function makeAllCompleteTraces(): Map<string, DevModeStageTrace> {
  return new Map([
    [
      "skill-detection",
      makeTrace("skill-detection", "Skills", {
        status: "complete",
        systemPrompt: SYSTEM_PROMPT_SKILLS,
        userPrompt: USER_PROMPT_SKILLS,
        rawOutput: RAW_OUTPUT_SKILLS,
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 1240,
        tokenUsage: {
          inputTokens: 4200,
          outputTokens: 180,
          cacheReadTokens: 3800,
          cacheWriteTokens: 0,
        },
        finishReason: "end_turn",
      }),
    ],
    [
      "planning",
      makeTrace("planning", "Planning", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 2100,
        tokenUsage: {
          inputTokens: 6500,
          outputTokens: 420,
          cacheReadTokens: 5200,
          cacheWriteTokens: 0,
        },
        finishReason: "end_turn",
        systemPrompt: "# Graphic Planner\n\nPlan a timeline of graphic layers for the video.",
        userPrompt: USER_PROMPT_SKILLS,
        rawOutput: JSON.stringify(
          {
            fps: 30,
            layers: [
              { id: "layer-1", type: "title-card", title: "Q1 Results", from: 0, durationInFrames: 90 },
              { id: "layer-2", type: "stat-callout", title: "+42% Revenue", from: 120, durationInFrames: 60 },
            ],
          },
          null,
          2,
        ),
      }),
    ],
    [
      "system-prompt-build",
      makeTrace("system-prompt-build", "Sys Prompt", {
        status: "complete",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 12,
      }),
    ],
    [
      "layer-gen-layer-1",
      makeTrace("layer-gen-layer-1", "title-card", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 3400,
        tokenUsage: {
          inputTokens: 8100,
          outputTokens: 620,
          cacheReadTokens: 7200,
          cacheWriteTokens: 0,
        },
        finishReason: "end_turn",
      }),
    ],
    [
      "layer-gen-layer-2",
      makeTrace("layer-gen-layer-2", "stat-callout", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 2900,
        tokenUsage: {
          inputTokens: 7800,
          outputTokens: 540,
          cacheReadTokens: 7000,
          cacheWriteTokens: 0,
        },
        finishReason: "end_turn",
      }),
    ],
  ]);
}

function makeMidGenTraces(): Map<string, DevModeStageTrace> {
  return new Map([
    [
      "skill-detection",
      makeTrace("skill-detection", "Skills", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 1240,
        tokenUsage: {
          inputTokens: 4200,
          outputTokens: 180,
          cacheReadTokens: 3800,
          cacheWriteTokens: 0,
        },
        finishReason: "end_turn",
        systemPrompt: SYSTEM_PROMPT_SKILLS,
        userPrompt: USER_PROMPT_SKILLS,
        rawOutput: RAW_OUTPUT_SKILLS,
      }),
    ],
    [
      "planning",
      makeTrace("planning", "Planning", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 2100,
        tokenUsage: {
          inputTokens: 6500,
          outputTokens: 420,
          cacheReadTokens: 5200,
          cacheWriteTokens: 0,
        },
        finishReason: "end_turn",
        systemPrompt: "# Graphic Planner\n\nPlan a timeline of graphic layers.",
        userPrompt: USER_PROMPT_SKILLS,
        rawOutput: "{}",
      }),
    ],
    [
      "system-prompt-build",
      makeTrace("system-prompt-build", "Sys Prompt", {
        status: "complete",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 12,
      }),
    ],
    [
      "layer-gen-layer-1",
      makeTrace("layer-gen-layer-1", "title-card", {
        status: "running",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
      }),
    ],
    [
      "layer-gen-layer-2",
      makeTrace("layer-gen-layer-2", "stat-callout", {
        status: "pending",
      }),
    ],
  ]);
}

function makeFailedTraces(): Map<string, DevModeStageTrace> {
  return new Map([
    [
      "skill-detection",
      makeTrace("skill-detection", "Skills", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 1240,
        tokenUsage: {
          inputTokens: 4200,
          outputTokens: 180,
          cacheReadTokens: 3800,
          cacheWriteTokens: 0,
        },
        finishReason: "end_turn",
        systemPrompt: SYSTEM_PROMPT_SKILLS,
        userPrompt: USER_PROMPT_SKILLS,
        rawOutput: RAW_OUTPUT_SKILLS,
      }),
    ],
    [
      "planning",
      makeTrace("planning", "Planning", {
        status: "failed",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 800,
        error: "Model returned malformed JSON — could not parse plan response after 3 retries.",
      }),
    ],
    [
      "system-prompt-build",
      makeTrace("system-prompt-build", "Sys Prompt", { status: "pending" }),
    ],
  ]);
}

// ─── static snapshots for states ────────────────────────────────────────────

const allCompleteTraces = makeAllCompleteTraces();
const midGenTraces = makeMidGenTraces();
const failedTraces = makeFailedTraces();

// ─── stream simulator ────────────────────────────────────────────────────────
//
// Over 8 seconds, stages progress: pending → running → complete
// t=0–1s:   skill-detection running
// t=1–2.5s: skill-detection complete, planning running
// t=2.5–3s: planning complete, system-prompt-build running
// t=3–3.1s: system-prompt-build complete
// t=3.1–5.5s: layer-gen-layer-1 running
// t=5.5–8s: layer-gen-layer-1 complete, layer-gen-layer-2 running → complete

function getStreamTraces(elapsedMs: number): Map<string, DevModeStageTrace> {
  const traces = new Map<string, DevModeStageTrace>();

  // skill-detection
  if (elapsedMs < 1000) {
    traces.set("skill-detection", makeTrace("skill-detection", "Skills", { status: "running", startedAt: NOW, modelId: "claude-sonnet-4-6" }));
  } else {
    traces.set("skill-detection", makeTrace("skill-detection", "Skills", {
      status: "complete",
      modelId: "claude-sonnet-4-6",
      startedAt: NOW,
      completedAt: DONE_AT,
      durationMs: 1240,
      tokenUsage: { inputTokens: 4200, outputTokens: 180, cacheReadTokens: 3800, cacheWriteTokens: 0 },
      finishReason: "end_turn",
      systemPrompt: SYSTEM_PROMPT_SKILLS,
      userPrompt: USER_PROMPT_SKILLS,
      rawOutput: RAW_OUTPUT_SKILLS,
    }));
  }

  // planning
  if (elapsedMs < 1000) {
    traces.set("planning", makeTrace("planning", "Planning", { status: "pending" }));
  } else if (elapsedMs < 2500) {
    traces.set("planning", makeTrace("planning", "Planning", { status: "running", startedAt: NOW, modelId: "claude-sonnet-4-6" }));
  } else {
    traces.set("planning", makeTrace("planning", "Planning", {
      status: "complete",
      modelId: "claude-sonnet-4-6",
      startedAt: NOW,
      completedAt: DONE_AT,
      durationMs: 2100,
      tokenUsage: { inputTokens: 6500, outputTokens: 420, cacheReadTokens: 5200, cacheWriteTokens: 0 },
      finishReason: "end_turn",
      systemPrompt: "# Graphic Planner\n\nPlan a timeline of graphic layers.",
      userPrompt: USER_PROMPT_SKILLS,
      rawOutput: "{}",
    }));
  }

  // system-prompt-build
  if (elapsedMs < 2500) {
    traces.set("system-prompt-build", makeTrace("system-prompt-build", "Sys Prompt", { status: "pending" }));
  } else if (elapsedMs < 3000) {
    traces.set("system-prompt-build", makeTrace("system-prompt-build", "Sys Prompt", { status: "running", startedAt: NOW }));
  } else {
    traces.set("system-prompt-build", makeTrace("system-prompt-build", "Sys Prompt", {
      status: "complete",
      startedAt: NOW,
      completedAt: DONE_AT,
      durationMs: 12,
    }));
  }

  // layer-gen-layer-1 (title-card)
  if (elapsedMs >= 3000) {
    if (elapsedMs < 5500) {
      traces.set("layer-gen-layer-1", makeTrace("layer-gen-layer-1", "title-card", { status: "running", startedAt: NOW, modelId: "claude-sonnet-4-6" }));
    } else {
      traces.set("layer-gen-layer-1", makeTrace("layer-gen-layer-1", "title-card", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 3400,
        tokenUsage: { inputTokens: 8100, outputTokens: 620, cacheReadTokens: 7200, cacheWriteTokens: 0 },
        finishReason: "end_turn",
      }));
    }
  }

  // layer-gen-layer-2 (stat-callout)
  if (elapsedMs >= 5500) {
    if (elapsedMs < 8000) {
      traces.set("layer-gen-layer-2", makeTrace("layer-gen-layer-2", "stat-callout", { status: "running", startedAt: NOW, modelId: "claude-sonnet-4-6" }));
    } else {
      traces.set("layer-gen-layer-2", makeTrace("layer-gen-layer-2", "stat-callout", {
        status: "complete",
        modelId: "claude-sonnet-4-6",
        startedAt: NOW,
        completedAt: DONE_AT,
        durationMs: 2900,
        tokenUsage: { inputTokens: 7800, outputTokens: 540, cacheReadTokens: 7000, cacheWriteTokens: 0 },
        finishReason: "end_turn",
      }));
    }
  }

  return traces;
}

// ─── fixture ─────────────────────────────────────────────────────────────────

export const pipelineFlowchartFixture: ComponentFixture<PipelineFlowchartProps> =
  {
    id: "pipeline-flowchart",
    name: "PipelineFlowchart",
    category: "dev-mode",
    description:
      "Pipeline stage flowchart with expandable stage detail panels and re-run controls",
    tags: ["streaming", "dev-mode"],
    component: PipelineFlowchart,
    defaultProps: {
      traces: midGenTraces,
      isRerunning: false,
      onRerunStage: (() => {}) as any,
    },
    states: {
      "all-complete": {
        traces: allCompleteTraces,
        isRerunning: false,
      },
      "mid-generation": {
        traces: midGenTraces,
        isRerunning: false,
      },
      failed: {
        traces: failedTraces,
        isRerunning: false,
      },
      rerunning: {
        traces: allCompleteTraces,
        isRerunning: true,
      },
    },
    streamSimulator: {
      durationMs: 8000,
      getPropsAtTime: (elapsedMs: number): Partial<PipelineFlowchartProps> => ({
        traces: getStreamTraces(elapsedMs),
        isRerunning: false,
      }),
    },
  };

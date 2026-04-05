import {
  GenerationStatus,
  type GenerationCounts,
  type JobState,
} from "@/components/upload/generation-status";
import type { ComponentFixture } from "../types";

type GenerationStatusProps = {
  jobState: JobState;
  progress?: number | null;
  totalLayers?: number;
  layerCounts?: GenerationCounts | null;
};

const loadingState: JobState = {
  tone: "loading",
  title: "Generating layers",
  detail: "Creating lower-third overlay...",
};

const successState: JobState = {
  tone: "success",
  title: "Generation complete",
  detail: "4 layers ready",
};

const errorState: JobState = {
  tone: "error",
  title: "Generation failed",
  detail: "Layer generation timed out after 30s",
};

const idleState: JobState = {
  tone: "idle",
  title: "Ready",
  detail: "Configure your video and hit generate",
};

const midCounts: GenerationCounts = {
  ready: 2,
  generating: 1,
  queued: 3,
  failed: 0,
};

const doneCounts: GenerationCounts = {
  ready: 4,
  generating: 0,
  queued: 0,
  failed: 0,
};

const failedCounts: GenerationCounts = {
  ready: 2,
  generating: 0,
  queued: 0,
  failed: 1,
};

export const generationStatusFixture: ComponentFixture<GenerationStatusProps> =
  {
    id: "generation-status",
    name: "GenerationStatus",
    category: "upload",
    description:
      "Status card for the generation pipeline with progress and layer counts",
    tags: ["streaming", "animated"],
    component: GenerationStatus,
    defaultProps: {
      jobState: loadingState,
      progress: 0.45,
      totalLayers: 6,
      layerCounts: midCounts,
    },
    states: {
      idle: {
        description: "Idle before generation starts",
        props: {
          jobState: idleState,
          progress: null,
          layerCounts: null,
        },
      },
      loading: {
        description: "Mid-generation: 2 ready, 1 generating, 3 queued at 45%",
        props: {
          jobState: loadingState,
          progress: 0.45,
          totalLayers: 6,
          layerCounts: midCounts,
        },
      },
      success: {
        description: "All 4 layers complete at 100%",
        props: {
          jobState: successState,
          progress: 1,
          totalLayers: 6,
          layerCounts: doneCounts,
        },
      },
      error: {
        description: "Failed with 1 errored layer at 50% progress",
        props: {
          jobState: errorState,
          progress: 0.5,
          totalLayers: 6,
          layerCounts: failedCounts,
        },
      },
    },
    streamSimulator: {
      durationMs: 6000,
      getPropsAtTime: (
        elapsedMs: number,
      ): Partial<GenerationStatusProps> => {
        const progress = Math.min(1, elapsedMs / 6000);
        const done = progress >= 1;

        // Incrementally move layers from queued -> generating -> ready over 6s
        // Phase 1 (0–33%): 2 ready, 1 generating, 3 queued
        // Phase 2 (33–66%): 3 ready, 1 generating, 2 queued
        // Phase 3 (66–100%): 4 ready, 0 generating, 0 queued
        let layerCounts: GenerationCounts;
        if (done) {
          layerCounts = doneCounts;
        } else if (progress >= 0.66) {
          layerCounts = { ready: 3, generating: 1, queued: 2, failed: 0 };
        } else if (progress >= 0.33) {
          layerCounts = { ready: 3, generating: 1, queued: 2, failed: 0 };
        } else {
          layerCounts = midCounts;
        }

        return {
          jobState: done ? successState : loadingState,
          progress,
          totalLayers: 6,
          layerCounts: done ? doneCounts : layerCounts,
        };
      },
    },
  };

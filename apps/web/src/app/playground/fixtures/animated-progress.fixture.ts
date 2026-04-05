import { AnimatedProgress } from "@/components/ui/animated-progress";
import type { ComponentFixture } from "../types";

type ProgressTone = "idle" | "loading" | "success" | "error";

type AnimatedProgressProps = {
  value?: number;
  indeterminate?: boolean;
  tone?: ProgressTone;
  className?: string;
};

export const animatedProgressFixture: ComponentFixture<AnimatedProgressProps> = {
  id: "animated-progress",
  name: "AnimatedProgress",
  category: "base-ui",
  description: "Animated progress bar with tone variants and indeterminate mode",
  tags: ["streaming", "animated"],
  component: AnimatedProgress,
  defaultProps: { value: 0.65, tone: "loading" as const, indeterminate: false },
  states: {
    idle: { description: "Idle tone at 0% progress", props: { value: 0, tone: "idle" as const } },
    loading: { description: "Loading tone at 65% progress", props: { value: 0.65, tone: "loading" as const } },
    success: { description: "Success tone at 100% complete", props: { value: 1, tone: "success" as const } },
    error: { description: "Error tone with red bar at 30%", props: { value: 0.3, tone: "error" as const } },
    indeterminate: { description: "Indeterminate shimmer with no value", props: { indeterminate: true, tone: "loading" as const } },
  },
  streamSimulator: {
    durationMs: 5000,
    getPropsAtTime: (elapsedMs: number): Partial<AnimatedProgressProps> => {
      const progress = Math.min(1, elapsedMs / 5000);
      const done = progress >= 1;
      return {
        value: progress,
        tone: done ? ("success" as const) : ("loading" as const),
        indeterminate: false,
      };
    },
  },
};

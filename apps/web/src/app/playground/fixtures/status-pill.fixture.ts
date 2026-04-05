import { StatusPill } from "@/components/ui/status-pill";
import type { ComponentFixture } from "../types";

type StatusPillProps = { status: string; className?: string };

export const statusPillFixture: ComponentFixture<StatusPillProps> = {
  id: "status-pill",
  name: "StatusPill",
  category: "base-ui",
  description: "Colored status badge for ready/generating/queued/failed",
  tags: [],
  component: StatusPill,
  defaultProps: { status: "ready" },
  states: {
    ready: { description: "Ready state with green badge", props: { status: "ready" } },
    generating: { description: "Generating state with animated indicator", props: { status: "generating" } },
    queued: { description: "Queued state waiting to start", props: { status: "queued" } },
    failed: { description: "Failed state with red badge", props: { status: "failed" } },
  },
};

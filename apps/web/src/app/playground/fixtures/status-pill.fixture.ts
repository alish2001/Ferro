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
    ready: { status: "ready" },
    generating: { status: "generating" },
    queued: { status: "queued" },
    failed: { status: "failed" },
  },
};

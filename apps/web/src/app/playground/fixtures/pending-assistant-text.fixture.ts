"use client";

import type React from "react";
import dynamic from "next/dynamic";
import type { ComponentFixture } from "../types";

const PendingAssistantText = dynamic(
  () =>
    import("@/components/preview/pending-assistant-text").then(
      (m) => m.PendingAssistantText,
    ),
  { ssr: false },
);

export const pendingAssistantTextFixture: ComponentFixture<
  Record<string, never>
> = {
  id: "pending-assistant-text",
  name: "PendingAssistantText",
  category: "preview",
  description:
    "Animated pulsing placeholder shown while an assistant message is streaming",
  tags: ["animated"],
  component: PendingAssistantText as React.ComponentType<Record<string, never>>,
  defaultProps: {},
  states: {},
};

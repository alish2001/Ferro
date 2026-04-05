import type { ComponentType } from "react";

export type FixtureCategory = "base-ui" | "upload" | "preview" | "dev-mode";

export interface StreamSimulator<P> {
  durationMs: number;
  getPropsAtTime: (elapsedMs: number) => Partial<P>;
}

export interface ComponentFixture<P = Record<string, unknown>> {
  id: string;
  name: string;
  category: FixtureCategory;
  description: string;
  tags: string[];
  component: ComponentType<P>;
  defaultProps: P;
  states: Record<string, { description: string; props: Partial<P> }>;
  thumbnail?: ComponentType;
  streamSimulator?: StreamSimulator<P>;
}

"use client";

import { ThemeSelector } from "@/components/ui/theme-selector";
import type { ComponentFixture } from "../types";

type ThemeSelectorFixtureProps = {
  className?: string;
};

export const themeSelectorFixture: ComponentFixture<ThemeSelectorFixtureProps> =
  {
    id: "theme-selector",
    name: "ThemeSelector",
    category: "base-ui",
    description: "Light / dark / system theme picker using next-themes",
    tags: ["theme", "accessibility"],
    component: ThemeSelector,
    defaultProps: {},
    states: {
      wide: {
        description: "Wider control area",
        props: { className: "min-w-[12rem]" },
      },
      padded: {
        description: "With extra vertical spacing",
        props: { className: "gap-3 py-1" },
      },
    },
  };

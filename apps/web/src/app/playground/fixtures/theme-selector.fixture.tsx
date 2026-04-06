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
    description:
      "Icon button cycling system / light / dark using next-themes (Monitor, Sun, Moon)",
    tags: ["theme", "accessibility", "animated"],
    component: ThemeSelector,
    defaultProps: {},
    states: {
      subdued: {
        description: "Default hero-style low contrast",
        props: { className: "text-muted-foreground/55" },
      },
      emphasis: {
        description: "Slightly higher contrast for dark canvases",
        props: { className: "text-muted-foreground hover:text-foreground" },
      },
    },
  };

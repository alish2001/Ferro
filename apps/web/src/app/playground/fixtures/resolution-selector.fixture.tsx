"use client";

import React, { useState } from "react";
import {
  ResolutionSelector,
  type Resolution,
} from "@/components/ui/resolution-selector";
import type { ComponentFixture } from "../types";

type ResolutionSelectorWrapperProps = {
  initialWidth: number;
  initialHeight: number;
};

function ResolutionSelectorWrapper(props: ResolutionSelectorWrapperProps) {
  const [value, setValue] = useState<Resolution>({
    width: props.initialWidth,
    height: props.initialHeight,
  });
  return <ResolutionSelector value={value} onChange={setValue} />;
}

export const resolutionSelectorFixture: ComponentFixture<ResolutionSelectorWrapperProps> =
  {
    id: "resolution-selector",
    name: "ResolutionSelector",
    category: "base-ui",
    description: "Canvas resolution picker with presets and free input",
    tags: ["resolution", "canvas"],
    component: ResolutionSelectorWrapper,
    defaultProps: {
      initialWidth: 1920,
      initialHeight: 1080,
    },
    states: {
      portrait: { initialWidth: 1080, initialHeight: 1920 },
      square: { initialWidth: 1080, initialHeight: 1080 },
      "4k": { initialWidth: 3840, initialHeight: 2160 },
    },
  };

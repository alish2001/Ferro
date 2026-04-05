"use client";

import { useState } from "react";
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
      portrait: { description: "Portrait 1080x1920 orientation", props: { initialWidth: 1080, initialHeight: 1920 } },
      square: { description: "Square 1080x1080 aspect ratio", props: { initialWidth: 1080, initialHeight: 1080 } },
      "4k": { description: "4K UHD 3840x2160 resolution", props: { initialWidth: 3840, initialHeight: 2160 } },
    },
  };

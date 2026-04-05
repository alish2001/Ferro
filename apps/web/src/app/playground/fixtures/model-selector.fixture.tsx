"use client";

import { useState } from "react";
import { ModelSelector } from "@/components/ui/model-selector";
import type { ComponentFixture } from "../types";

type ModelSelectorWrapperProps = {
  initialModel: string;
};

function ModelSelectorWrapper(props: ModelSelectorWrapperProps) {
  const [value, setValue] = useState(props.initialModel);
  return <ModelSelector value={value} onChange={setValue} />;
}

export const modelSelectorFixture: ComponentFixture<ModelSelectorWrapperProps> =
  {
    id: "model-selector",
    name: "ModelSelector",
    category: "base-ui",
    description: "Model picker dropdown for selecting AI models",
    tags: ["model", "ai"],
    component: ModelSelectorWrapper,
    defaultProps: {
      initialModel: "openai:gpt-4o",
    },
    states: {
      "gpt-4o-mini": { initialModel: "openai:gpt-4o-mini" },
      claude: { initialModel: "anthropic:claude-sonnet-4-6" },
    },
  };

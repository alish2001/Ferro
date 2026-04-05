import { Sparkles } from "lucide-react";
import { FieldCard } from "@/components/upload/field-card";
import type { ComponentFixture } from "../types";
import type { ComponentProps } from "react";

type FieldCardProps = ComponentProps<typeof FieldCard>;

export const fieldCardFixture: ComponentFixture<FieldCardProps> = {
  id: "field-card",
  name: "FieldCard",
  category: "upload",
  description: "Textarea-based card for structured upload field input",
  tags: [],
  component: FieldCard as any,
  defaultProps: {
    id: "taste",
    name: "taste",
    label: "Taste / style",
    title: "Taste",
    description: "Describe the visual style you want",
    placeholder: "Minimalist, clean typography...",
    icon: Sparkles,
    value: "Bold typography with neon accents on dark background",
    onChange: (() => {}) as any,
  },
  states: {
    empty: { description: "Empty field showing placeholder text", props: { value: "" } },
    long: {
      description: "Long multi-sentence value that wraps",
      props: {
        value:
          "Bold typography with neon accents on dark background. Heavy use of contrast between light and shadow. Geometric shapes, grid systems, and monospace elements. Brutalist layout with purposeful asymmetry.",
      },
    },
  },
};

import { createElement } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComponentFixture } from "../types";

type CardDemoProps = { size?: "default" | "sm"; showFooter?: boolean };

function CardDemo({ size, showFooter }: CardDemoProps) {
  return createElement(
    Card,
    { size },
    createElement(
      CardHeader,
      null,
      createElement(CardTitle, null, "Card Title"),
      createElement(CardDescription, null, "Card description text"),
    ),
    createElement(
      CardContent,
      null,
      createElement("p", { className: "text-sm text-muted-foreground" }, "Card body content goes here."),
    ),
    showFooter
      ? createElement(
          CardFooter,
          null,
          createElement("p", { className: "text-xs text-muted-foreground" }, "Footer text"),
        )
      : null,
  );
}

export const cardFixture: ComponentFixture<CardDemoProps> = {
  id: "card",
  name: "Card",
  category: "base-ui",
  description: "Composable card with header, content, and optional footer",
  tags: [],
  component: CardDemo,
  defaultProps: {
    size: "default" as const,
    showFooter: true,
  },
  states: {
    small: { description: "Compact small-size card variant", props: { size: "sm" as const } },
    "no-footer": { description: "Card without footer section", props: { showFooter: false } },
  },
};

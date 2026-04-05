import React from "react";
import { Button } from "@/components/ui/button";
import type { ComponentFixture } from "../types";

type ButtonProps = React.ComponentProps<typeof Button>;

export const buttonFixture: ComponentFixture<ButtonProps> = {
  id: "button",
  name: "Button",
  category: "base-ui",
  description: "6 variants, 8 sizes, built on Base UI",
  tags: [],
  component: Button,
  defaultProps: {
    children: "Click me" as React.ReactNode,
    variant: "default" as const,
    size: "default" as const,
  },
  states: {
    outline: { description: "Outline variant with border styling", props: { variant: "outline" as const } },
    secondary: { description: "Secondary variant with muted background", props: { variant: "secondary" as const } },
    ghost: { description: "Ghost variant with no background", props: { variant: "ghost" as const } },
    destructive: { description: "Destructive variant for danger actions", props: { variant: "destructive" as const } },
    link: { description: "Link variant styled as inline text", props: { variant: "link" as const } },
    small: { description: "Small size variant", props: { size: "sm" as const } },
    large: { description: "Large size variant", props: { size: "lg" as const } },
    disabled: { description: "Disabled state with reduced opacity", props: { disabled: true } },
  },
};

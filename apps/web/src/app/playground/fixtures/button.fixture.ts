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
    outline: { variant: "outline" as const },
    secondary: { variant: "secondary" as const },
    ghost: { variant: "ghost" as const },
    destructive: { variant: "destructive" as const },
    link: { variant: "link" as const },
    small: { size: "sm" as const },
    large: { size: "lg" as const },
    disabled: { disabled: true },
  },
};

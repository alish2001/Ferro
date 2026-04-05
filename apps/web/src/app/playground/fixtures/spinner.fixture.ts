import { Spinner } from "@/components/ui/spinner";
import type { ComponentFixture } from "../types";

type SpinnerProps = React.ComponentProps<typeof Spinner>;

export const spinnerFixture: ComponentFixture<SpinnerProps> = {
  id: "spinner",
  name: "Spinner",
  category: "base-ui",
  description: "Animated loader circle",
  tags: ["animated"],
  component: Spinner,
  defaultProps: {
    className: "",
  },
  states: {
    large: { className: "h-8 w-8" },
    "text-color": { className: "text-blue-400" },
  },
};

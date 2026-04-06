import { HeroBackdrop } from "@/components/hero-backdrop"
import { cn } from "@/lib/utils"
import type { ComponentFixture } from "../types"

type HeroBackdropDemoProps = { tall?: boolean }

function HeroBackdropDemo({ tall }: HeroBackdropDemoProps) {
  return (
    <div
      className={cn(
        "relative w-full max-w-2xl overflow-hidden rounded-[var(--radius-hero)] border border-border",
        tall ? "h-80" : "h-56",
      )}
    >
      <HeroBackdrop />
    </div>
  )
}

export const heroBackdropFixture: ComponentFixture<HeroBackdropDemoProps> = {
  id: "hero-backdrop",
  name: "HeroBackdrop",
  category: "base-ui",
  description: "Monochrome cyberpunk grid + dither backdrop for the upload hero",
  tags: ["animated"],
  component: HeroBackdropDemo,
  defaultProps: {
    tall: false,
  },
  states: {
    tall: {
      description: "Taller preview area",
      props: { tall: true },
    },
  },
}

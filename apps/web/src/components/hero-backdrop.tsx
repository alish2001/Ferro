"use client"

import { useEffect, useRef } from "react"
import { useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

type HeroBackdropProps = {
  className?: string
}

export function HeroBackdrop({ className }: HeroBackdropProps) {
  const prefersReducedMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (prefersReducedMotion) return

    function onPointerMove(event: PointerEvent) {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width
      const py = (event.clientY - rect.top) / rect.height
      if (!Number.isFinite(px) || !Number.isFinite(py)) return

      el.style.setProperty("--mx", String(px))
      el.style.setProperty("--my", String(py))
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    return () => window.removeEventListener("pointermove", onPointerMove)
  }, [prefersReducedMotion])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn(
        "ferro-hero-backdrop pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-hero)]",
        className,
      )}
    >
      <div className="ferro-hero-backdrop__grid absolute inset-[-40%]" />
      <div className="ferro-hero-backdrop__radials absolute inset-[-20%]" />
      <div className="ferro-hero-backdrop__noise absolute inset-0 opacity-[0.10] dark:opacity-[0.14]" />
      <div className="ferro-hero-backdrop__scanlines absolute inset-0 opacity-[0.07] dark:opacity-[0.1]" />
      <div className="ferro-hero-backdrop__vignette absolute inset-0" />
    </div>
  )
}

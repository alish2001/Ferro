"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ORDER = ["system", "light", "dark"] as const

const THEME_META: Record<
  (typeof ORDER)[number],
  { label: string; Icon: typeof Sun }
> = {
  system: { label: "System", Icon: Monitor },
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
}

interface ThemeSelectorProps {
  className?: string
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const reduceMotion = prefersReducedMotion ?? false

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const current = (theme ?? "system") as (typeof ORDER)[number]
  const safeCurrent = ORDER.includes(current) ? current : "system"
  const { label, Icon } = THEME_META[safeCurrent]

  const cycle = () => {
    const i = ORDER.indexOf(safeCurrent)
    const next = ORDER[(i + 1) % ORDER.length]
    setTheme(next)
  }

  const iconTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const },
    [reduceMotion],
  )

  if (!mounted) {
    return (
      <div
        className={cn("size-8 shrink-0 rounded-full opacity-0", className)}
        aria-hidden
      />
    )
  }

  return (
    <motion.div
      className={cn("shrink-0", className)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.32, 0.72, 0, 1] }
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={cycle}
        className={cn(
          "rounded-full text-muted-foreground/55 hover:text-muted-foreground",
          "hover:bg-muted/40",
        )}
        aria-label={`Theme: ${label}. Click to switch to next option.`}
        title={`${label} theme — click to change`}
      >
        <span className="relative flex size-[1.125rem] items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={safeCurrent}
              className="absolute inset-0 flex items-center justify-center"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.78, rotate: -14 }
              }
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, scale: 1, rotate: 0 }
              }
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.78, rotate: 14 }
              }
              transition={iconTransition}
            >
              <Icon className="size-[1.125rem] stroke-[1.75]" aria-hidden />
            </motion.span>
          </AnimatePresence>
        </span>
      </Button>
    </motion.div>
  )
}

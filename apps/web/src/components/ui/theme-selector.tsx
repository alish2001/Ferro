"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

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

  if (!mounted) {
    return (
      <div
        className={cn("size-8 shrink-0 rounded-full opacity-0", className)}
        aria-hidden
      />
    )
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
        "text-muted-foreground/55 transition-colors",
        "hover:bg-muted/40 hover:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
        className,
      )}
      aria-label={`Theme: ${label}. Click to switch to next option.`}
      title={`${label} theme — click to change`}
    >
      <Icon className="size-[1.125rem] stroke-[1.75]" aria-hidden />
    </button>
  )
}

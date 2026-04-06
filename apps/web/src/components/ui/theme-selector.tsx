"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const

interface ThemeSelectorProps {
  className?: string
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex flex-col gap-1.5 opacity-0",
          className,
        )}
        aria-hidden
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Theme
        </span>
        <div className="h-9 w-[7.5rem] rounded-xl border border-border bg-muted" />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor="theme-select"
        className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
      >
        Theme
      </label>
      <select
        id="theme-select"
        value={theme ?? "system"}
        onChange={(e) => setTheme(e.target.value)}
        className={cn(
          "h-9 min-w-[7.5rem] rounded-xl border border-border bg-background/80 px-3",
          "font-mono text-xs text-foreground",
          "appearance-none cursor-pointer",
          "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50",
          "transition-colors hover:border-border",
        )}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

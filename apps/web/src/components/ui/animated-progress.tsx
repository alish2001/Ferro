"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

type ProgressTone = "idle" | "loading" | "success" | "error"

interface AnimatedProgressProps {
  value?: number | null
  indeterminate?: boolean
  tone?: ProgressTone
  className?: string
}

const toneClasses: Record<ProgressTone, string> = {
  idle: "from-white/40 via-white/80 to-white/45 shadow-[0_0_24px_rgba(255,255,255,0.2)]",
  loading:
    "from-cyan-300 via-sky-300 to-white shadow-[0_0_28px_rgba(96,165,250,0.45)]",
  success:
    "from-emerald-300 via-emerald-400 to-lime-200 shadow-[0_0_28px_rgba(16,185,129,0.38)]",
  error:
    "from-orange-200 via-red-400 to-red-200 shadow-[0_0_28px_rgba(248,113,113,0.4)]",
}

export function AnimatedProgress({
  value,
  indeterminate = false,
  tone = "loading",
  className,
}: AnimatedProgressProps) {
  const clamped = Math.max(0, Math.min(1, value ?? 0))

  return (
    <div
      data-slot="progress"
      className={cn(
        "relative h-2.5 overflow-hidden rounded-full bg-muted ring-1 ring-border dark:bg-white/8 dark:ring-white/8",
        className,
      )}
    >
      <motion.div
        className="absolute inset-0 opacity-60"
        animate={{ backgroundPositionX: ["0%", "200%"] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
          backgroundSize: "180% 100%",
        }}
      />

      {indeterminate ? (
        <motion.div
          key="indeterminate"
          data-slot="progress-indicator"
          className={cn(
            "absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r",
            toneClasses[tone],
          )}
          animate={{ x: ["-120%", "280%"] }}
          transition={{
            duration: 1.35,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)]" />
        </motion.div>
      ) : (
        <motion.div
          key="determinate"
          data-slot="progress-indicator"
          className={cn(
            "absolute inset-y-0 left-0 overflow-hidden rounded-full bg-gradient-to-r",
            toneClasses[tone],
          )}
          initial={{ width: clamped >= 1 ? "100%" : "0%" }}
          animate={{ width: `${clamped * 100}%` }}
          transition={
            clamped >= 1
              ? { duration: 0.35, ease: "easeOut" }
              : { type: "spring", stiffness: 130, damping: 26, mass: 0.75 }
          }
        >
          <motion.div
            className="absolute inset-0 opacity-80"
            animate={{ backgroundPositionX: ["0%", "200%"] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
              backgroundSize: "160% 100%",
            }}
          />
        </motion.div>
      )}
    </div>
  )
}

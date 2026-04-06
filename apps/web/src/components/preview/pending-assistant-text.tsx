"use client"

import { motion } from "framer-motion"

const THINKING_WORDS = ["Assistant", "is", "revising", "this", "layer"]

export function PendingAssistantText() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground dark:text-white/72">
      {THINKING_WORDS.map((word, index) => (
        <motion.span
          key={word}
          animate={{ opacity: [0.28, 1, 0.28] }}
          transition={{
            duration: 1.45,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.12,
          }}
        >
          {word}
        </motion.span>
      ))}
      <motion.span
        className="inline-flex"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{
          duration: 1.1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        …
      </motion.span>
    </div>
  )
}

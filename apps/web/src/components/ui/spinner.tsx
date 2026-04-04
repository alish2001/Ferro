"use client"

import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface SpinnerProps {
  className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn("size-4 animate-spin text-current", className)}
    />
  )
}

import type { ComponentProps, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type FieldCardProps = {
  action?: ReactNode
  children?: ReactNode
  description: string
  icon: LucideIcon
  iconClassName?: string
  id: string
  label: string
  name: string
  placeholder: string
  title: string
} & Omit<ComponentProps<typeof Textarea>, "id" | "name" | "placeholder">

export function FieldCard({
  action,
  children,
  className,
  description,
  icon: Icon,
  iconClassName,
  id,
  label,
  name,
  placeholder,
  title,
  ...textareaProps
}: FieldCardProps) {
  return (
    <Card className="rounded-[1.75rem] border border-white/12 bg-white/[0.035] py-0 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <CardHeader className="px-5 pt-5 text-center">
        <CardTitle className="justify-center gap-2 text-xl tracking-[-0.04em] text-white">
          <Icon className={cn("size-4", iconClassName)} />
          {title}
        </CardTitle>
        <CardDescription className="mx-auto max-w-sm leading-6 text-white/68">
          {description}
        </CardDescription>
        {action ? <CardAction className="static col-auto row-auto mt-3 justify-self-auto self-auto">{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        {children}
        <Label htmlFor={id} className="sr-only">
          {label}
        </Label>
        <Textarea
          id={id}
          name={name}
          placeholder={placeholder}
          className={cn(
            "min-h-[240px] rounded-[1.25rem] border-white/12 bg-black/40 px-4 py-3 text-sm leading-7 text-white shadow-none placeholder:text-white/38 focus-visible:border-white/24 focus-visible:ring-white/15",
            className
          )}
          {...textareaProps}
        />
      </CardContent>
    </Card>
  )
}

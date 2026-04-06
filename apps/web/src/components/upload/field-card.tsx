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
    <Card className="glass-panel rounded-card bg-transparent py-0 text-foreground shadow-none ring-0">
      <CardHeader className="px-5 pt-5 text-center">
        <CardTitle className="justify-center gap-2 text-xl tracking-[-0.04em] text-foreground">
          <Icon className={cn("size-4", iconClassName)} />
          {title}
        </CardTitle>
        <CardDescription className="mx-auto max-w-sm leading-6 text-muted-foreground">
          {description}
        </CardDescription>
        {action ? (
          <CardAction className="static col-auto row-auto mt-3 justify-self-auto self-auto">
            {action}
          </CardAction>
        ) : null}
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
            "min-h-[240px] rounded-card-inner border-border bg-muted/60 px-4 py-3 text-sm leading-7 text-foreground shadow-none placeholder:text-muted-foreground backdrop-blur-sm focus-visible:border-ring focus-visible:ring-ring/50 dark:border-white/12 dark:bg-black/35 dark:text-white dark:placeholder:text-white/45 dark:focus-visible:border-white/24 dark:focus-visible:ring-white/15",
            className,
          )}
          {...textareaProps}
        />
      </CardContent>
    </Card>
  )
}

import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import { cn } from "@/lib/utils"
import "./globals.css"

export const metadata: Metadata = {
  title: "Ferro | Upload",
  description:
    "Upload a source video, transcript, taste, and prompt to kick off the first Ferro generation flow.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", GeistSans.variable, GeistMono.variable)}
    >
      <body suppressHydrationWarning className={cn(GeistSans.className, "antialiased")}>
        {children}
      </body>
    </html>
  )
}

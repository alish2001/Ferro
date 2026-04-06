"use client"

import type { ComponentProps } from "react"

import { TranscriptionDebugPanel } from "@/components/upload/transcription-debug-panel"
import type { ComponentFixture } from "../types"

const sampleCaptions = [
  { text: "Hello", startMs: 0, endMs: 400 },
  { text: "world", startMs: 400, endMs: 800 },
]

export const transcriptionDebugPanelFixture: ComponentFixture<
  ComponentProps<typeof TranscriptionDebugPanel>
> = {
  id: "transcription-debug-panel",
  name: "TranscriptionDebugPanel",
  category: "upload",
  description:
    "Collapsible panel for inspecting word-level caption JSON and detected FPS.",
  tags: ["upload", "debug"],
  component: TranscriptionDebugPanel,
  defaultProps: {
    hasVideo: true,
    captions: sampleCaptions,
    detectedVideoFps: 30,
    devMode: false,
    isTranscribing: false,
    transcribeStatus: null,
  },
  states: {
    transcribing: {
      description: "In progress — status line only",
      props: {
        hasVideo: true,
        captions: null,
        detectedVideoFps: null,
        devMode: false,
        isTranscribing: true,
        transcribeStatus: "Transcribing… 42%",
      },
    },
    devMode: {
      description: "Dev mode label on summary",
      props: {
        hasVideo: true,
        captions: sampleCaptions,
        detectedVideoFps: 24,
        devMode: true,
        isTranscribing: false,
        transcribeStatus: "Transcription ready",
      },
    },
  },
}

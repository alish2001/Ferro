"use client";

import { useState, useCallback } from "react";
import { Sparkles, Captions, Loader2 } from "lucide-react";
import { FieldCard } from "@/components/upload/field-card";
import { Button } from "@/components/ui/button";
import type { ComponentFixture } from "../types";

const MOCK_TRANSCRIPT = `Welcome to our Q4 2025 earnings review. Revenue grew 23% year over year, reaching $4.2 billion. Our cloud division was the standout performer, with margins expanding by 600 basis points. We're particularly excited about the AI infrastructure investments that are now bearing fruit across all product lines. Looking ahead to 2026, we expect continued momentum driven by enterprise adoption.`;

type FieldCardDemoProps = {
  variant: "taste" | "transcript" | "instructions";
};

function FieldCardDemo({ variant }: FieldCardDemoProps) {
  const [value, setValue] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const simulateTranscribe = useCallback(() => {
    setIsTranscribing(true);
    setStatus("Detecting language…");
    setValue("");

    const words = MOCK_TRANSCRIPT.split(" ");
    let i = 0;

    setTimeout(() => setStatus("Transcribing…"), 800);

    const interval = setInterval(() => {
      const chunk = words.slice(i, i + 3).join(" ");
      setValue((prev) => (prev ? prev + " " + chunk : chunk));
      i += 3;
      if (i >= words.length) {
        clearInterval(interval);
        setIsTranscribing(false);
        setStatus(null);
      }
    }, 150);
  }, []);

  if (variant === "taste") {
    return (
      <FieldCard
        id="taste"
        name="taste"
        label="Taste / style"
        title="Taste"
        description="Describe the visual style you want"
        placeholder="Minimalist, clean typography, subtle animations..."
        icon={Sparkles}
        value={value || "Bold typography with neon accents on dark background"}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  }

  if (variant === "instructions") {
    return (
      <FieldCard
        id="instructions"
        name="instructions"
        label="Prompt / instructions"
        title="Prompt"
        description="Any specific instructions for the graphics director"
        placeholder="Focus on the revenue numbers, add a title card at the start..."
        icon={Sparkles}
        iconClassName="text-white"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  }

  // Transcript variant with transcribe button
  return (
    <FieldCard
      id="transcript"
      name="transcript"
      label="Transcript"
      title="Transcript"
      description="Paste the spoken content or transcribe your video for precise timing."
      placeholder="Paste a transcript here, or click Transcribe to simulate auto-generation..."
      icon={Captions}
      iconClassName="text-white"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      action={
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-white/10 bg-white/[0.05] text-white shadow-none hover:bg-white/[0.08]"
          disabled={isTranscribing}
          onClick={simulateTranscribe}
        >
          {isTranscribing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Captions className="size-3.5" />
          )}
          {isTranscribing ? status ?? "Transcribing…" : "Transcribe"}
        </Button>
      }
    />
  );
}

export const fieldCardFixture: ComponentFixture<FieldCardDemoProps> = {
  id: "field-card",
  name: "FieldCard",
  category: "upload",
  description: "Textarea-based card for structured upload field input",
  tags: ["streaming"],
  component: FieldCardDemo,
  defaultProps: {
    variant: "taste",
  },
  states: {
    taste: {
      description: "Taste/style field with pre-filled value",
      props: { variant: "taste" },
    },
    transcript: {
      description: "Transcript field with Transcribe button — click to simulate streaming",
      props: { variant: "transcript" },
    },
    instructions: {
      description: "Prompt/instructions field — empty, ready for input",
      props: { variant: "instructions" },
    },
  },
};

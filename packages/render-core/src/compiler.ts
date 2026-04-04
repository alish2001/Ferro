import * as Babel from "@babel/standalone"
import { createTikTokStyleCaptions } from "@remotion/captions"
import { Lottie } from "@remotion/lottie"
import * as RemotionShapes from "@remotion/shapes"
import { ThreeCanvas } from "@remotion/three"
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions"
import { clockWipe } from "@remotion/transitions/clock-wipe"
import { fade } from "@remotion/transitions/fade"
import { flip } from "@remotion/transitions/flip"
import { slide } from "@remotion/transitions/slide"
import { wipe } from "@remotion/transitions/wipe"
import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import * as THREE from "three"

export interface CompilationResult {
  Component: React.ComponentType | null
  error: string | null
}

// Strip imports and extract component body from LLM-generated code
function extractComponentBody(code: string): string {
  let cleaned = code

  // Remove type imports: import type { ... } from "...";
  cleaned = cleaned.replace(
    /import\s+type\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g,
    "",
  )
  // Remove combined default + named imports: import X, { ... } from "...";
  cleaned = cleaned.replace(
    /import\s+\w+\s*,\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g,
    "",
  )
  // Remove multi-line named imports: import { ... } from "...";
  cleaned = cleaned.replace(
    /import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g,
    "",
  )
  // Remove namespace imports: import * as X from "...";
  cleaned = cleaned.replace(
    /import\s+\*\s+as\s+\w+\s+from\s*["'][^"']+["'];?/g,
    "",
  )
  // Remove default imports: import X from "...";
  cleaned = cleaned.replace(/import\s+\w+\s+from\s*["'][^"']+["'];?/g, "")
  // Remove side-effect imports: import "...";
  cleaned = cleaned.replace(/import\s*["'][^"']+["'];?/g, "")

  cleaned = cleaned.trim()

  // Extract body from "export const MyAnimation = () => { ... };"
  const match = cleaned.match(
    /^([\s\S]*?)export\s+const\s+\w+\s*=\s*\(\s*\)\s*=>\s*\{([\s\S]*)\};?\s*$/,
  )

  if (match) {
    const helpers = match[1].trim()
    const body = match[2].trim()
    return helpers ? `${helpers}\n\n${body}` : body
  }

  return cleaned
}

export function compileCode(code: string): CompilationResult {
  if (!code?.trim()) {
    return { Component: null, error: "No code provided" }
  }

  try {
    const componentBody = extractComponentBody(code)
    const wrappedSource = `const DynamicAnimation = () => {\n${componentBody}\n};`

    const transpiled = Babel.transform(wrappedSource, {
      presets: ["react", "typescript"],
      filename: "dynamic-animation.tsx",
    })

    if (!transpiled.code) {
      return { Component: null, error: "Transpilation failed" }
    }

    const wrappedCode = `${transpiled.code}\nreturn DynamicAnimation;`

    const createComponent = new Function(
      "React",
      "Remotion",
      "RemotionShapes",
      "Lottie",
      "ThreeCanvas",
      "THREE",
      "AbsoluteFill",
      "interpolate",
      "useCurrentFrame",
      "useVideoConfig",
      "spring",
      "Sequence",
      "Img",
      "OffthreadVideo",
      "useState",
      "useEffect",
      "useMemo",
      "useRef",
      "Rect",
      "Circle",
      "Triangle",
      "Star",
      "Polygon",
      "Ellipse",
      "Heart",
      "Pie",
      "makeRect",
      "makeCircle",
      "makeTriangle",
      "makeStar",
      "makePolygon",
      "makeEllipse",
      "makeHeart",
      "makePie",
      "TransitionSeries",
      "linearTiming",
      "springTiming",
      "fade",
      "slide",
      "wipe",
      "flip",
      "clockWipe",
      "createTikTokStyleCaptions",
      wrappedCode,
    )

    const Component = createComponent(
      React,
      {
        AbsoluteFill,
        interpolate,
        useCurrentFrame,
        useVideoConfig,
        spring,
        Sequence,
        Img,
        OffthreadVideo,
      },
      RemotionShapes,
      Lottie,
      ThreeCanvas,
      THREE,
      AbsoluteFill,
      interpolate,
      useCurrentFrame,
      useVideoConfig,
      spring,
      Sequence,
      Img,
      OffthreadVideo,
      useState,
      useEffect,
      useMemo,
      useRef,
      RemotionShapes.Rect,
      RemotionShapes.Circle,
      RemotionShapes.Triangle,
      RemotionShapes.Star,
      RemotionShapes.Polygon,
      RemotionShapes.Ellipse,
      RemotionShapes.Heart,
      RemotionShapes.Pie,
      RemotionShapes.makeRect,
      RemotionShapes.makeCircle,
      RemotionShapes.makeTriangle,
      RemotionShapes.makeStar,
      RemotionShapes.makePolygon,
      RemotionShapes.makeEllipse,
      RemotionShapes.makeHeart,
      RemotionShapes.makePie,
      TransitionSeries,
      linearTiming,
      springTiming,
      fade,
      slide,
      wipe,
      flip,
      clockWipe,
      createTikTokStyleCaptions,
    )

    if (typeof Component !== "function") {
      return {
        Component: null,
        error: "Code must be a function that returns a React component",
      }
    }

    return { Component, error: null }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown compilation error"
    return { Component: null, error: errorMessage }
  }
}

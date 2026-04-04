---
title: Sequential Word Reveal
impact: HIGH
impactDescription: creates punchy, easy-to-follow text choreography for emphasis-driven screens
tags: text, animation, sequence, word-by-word, reveal, fade, stagger, exit
---

## Sequential Word-by-Word Reveal

Animate words one at a time using a shared spring config, with each word delayed by a fixed frame offset. All words share the same visual anchor point so the viewer's eye never moves.

**Incorrect (all words animate together):**

```tsx
const WORDS = ["Word", "Two", "Three"];

const progress = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });

WORDS.map((word) => (
  <span style={{ opacity: progress, transform: `translateY(${(1 - progress) * 12}px)` }}>
    {word}
  </span>
));
```

**Correct (staggered word-by-word reveal, shared anchor):**

```tsx
// Constants — defined at top of component body
const WORDS = ["Word", "Two", "Three"]; // replace with your content
const WORD_DELAY = 12; // frames between each word appearing
const SPRING_CONFIG = { damping: 22, stiffness: 90 };

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const wordElements = WORDS.map((word, i) => {
  const progress = spring({
    frame: frame - i * WORD_DELAY,
    fps,
    config: SPRING_CONFIG,
  });

  return (
    <span
      key={i}
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 10}px)`,
        display: "inline-block",
        marginRight: "0.25em",
      }}
    >
      {word}
    </span>
  );
});
```

## Anchor All Words to a Single Visual Point

Keep the text block centered and fixed in place so the viewer's eye stays locked. Do not shift or reflow the layout as words appear — use `flexWrap` with a fixed container.

**Incorrect (layout shifts as words appear):**

```tsx
<div style={{ display: "flex", gap: 8 }}>
  {visibleWords.map((w) => <span>{w}</span>)}
</div>
```

**Correct (all words pre-laid out, revealed in place):**

```tsx
<div
  style={{
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "baseline",
    gap: "0.25em",
  }}
>
  {wordElements}
</div>
```

> Rendering all words simultaneously (with opacity driven by spring progress) prevents layout reflow. The viewer's focal point never shifts.

## First Word: Subtle Entrance

The first word should use a gentler spring — lower stiffness — to ease the viewer in before the pace picks up.

```tsx
const getSpringConfig = (index: number) =>
  index === 0
    ? { damping: 28, stiffness: 60 }  // softer for the first word
    : { damping: 22, stiffness: 90 }; // snappier for subsequent words

WORDS.map((word, i) => {
  const progress = spring({
    frame: frame - i * WORD_DELAY,
    fps,
    config: getSpringConfig(i),
  });
  // ...
});
```

## Ease-Out Exit for the Full Screen

Once all words are visible, transition the entire composition out with an interpolated ease-out — not a spring — so the exit feels intentional and clean.

```tsx
const { durationInFrames } = useVideoConfig();
const EXIT_FRAMES = 18;
const EXIT_START = durationInFrames - EXIT_FRAMES;

const exitOpacity = interpolate(
  frame,
  [EXIT_START, durationInFrames],
  [1, 0],
  {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  }
);

<div style={{ opacity: exitOpacity }}>
  {wordElements}
</div>
```

## Full Pattern: Reveal + Hold + Exit

Complete self-contained component combining staggered word reveal, hold, and ease-out exit:

```tsx
import { spring, interpolate, Easing, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";

const WORDS = ["Word", "Two", "Three"]; // replace with your content
const WORD_DELAY = 12;
const HOLD_FRAMES = 20;
const EXIT_FRAMES = 18;

export const WordReveal = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const EXIT_START = durationInFrames - EXIT_FRAMES;

  const exitOpacity = interpolate(
    frame,
    [EXIT_START, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    }
  );

  const wordElements = WORDS.map((word, i) => {
    const config =
      i === 0
        ? { damping: 28, stiffness: 60 }
        : { damping: 22, stiffness: 90 };

    const progress = spring({ frame: frame - i * WORD_DELAY, fps, config });

    return (
      <span
        key={i}
        style={{
          opacity: progress,
          transform: `translateY(${(1 - progress) * 10}px)`,
          display: "inline-block",
          marginRight: "0.25em",
        }}
      >
        {word}
      </span>
    );
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          gap: "0.25em",
        }}
      >
        {wordElements}
      </div>
    </AbsoluteFill>
  );
};
```

If nested inside a `<Sequence>`, Remotion automatically offsets `useCurrentFrame()` — no manual frame offsets needed.

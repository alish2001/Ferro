---
title: Scrolling Timeline with Zoom-Out Reveal
impact: HIGH
impactDescription: creates a cinematic "journey through time" effect that builds suspense milestone-by-milestone before revealing the full picture
tags: timeline, scroll, camera, pan, zoom-out, history, sequence, choreography
---

## What This Is and When to Use It

A two-phase horizontal timeline animation: first, a slow camera pan that drags the timeline from right to left, revealing milestones one at a time; then a smooth zoom-out and re-center that reveals the entire timeline at once. Use this when the script walks through a chronological series of events and the payoff is seeing them all in context together.

Milestones alternate above and below the timeline rail. Spacing between milestones is proportional to the actual time gap between them — events close in time appear close together on screen.

---

## Phase 1: Proportional Milestone Placement

Milestone x-positions must reflect real elapsed time, not equal spacing.

**Incorrect (equal spacing regardless of time gaps):**
```tsx
const x = index * ITEM_SPACING;
```

**Correct (proportional to time delta):**
```tsx
// Replace years and labels with your content — the structure drives proportional spacing
const ITEMS = [
  { year: 1990, label: "LABEL_A", above: true },
  { year: 1998, label: "LABEL_B", above: false },
  { year: 2001, label: "LABEL_C", above: true },
  { year: 2008, label: "LABEL_D", above: false },
  { year: 2020, label: "LABEL_E", above: true },
];

const START_YEAR = ITEMS[0].year;
const END_YEAR = ITEMS[ITEMS.length - 1].year;
const TOTAL_SPAN = END_YEAR - START_YEAR;
const TIMELINE_WIDTH = 2400; // total px width of the full rail

const getX = (year: number) =>
  ((year - START_YEAR) / TOTAL_SPAN) * TIMELINE_WIDTH;
```

---

## Phase 2: Camera Pan (Right to Left)

The camera starts framed on the first milestone and slowly translates left across the full timeline rail. The viewer's focal point stays fixed on-screen while the world moves.

**Incorrect (moving each item individually):**
```tsx
ITEMS.map((item) => (
  <div style={{ transform: `translateX(${-frame * SPEED}px)` }} />
));
```

**Correct (translate a single container — the "camera" moves, not the items):**
```tsx
const PHASE1_DURATION = 180; // frames for the pan

// Pan from first item at left edge to last item at right edge
const pan = interpolate(
  frame,
  [0, PHASE1_DURATION],
  [0, -(TIMELINE_WIDTH - width)],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) }
);

<div style={{ transform: `translateX(${pan}px)` }}>
  {/* all milestone nodes live here */}
</div>
```

---

## Phase 3: Zoom-Out and Re-Center

Once the pan reaches the last milestone, the camera pulls back and recenters to show the full timeline. Achieve this with a scale + translateX combination on the same container.

**Incorrect (only scaling — the timeline drifts off-center):**
```tsx
const scale = interpolate(frame, [PHASE2_START, PHASE2_END], [1, TARGET_SCALE], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
<div style={{ transform: `scale(${scale})` }} />
```

**Correct (scale + translate back to center simultaneously):**
```tsx
const PHASE2_START = PHASE1_DURATION;
const PHASE2_DURATION = 60;
const PHASE2_END = PHASE2_START + PHASE2_DURATION;

// Scale shrinks the rail so the whole thing fits in frame
const TARGET_SCALE = (width * 0.9) / TIMELINE_WIDTH;

const scaleProgress = interpolate(
  frame,
  [PHASE2_START, PHASE2_END],
  [0, 1],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) }
);

const scale = interpolate(scaleProgress, [0, 1], [1, TARGET_SCALE], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});

// Translate: undo the pan offset and center the scaled rail
const centeredOffset = (width - TIMELINE_WIDTH * scale) / 2;
const translateX = interpolate(scaleProgress, [0, 1], [pan, centeredOffset], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});

<div style={{ transform: `translateX(${translateX}px) scale(${scale})`, transformOrigin: "0 50%" }}>
  {/* milestone nodes */}
</div>
```

Use `transformOrigin: "0 50%"` so the scale anchors to the left edge — this keeps the `translateX` calculation predictable when centering the zoomed-out rail.

---

## Milestone Entrance Timing

Each milestone fades in only as the camera reaches it. Gate visibility by offsetting each item's entrance frame proportionally to its position on the timeline.

**Incorrect (all milestones animate in at the same time):**
```tsx
const opacity = interpolate(frame, [0, ENTRANCE_DURATION], [0, 1], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
```

**Correct (each milestone entrance offset by its position along the rail):**
```tsx
const ENTRANCE_DURATION = 20;

const entranceFrame = Math.round(
  interpolate(getX(item.year), [0, TIMELINE_WIDTH], [0, PHASE1_DURATION], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  })
);

const elapsed = Math.max(0, frame - entranceFrame);

const opacity = interpolate(elapsed, [0, ENTRANCE_DURATION], [0, 1], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
const rise = interpolate(elapsed, [0, ENTRANCE_DURATION], [16, 0], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
```

---

## Full Pattern

```tsx
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  Easing,
} from "remotion";

// Replace years and labels with your content — years drive proportional spacing
const ITEMS = [
  { year: 1990, label: "LABEL_A", above: true },
  { year: 1998, label: "LABEL_B", above: false },
  { year: 2001, label: "LABEL_C", above: true },
  { year: 2008, label: "LABEL_D", above: false },
  { year: 2011, label: "LABEL_E", above: true },
  { year: 2018, label: "LABEL_F", above: false },
  { year: 2020, label: "LABEL_G", above: true },
];

const START_YEAR = ITEMS[0].year;
const END_YEAR = ITEMS[ITEMS.length - 1].year;
const TOTAL_SPAN = END_YEAR - START_YEAR;
const TIMELINE_WIDTH = 2400;
const ABOVE_OFFSET = -80;
const BELOW_OFFSET = 80;
const TICK_HEIGHT = 24;
const PHASE1_DURATION = 200;
const PHASE2_DURATION = 70;
const ENTRANCE_DURATION = 18;

const getX = (year: number) =>
  ((year - START_YEAR) / TOTAL_SPAN) * TIMELINE_WIDTH;

export const ScrollingTimeline = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const pan = interpolate(
    frame,
    [0, PHASE1_DURATION],
    [0, -(TIMELINE_WIDTH - width)],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) }
  );

  const PHASE2_START = PHASE1_DURATION;
  const PHASE2_END = PHASE2_START + PHASE2_DURATION;
  const TARGET_SCALE = (width * 0.9) / TIMELINE_WIDTH;

  const scaleProgress = interpolate(
    frame,
    [PHASE2_START, PHASE2_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) }
  );

  const scale = interpolate(scaleProgress, [0, 1], [1, TARGET_SCALE], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const centeredOffset = (width - TIMELINE_WIDTH * scale) / 2;
  const translateX = interpolate(scaleProgress, [0, 1], [pan, centeredOffset], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          width: TIMELINE_WIDTH,
          transform: `translateX(${translateX}px) translateY(-50%) scale(${scale})`,
          transformOrigin: "0 50%",
        }}
      >
        {/* Horizontal rail */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: TIMELINE_WIDTH,
            height: 2,
            background: "currentColor",
            transform: "translateY(-50%)",
          }}
        />

        {ITEMS.map((item) => {
          const itemX = getX(item.year);

          const entranceFrame = Math.round(
            interpolate(itemX, [0, TIMELINE_WIDTH], [0, PHASE1_DURATION], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            })
          );

          const elapsed = Math.max(0, frame - entranceFrame);
          const opacity = interpolate(elapsed, [0, ENTRANCE_DURATION], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const rise = interpolate(elapsed, [0, ENTRANCE_DURATION], [16, 0], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });

          const textY = item.above ? ABOVE_OFFSET : BELOW_OFFSET;

          return (
            <div
              key={item.year}
              style={{
                position: "absolute",
                left: itemX,
                top: "50%",
                transform: "translate(-50%, -50%)",
                opacity,
              }}
            >
              {/* Tick mark */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: item.above ? -TICK_HEIGHT : 0,
                  width: 2,
                  height: TICK_HEIGHT,
                  background: "currentColor",
                  transform: "translateX(-50%)",
                }}
              />
              {/* Label block */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: textY,
                  transform: `translate(-50%, ${rise}px)`,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ fontWeight: 700, lineHeight: 1 }}>{item.year}</div>
                <div style={{ fontWeight: 400 }}>{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

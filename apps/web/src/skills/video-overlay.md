---
title: Video Overlay Graphics
impact: HIGH
impactDescription: ensures overlays render correctly over video without blocking content
tags: overlay, video, lower-third, transparent, positioning
---

## Transparent Backgrounds Are Mandatory

NEVER set `backgroundColor` on `AbsoluteFill`. Overlays render over a source video — any
background color will block the video content beneath it.

**Incorrect (blocks video):**

```tsx
<AbsoluteFill style={{ backgroundColor: "#000" }}>
  <LowerThird />
</AbsoluteFill>
```

**Correct (transparent):**

```tsx
<AbsoluteFill>
  <LowerThird />
</AbsoluteFill>
```

## Always Back Text with a Semi-Transparent Surface

Text needs contrast against unknown video content. Always wrap text in a backdrop div.

```tsx
const BACKDROP_COLOR = "rgba(0, 0, 0, 0.58)";
const BACKDROP_BLUR = "blur(8px)";

<div
  style={{
    backgroundColor: BACKDROP_COLOR,
    backdropFilter: BACKDROP_BLUR,
    borderRadius: 8,
    padding: "12px 20px",
  }}
>
  <span style={{ color: "#FFFFFF", fontWeight: 700 }}>{TEXT}</span>
</div>
```

## Standard Position Constants

Use `useVideoConfig()` for responsive positioning relative to canvas size.

```tsx
const { width, height } = useVideoConfig();

// Lower thirds — bottom ~15% of frame, left-anchored
const LOWER_THIRD_X = width * 0.06;
const LOWER_THIRD_Y = height * 0.80;
const LOWER_THIRD_WIDTH = width * 0.45;

// Supers / title cards — top ~10% of frame
const SUPER_X = width * 0.06;
const SUPER_Y = height * 0.08;

// Centered callouts
const CENTER_X = width * 0.5;
const CENTER_Y = height * 0.5;
```

## Frame Coverage Limits

Keep overlays to ≤25% of the frame area unless the brief explicitly calls for more.
Full-frame overlays (e.g. outro cards) should:
- Use semi-opaque backgrounds: `rgba(0, 0, 0, 0.72)`
- Fade in with `spring()` rather than appearing abruptly
- Never use fully opaque fills unless it's a deliberate wipe

## Typography Standards for Video

Minimum sizes ensure legibility over compressed video:

```tsx
// Lower thirds
const NAME_FONT_SIZE = Math.round(height * 0.042);     // ~45px at 1080p
const ROLE_FONT_SIZE = Math.round(height * 0.028);     // ~30px at 1080p

// Title cards
const TITLE_FONT_SIZE = Math.round(height * 0.065);    // ~70px at 1080p
const SUBTITLE_FONT_SIZE = Math.round(height * 0.038); // ~41px at 1080p

// Always use system font stack for reliability
const FONT_FAMILY = "system-ui, -apple-system, sans-serif";

// Primary: white; Secondary: slightly transparent white
const COLOR_PRIMARY = "#FFFFFF";
const COLOR_SECONDARY = "rgba(255, 255, 255, 0.78)";
```

## Lower Third Pattern

Standard broadcast lower third structure:

```tsx
const slideIn = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
const translateX = interpolate(slideIn, [0, 1], [-LOWER_THIRD_WIDTH * 0.3, 0]);

<div
  style={{
    position: "absolute",
    left: LOWER_THIRD_X,
    top: LOWER_THIRD_Y,
    transform: `translateX(${translateX}px)`,
    opacity: slideIn,
  }}
>
  <div style={{ backgroundColor: BACKDROP_COLOR, borderRadius: 6, padding: "10px 18px" }}>
    <div style={{ color: COLOR_PRIMARY, fontSize: NAME_FONT_SIZE, fontWeight: 700 }}>
      {SPEAKER_NAME}
    </div>
    <div style={{ color: COLOR_SECONDARY, fontSize: ROLE_FONT_SIZE, fontWeight: 400 }}>
      {SPEAKER_ROLE}
    </div>
  </div>
</div>
```

## Outro Card Pattern

Full-frame outro with semi-opaque background that fades in:

```tsx
const fadeIn = spring({ frame, fps, config: { damping: 25, stiffness: 80 } });

<AbsoluteFill
  style={{
    backgroundColor: `rgba(0, 0, 0, ${0.78 * fadeIn})`,
    justifyContent: "center",
    alignItems: "center",
  }}
>
  <div style={{ opacity: fadeIn, textAlign: "center" }}>
    <div style={{ color: "#FFFFFF", fontSize: TITLE_FONT_SIZE, fontWeight: 700 }}>
      {CTA_TEXT}
    </div>
  </div>
</AbsoluteFill>
```

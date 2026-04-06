# Ferro Web Design System

This document captures the current UI system for the web app after the homepage and transcription-flow refresh.

It is not a generic brand guide. It is a practical reference for building new UI in `apps/web` so new work matches the updated Ferro feel.

## Purpose

The current Ferro UI should feel:

- airy
- cinematic
- glassy rather than flat
- product-focused rather than marketing-heavy
- calm at rest, with motion reserved for meaningful transitions and progress

The homepage and preview now share one visual language so the app feels like a single tool, not a collection of unrelated screens.

## Core Principles

1. Lead with the source-video workflow. The upload surface is the hero, not a secondary control.
2. Prefer frosted surfaces over solid cards. Use translucency, blur, and soft edges to create depth.
3. Keep hierarchy obvious. Primary actions can be solid; everything else should sit on glass.
4. Use generous spacing. "Airy" comes more from whitespace and restraint than from bigger effects.
5. Motion should clarify state changes, not decorate every element.
6. Show powerful debug information only when useful, and collapse it by default.

## Theme Model

The app uses `ThemeProvider` in `src/app/layout.tsx` with `attribute="class"` and `defaultTheme="system"`.

- `:root` in `src/app/globals.css` defines the light token set
- `.dark` defines the dark token set
- the same component structure should work in both themes

Ferro's intended product mood is still "dark glass", but the token system now supports both light and dark without separate component implementations.

## Typography

- Body and heading font: Geist Sans
- Monospace metadata font: Geist Mono
- Use mono for labels like section overlines, status metadata, dimensions, fps, and machine-like details
- Use sans for all primary content, headings, and explanatory copy

Typography style rules:

- headings should feel compact and editorial with slightly negative tracking
- body copy should stay soft and readable, usually `text-sm` to `text-base`
- metadata should use uppercase mono with wider tracking

## Color And Surface System

The visual system lives in `src/app/globals.css`.

### Key token groups

- base tokens: `--background`, `--foreground`, `--muted`, `--border`, `--ring`
- glass tokens: `--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-border-hover`, `--glass-blur`, `--glass-highlight`, `--glass-shadow`
- nested glass tokens: `--glass-panel-inner-bg`, `--glass-panel-inner-inset`
- subdued status-panel tokens: `--glass-panel-muted-border`, `--glass-panel-muted-bg`, `--glass-panel-muted-shadow`
- body-atmosphere tokens: `--body-grid-line`, `--body-radial-1`, `--body-radial-2`, `--body-radial-3`, `--body-linear-top`

### Surface utility classes

Prefer these shared classes over hand-rolled one-off combinations:

- `.glass-panel`
  Use for standard shells and card containers.

- `.glass-panel-hero`
  Use for the most prominent frosted surface on a page. Right now this is the upload hero.

- `.glass-panel-inner`
  Use for inset panels inside a larger shell, such as drop targets, readouts, or disclosure bodies.

- `.glass-panel-muted`
  Use for subdued but elevated sections such as session summaries, export state, and reattach warnings.

### Background treatment

The page background should not be flat. The app uses:

- a subtle grid
- layered radial glows
- a soft top-down gradient wash
- fixed attachment so the atmosphere feels stable behind the glass layers

If you add a new full-page surface, do not replace this with a plain fill unless there is a very strong product reason.

## Shape Language

Radius tokens in `globals.css` define the shape system:

- `--radius-card`
- `--radius-card-inner`
- `--radius-card-status`
- `--radius-hero`
- `--radius-button-lg`

Shape guidance:

- big feature surfaces should be rounded and soft, never sharp
- nested surfaces should use a slightly smaller radius than their parent
- pills and toggles should be fully rounded when they read like controls or filters

## Motion System

Motion is intentionally light and used in a few places only.

### Current patterns

- form-field stagger on homepage load
- form-to-preview fade/slide transition
- inline loading spinner for transcription
- progress animation through existing progress components
- disclosure-chevron rotation for transcription debug details

### Motion rules

- always respect `useReducedMotion()` for React motion work
- prefer short durations, roughly `0.2s` to `0.25s`
- use motion to explain state changes: entering a screen, loading, expanding details
- avoid continuous ambient motion on primary surfaces

If you add new motion, use the same restraint level as the homepage transition and field stagger.

## Component Guidance

### Upload Hero

Implemented in `src/components/form-view.tsx`.

Use this surface to:

- attach the video
- show drag state
- show key file metadata
- communicate transcription progress

Rules:

- the upload area is the primary visual anchor on the page
- transcription status belongs near the hero because it is a global step in the flow
- file dimensions should feel like a compact readout, not a separate card

### Field Cards

Implemented through `src/components/upload/field-card.tsx`.

These cards are the core content modules for:

- Taste
- Transcript
- Prompt

Rules:

- all field cards should use the same shell and spacing
- textarea interiors should feel inset and quieter than the outer shell
- action rows should stay compact and pill-like
- supporting notes live above the textarea when they relate to the field's current state

### Transcription Debug Panel

Implemented in `src/components/upload/transcription-debug-panel.tsx`.

This is the pattern for developer-facing detail that should stay available without polluting the main UX.

Rules:

- hide it unless there is a video and useful transcription payload or progress
- keep it collapsed by default
- label should remain understandable outside dev mode
- raw JSON is acceptable here because the surface is explicitly diagnostic

### Session And Export Panels

Homepage summaries and preview export sections now use the same glass vocabulary.

Rules:

- status-heavy sections should use muted glass, not the loudest hero treatment
- warnings can tint the panel, but should still feel part of the same system
- machine metadata can use mono text and subdued contrast

### Buttons

Hierarchy matters:

- primary action: solid or near-solid button with strong contrast
- secondary actions: translucent pill or outlined button on glass
- destructive or warning actions should stay rare and visually distinct

The current Generate button is intentionally more solid than the surrounding surfaces so the page keeps a clear action hierarchy.

## Homepage UX Rules

The homepage now follows this sequence:

1. attach video
2. auto-transcribe
3. adjust taste, transcript, and prompt
4. optionally inspect transcription details
5. generate
6. move into preview

Important behavioral rules:

- transcription should auto-run when a valid video is attached
- the visible transcript should be editable plain text
- raw timing data should live in `captions`, not inside the main transcript field
- "Transcribe again" is a secondary recovery control, not the primary expected path
- the caption-layer toggle can appear once timing data is ready

## Playground Coverage

You can inspect parts of this system in `/playground`.

Currently relevant fixtures in `src/app/playground/registry.ts` include:

- `FieldCard`
- `TranscriptionDebugPanel`
- `GenerationStatus`
- `ModelSelector`
- `ResolutionSelector`
- `Button`
- `StatusPill`
- `AnimatedProgress`
- `GraphicCard`
- `CompositorPreview`
- `PipelineFlowchart`

Best places to review this design system in isolation:

- `TranscriptionDebugPanel` for the collapsed diagnostic pattern
- `FieldCard` for shell, spacing, and text-area treatment
- `Button` plus `StatusPill` for action and state styling
- `GraphicCard` and `CompositorPreview` for how the glass system coexists with preview tooling

## Implementation Map

Use these files when extending or auditing the system:

- `src/app/globals.css`
- `src/components/form-view.tsx`
- `src/components/preview-view.tsx`
- `src/components/upload/field-card.tsx`
- `src/components/upload/transcription-debug-panel.tsx`
- `src/app/page.tsx`

## Do / Don't

### Do

- reuse the glass utilities and tokens
- preserve the upload-first structure
- keep spacing generous
- use mono text sparingly for machine-readable metadata
- gate debug information behind progressive disclosure
- keep motion short and reduced-motion-safe

### Don't

- introduce flat, opaque cards next to glass surfaces without a strong reason
- make every element pulse, shimmer, or animate
- dump raw JSON into primary user-editable fields
- create a separate visual language for preview if the same system can be reused
- add marketing-style chrome that competes with the product workflow

## Current Status

This design system reflects the current MVP UI refresh, not a final brand book.

If new primitives are added, update this file when:

- a new shared surface class is introduced
- motion rules materially change
- a new primary workflow pattern is added
- the playground gains a fixture that represents a reusable Ferro UI primitive

import type { FerroCaption } from "@/lib/ferro-contracts"

/**
 * Returns a self-contained Remotion component string that renders
 * TikTok-style animated captions with word-level highlighting.
 *
 * The caption data is embedded as a const — no runtime fetch needed.
 * Code format matches Ferro's compiler expectations:
 *   - No imports (compiler strips them; required APIs are injected as globals)
 *   - Helper functions before the `export const X = () => { ... }` block
 *   - Main component uses `export const` arrow function (not `export default function`)
 */
export function buildCaptionsLayerCode(captions: FerroCaption[]): string {
  const captionsJson = JSON.stringify(captions)

  return `const CAPTIONS = ${captionsJson};

const SWITCH_EVERY_MS = 1500;
const HIGHLIGHT_COLOR = "#39E508";
const TEXT_COLOR = "#ffffff";

function CaptionPage({ page, fps }) {
  const frame = useCurrentFrame();
  const timeInMs = (frame / fps) * 1000;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 80 }}>
      <div
        style={{
          textAlign: "center",
          fontSize: 52,
          fontWeight: 800,
          color: TEXT_COLOR,
          fontFamily: "Arial, sans-serif",
          letterSpacing: -0.5,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
          maxWidth: "88%",
          lineHeight: 1.25,
          whiteSpace: "pre-wrap",
        }}
      >
        {page.tokens.map((token, i) => {
          const relStart = token.fromMs - page.startMs;
          const relEnd = token.toMs - page.startMs;
          const active = relStart <= timeInMs && relEnd > timeInMs;
          return (
            <span
              key={i}
              style={{
                color: active ? HIGHLIGHT_COLOR : TEXT_COLOR,
                transition: "color 0.05s",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

export const CaptionsLayer = () => {
  const { fps, durationInFrames } = useVideoConfig();

  const { pages } = createTikTokStyleCaptions({
    captions: CAPTIONS.map((c) => ({
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
      timestampMs: c.startMs,
      confidence: null,
    })),
    combineTokensWithinMilliseconds: SWITCH_EVERY_MS,
  });

  return (
    <AbsoluteFill>
      {pages.map((page, i) => {
        const nextPage = pages[i + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = nextPage
          ? Math.min(
              Math.round((nextPage.startMs / 1000) * fps),
              startFrame + Math.round((SWITCH_EVERY_MS / 1000) * fps),
            )
          : durationInFrames;
        const duration = Math.max(1, endFrame - startFrame);

        return (
          <Sequence key={i} from={startFrame} durationInFrames={duration}>
            <CaptionPage page={page} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
`
}

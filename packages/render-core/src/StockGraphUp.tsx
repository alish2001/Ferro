import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── Layout ──────────────────────────────────────────────────────────────────
const W = 1920;
const H = 1080;
const PAD = { top: 140, right: 180, bottom: 140, left: 120 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

// ─── Stock data (normalised: x ∈ [0,1], y ∈ [0,1] where 1 = top) ────────────
const DATA: [number, number][] = [
  [0.00, 0.10], [0.04, 0.07], [0.09, 0.13], [0.14, 0.09],
  [0.19, 0.16], [0.24, 0.22], [0.29, 0.18], [0.34, 0.26],
  [0.39, 0.31], [0.44, 0.28], [0.49, 0.37], [0.54, 0.44],
  [0.59, 0.40], [0.64, 0.50], [0.69, 0.57], [0.74, 0.53],
  [0.79, 0.63], [0.84, 0.69], [0.89, 0.66], [0.94, 0.76],
  [1.00, 0.84],
];

const sx = (nx: number) => PAD.left + nx * CHART_W;
const sy = (ny: number) => PAD.top + (1 - ny) * CHART_H;

/** Linearly interpolate Y from DATA at a given normalised X */
function getTipY(nx: number): number {
  if (nx <= DATA[0][0]) return DATA[0][1];
  for (let i = 1; i < DATA.length; i++) {
    if (nx <= DATA[i][0]) {
      const frac = (nx - DATA[i - 1][0]) / (DATA[i][0] - DATA[i - 1][0]);
      return DATA[i - 1][1] + frac * (DATA[i][1] - DATA[i - 1][1]);
    }
  }
  return DATA[DATA.length - 1][1];
}

const buildLinePath = (pts: [number, number][]): string => {
  const p = pts.map(([x, y]) => [sx(x), sy(y)] as [number, number]);
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length; i++) {
    const prev = p[i - 1];
    const curr = p[i];
    const cpx = (prev[0] + curr[0]) / 2;
    d += ` C ${cpx} ${prev[1]}, ${cpx} ${curr[1]}, ${curr[0]} ${curr[1]}`;
  }
  return d;
};

const LINE_D = buildLinePath(DATA);
const LAST = DATA[DATA.length - 1];
const ENDPOINT = { x: sx(LAST[0]), y: sy(LAST[1]) };
const GRID_Y = [0.2, 0.4, 0.6, 0.8].map((t) => PAD.top + (1 - t) * CHART_H);

// ─── Timing ───────────────────────────────────────────────────────────────────
const LINE_REVEAL_END = 0.78;
const DOT_START_FRAC  = 0.80;

// Camera parallax phases (fraction of total duration)
const ZOOM_IN_START  = 0.12;  // start zooming in
const ZOOM_IN_END    = 0.70;  // fully zoomed
const ZOOM_PEAK_END  = 0.82;  // start zooming out
const ZOOM_OUT_END   = 1.00;  // back to wide shot
const MAX_ZOOM       = 2.6;

// ─── Component ────────────────────────────────────────────────────────────────
export const StockGraphUp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const t = frame / dur;

  // ── Line reveal ──────────────────────────────────────────────────────────
  const revealProgress = interpolate(t, [0, LINE_REVEAL_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipWidth = PAD.left + revealProgress * (CHART_W + PAD.right + 40);

  // ── Current needle position (tip of drawing line) ─────────────────────
  const tipNx = revealProgress;
  const tipNy = getTipY(tipNx);
  const tipX = sx(tipNx);
  const tipY = sy(tipNy);

  // ── Camera zoom blend (0 = wide, 1 = zoomed in) ──────────────────────
  const zoomBlend = interpolate(
    t,
    [ZOOM_IN_START, ZOOM_IN_END, ZOOM_PEAK_END, ZOOM_OUT_END],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const zoom = 1 + (MAX_ZOOM - 1) * zoomBlend;

  // With transform-origin: "0 0", we need:
  //   screenPos(tip) = tip * zoom + offset = (W/2, H/2) when fully zoomed
  // Blend offset from 0 (normal) → (W/2 - tipX*MAX_ZOOM, H/2 - tipY*MAX_ZOOM) (zoomed)
  const camTx = (W / 2 - tipX * MAX_ZOOM) * zoomBlend;
  const camTy = (H / 2 - tipY * MAX_ZOOM) * zoomBlend;

  // ── Endpoint dot springs in after line finishes ───────────────────────
  const dotFrame = Math.max(0, frame - Math.floor(dur * DOT_START_FRAC));
  const dotScale = spring({ fps, frame: dotFrame, config: { damping: 200 } });

  // ── Title slide-up & fade ─────────────────────────────────────────────
  const titleOpacity = interpolate(t, [0.02, 0.22], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const titleY = interpolate(t, [0.02, 0.22], [28, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const gridOpacity = interpolate(t, [0, 0.08], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Needle dot fades in after a brief moment
  const needleOpacity = interpolate(t, [0.04, 0.14], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── B&W colour scheme ─────────────────────────────────────────────────
  const bgColor    = "#f7f7f7";
  const axisColor  = "rgba(0,0,0,0.25)";
  const gridColor  = "rgba(0,0,0,0.07)";
  const lineColor  = "#00c853";
  const textColor  = "rgba(0,0,0,0.40)";
  const titleColor = "#111111";

  return (
    <AbsoluteFill
      style={{ background: bgColor, fontFamily: "system-ui, sans-serif", overflow: "hidden" }}
    >
      {/* ── Camera container — parallax zoom ─────────────────────────── */}
      <div
        style={{
          width: W,
          height: H,
          transformOrigin: "0 0",
          transform: `translate(${camTx}px, ${camTy}px) scale(${zoom})`,
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            {/* Clip that expands left → right to reveal the line */}
            <clipPath id="lineReveal">
              <rect x={0} y={0} width={clipWidth} height={H} />
            </clipPath>

            {/* Area fill gradient */}
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineColor} stopOpacity={0.18} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.00} />
            </linearGradient>

            {/* Line glow */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Needle glow (bigger) */}
            <filter id="needleGlow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Grid & Axes ──────────────────────────────────────────── */}
          <g opacity={gridOpacity}>
            {GRID_Y.map((y, i) => (
              <line key={i} x1={PAD.left} y1={y} x2={PAD.left + CHART_W} y2={y}
                stroke={gridColor} strokeWidth={1} />
            ))}
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CHART_H}
              stroke={axisColor} strokeWidth={1.5} />
            <line x1={PAD.left} y1={PAD.top + CHART_H} x2={PAD.left + CHART_W} y2={PAD.top + CHART_H}
              stroke={axisColor} strokeWidth={1.5} />
            {[0.2, 0.4, 0.6, 0.8].map((t2, i) => (
              <text key={i} x={PAD.left - 16} y={sy(t2) + 5}
                textAnchor="end" fill={textColor} fontSize={22}
                fontFamily="system-ui, monospace">
                {(80 + t2 * 60).toFixed(0)}
              </text>
            ))}
          </g>

          {/* ── Area fill (clipped) ──────────────────────────────────── */}
          <path
            d={`${LINE_D} L ${ENDPOINT.x} ${PAD.top + CHART_H} L ${PAD.left} ${PAD.top + CHART_H} Z`}
            fill="url(#areaGrad)"
            clipPath="url(#lineReveal)"
          />

          {/* ── Stock line (clipped) ─────────────────────────────────── */}
          <path
            d={LINE_D}
            fill="none"
            stroke={lineColor}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            clipPath="url(#lineReveal)"
          />

          {/* ── Needle dot — tracks the live tip of the drawing line ─── */}
          <g opacity={needleOpacity} transform={`translate(${tipX}, ${tipY})`}>
            {/* Outer pulse ring */}
            <circle r={22} fill="none" stroke={lineColor} strokeWidth={1.5} opacity={0.25} />
            <circle r={14} fill="none" stroke={lineColor} strokeWidth={1.5} opacity={0.45} />
            {/* Core */}
            <circle r={8} fill={lineColor} filter="url(#needleGlow)" />
          </g>

          {/* ── Endpoint dot (springs in after line finishes) ────────── */}
          <g transform={`translate(${ENDPOINT.x}, ${ENDPOINT.y}) scale(${dotScale})`}>
            <circle r={14} fill="none" stroke={lineColor} strokeWidth={2} opacity={0.5} />
            <circle r={7}  fill={lineColor} filter="url(#glow)" />
          </g>

          {/* ── Title ───────────────────────────────────────────────── */}
          <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
            <text x={PAD.left} y={PAD.top - 48}
              fill={titleColor} fontSize={56} fontWeight={700} letterSpacing={-1}
              fontFamily="system-ui, sans-serif">
              ACME
            </text>
            <text x={PAD.left + 168} y={PAD.top - 48}
              fill={lineColor} fontSize={56} fontWeight={700} letterSpacing={-1}
              fontFamily="system-ui, sans-serif">
              +12.4%
            </text>
            <text x={PAD.left} y={PAD.top - 10}
              fill={textColor} fontSize={24}
              fontFamily="system-ui, sans-serif" letterSpacing={1}>
              1 DAY  •  NYSE
            </text>
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};

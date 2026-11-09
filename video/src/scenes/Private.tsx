import type { FC, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type Caption, CaptionHeader } from "../components/CaptionHeader";
import { Exit } from "../components/Exit";
import { CYAN, PAPER } from "../theme";

const CAPTION: Caption = {
  title: "Runs on your machine",
  accent: "your",
  sub: "Translation uses Chrome's built-in on-device model. Nothing you read is sent anywhere.",
};

// Line icons on a 32-unit grid, each for the thing the point says is absent.
const KEY: ReactNode = (
  <>
    <circle cx={10} cy={16} r={5} />
    <path d="M15 16 H28 M24 16 V20 M20 16 V19" />
  </>
);
const SIGNAL: ReactNode = (
  <>
    <path d="M4.5 12.5 A16 16 0 0 1 27.5 12.5" />
    <path d="M8.5 17 A10.5 10.5 0 0 1 23.5 17" />
    <path d="M12.5 21.5 A5 5 0 0 1 19.5 21.5" />
    <circle cx={16} cy={25.5} r={1.3} fill={PAPER} />
  </>
);
const CHART: ReactNode = (
  <>
    <path d="M6 26 H26" />
    <path d="M10 26 V18 M16 26 V10 M22 26 V14" strokeWidth={3} />
  </>
);

// The listing's fifth image says these three things too, and adds the API translator as an
// option beside them, which this scene does not show.
const POINTS = [
  {
    label: "No key, no account",
    text: "Nothing to sign up for and nothing to pay for.",
    icon: KEY,
  },
  {
    label: "Works offline",
    text: "Once Chrome has the language pack, no network is used.",
    icon: SIGNAL,
  },
  { label: "No data collected", text: "No analytics, no telemetry, no reporting.", icon: CHART },
];

// The beats of the scene, in its own frames.
/** The first card rises, and each after it this many frames later. */
const CARDS_AT = 14;
const CARD_STAGGER = 10;
/** Once a card is up, a line is struck through its icon. */
const STRIKE_AFTER = 12;
const STRIKE_FRAMES = 12;
/** The length of the strike, corner to corner of the icon's inner square. */
const STRIKE = Math.hypot(22, 22);

/** One of the three points: an icon struck through, and what the strike means. */
const Point: FC<{ label: string; text: string; icon: ReactNode; order: number }> = ({
  label,
  text,
  icon,
  order,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = CARDS_AT + order * CARD_STAGGER;
  const rise = spring({ frame: frame - start, fps, config: { damping: 200 } });
  const strike = interpolate(
    frame,
    [start + STRIKE_AFTER, start + STRIKE_AFTER + STRIKE_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) },
  );
  return (
    <div
      style={{
        flex: 1,
        padding: "48px 44px",
        borderRadius: 24,
        background: "rgb(255 255 255 / 4%)",
        border: "1.5px solid rgb(255 255 255 / 9%)",
        opacity: rise,
        transform: `translateY(${interpolate(rise, [0, 1], [40, 0])}px)`,
      }}
    >
      <svg
        width={88}
        height={88}
        viewBox="0 0 32 32"
        fill="none"
        stroke={PAPER}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icon}
        <line
          x1={5}
          y1={5}
          x2={27}
          y2={27}
          stroke={CYAN}
          strokeWidth={2.5}
          strokeDasharray={STRIKE}
          strokeDashoffset={STRIKE * (1 - strike)}
        />
      </svg>
      <div style={{ marginTop: 36, fontSize: 40, fontWeight: 650, letterSpacing: "-0.01em" }}>
        {label}
      </div>
      <div style={{ marginTop: 14, fontSize: 26, lineHeight: 1.5, opacity: 0.7 }}>{text}</div>
    </div>
  );
};

/** What the extension does not need and does not take, one card at a time. */
export const Private: FC = () => (
  <Exit>
    <AbsoluteFill style={{ display: "flex", flexDirection: "column" }}>
      <CaptionHeader caption={CAPTION} />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 48,
          padding: "44px 96px 96px",
        }}
      >
        {POINTS.map((point, order) => (
          <Point key={point.label} {...point} order={order} />
        ))}
      </div>
    </AbsoluteFill>
  </Exit>
);

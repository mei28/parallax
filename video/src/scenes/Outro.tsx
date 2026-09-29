import type { FC } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Lockup } from "../components/Lockup";
import { CYAN } from "../theme";

const TAGLINE = "Read a page and its translation, side by side.";
/** What it costs and where it runs: the README's requirements, in one line. */
const TERMS = "Free · Chrome 138 or later, on desktop";

/** Rises into place from a little below, on its own spring. */
const useRise = (at: number): { opacity: number; transform: string } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - at, fps, config: { damping: 200 } });
  return { opacity: rise, transform: `translateY(${interpolate(rise, [0, 1], [24, 0])}px)` };
};

/**
 * The mark assembles again, as it did at the start, and the video ends on it with what
 * parallax is and what it takes to use. It does not leave: the last frame is the one that
 * stays on screen when the video stops.
 */
export const Outro: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrive = spring({ frame, fps, config: { damping: 200 } });
  const drop = spring({ frame: frame - 10, fps, config: { damping: 9, mass: 0.7 } });
  const open = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const tagline = useRise(40);
  const terms = useRise(52);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Lockup arrive={arrive} drop={drop} open={open} />
      <div
        style={{
          marginTop: 44,
          fontSize: 40,
          opacity: 0.8 * tagline.opacity,
          transform: tagline.transform,
        }}
      >
        {TAGLINE}
      </div>
      <div
        style={{
          marginTop: 36,
          padding: "14px 32px",
          borderRadius: 999,
          border: `2px solid ${CYAN}66`,
          background: `${CYAN}1a`,
          color: CYAN,
          fontSize: 30,
          fontWeight: 600,
          ...terms,
        }}
      >
        {TERMS}
      </div>
    </AbsoluteFill>
  );
};

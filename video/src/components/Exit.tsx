import type { CSSProperties, FC, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** How many frames a scene takes to leave. */
const EXIT_FRAMES = 12;

/**
 * The style that lifts and fades an element out over the last frames of the enclosing
 * sequence. A hook rather than only a wrapper, so a scene can send part of itself away and
 * leave the rest on stage for the next scene to pick up.
 */
export const useExitStyle = (): CSSProperties => {
  const frame = useCurrentFrame();
  // Inside a <Series.Sequence> this is the sequence's own length, not the whole video's.
  const { durationInFrames } = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - EXIT_FRAMES, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  return {
    opacity: 1 - out,
    transform: `translateY(${-32 * out}px)`,
    filter: `blur(${10 * out}px)`,
  };
};

/** Sends everything inside it away at the end of the enclosing sequence. */
export const Exit: FC<{ children: ReactNode }> = ({ children }) => (
  <AbsoluteFill style={useExitStyle()}>{children}</AbsoluteFill>
);

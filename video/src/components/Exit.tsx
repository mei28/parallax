import type { FC, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** How many frames a scene takes to leave. */
const EXIT_FRAMES = 12;

/**
 * Lifts and fades its children out over the last frames of the enclosing sequence, so each
 * scene clears the stage before the next arrives instead of being cut off mid-motion.
 */
export const Exit: FC<{ children: ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  // Inside a <Series.Sequence> this is the sequence's own length, not the whole video's.
  const { durationInFrames } = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - EXIT_FRAMES, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - out,
        transform: `translateY(${-32 * out}px)`,
        filter: `blur(${10 * out}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

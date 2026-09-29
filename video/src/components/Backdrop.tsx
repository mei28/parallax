import type { FC, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CYAN, FIELD, FONT, INK, PAPER } from "../theme";

/**
 * The dark field of the listing images, scaled from 1280 to 1920 wide. Quiet on purpose, so
 * whatever sits on it is the brightest thing in frame.
 */
export const Backdrop: FC<{ children: ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // The two glows drift toward each other over the whole video. Slow enough not to be seen
  // moving, but it keeps the field from reading as a still image behind the scenes.
  const drift = interpolate(frame, [0, durationInFrames], [0, 10]);
  return (
    <AbsoluteFill style={{ background: FIELD, color: PAPER, fontFamily: FONT }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(1350px 750px at ${12 + drift}% -10%, ${INK}55, transparent 60%)`,
            `radial-gradient(1050px 675px at ${105 - drift}% 110%, ${CYAN}33, transparent 60%)`,
          ].join(", "),
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

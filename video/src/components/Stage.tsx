import type { FC, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type Caption, CaptionHeader } from "./CaptionHeader";
import { useExitStyle } from "./Exit";

type StageProps = {
  caption: Caption;
  /**
   * Whether the window rises into frame. A scene continuing from one that already brought
   * the window up passes false, and the cut between them changes only the caption.
   */
  windowEnters: boolean;
  /** Whether the window sinks back out of frame at the end, for the last scene to use it. */
  windowExits: boolean;
  children: ReactNode;
};

/** How many frames the window takes to sink out of frame. */
const WINDOW_EXIT_FRAMES = 18;

/**
 * The listing images' layout: a caption, with a browser window under it. The caption
 * leaves at the end of the scene; the window stays unless told to go, so the next scene
 * can carry on from where this one left it.
 */
export const Stage: FC<StageProps> = ({ caption, windowEnters, windowExits, children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const exit = useExitStyle();
  const windowIn = windowEnters ? spring({ frame: frame - 4, fps, config: { damping: 200 } }) : 1;
  // Back the way it came in.
  const windowOut = windowExits
    ? interpolate(frame, [durationInFrames - WINDOW_EXIT_FRAMES, durationInFrames - 1], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic),
      })
    : 0;
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column" }}>
      <CaptionHeader caption={caption} style={exit} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "44px 96px 0",
          transform: `translateY(${900 * (1 - windowIn + windowOut)}px)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

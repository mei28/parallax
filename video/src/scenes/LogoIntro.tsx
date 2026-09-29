import { measureText } from "@remotion/layout-utils";
import type { FC } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Mark } from "../components/Mark";
import { FONT } from "../theme";

const MARK_SIZE = 168;
const GAP = 40;
const NAME = {
  text: "parallax",
  fontFamily: FONT,
  fontSize: 112,
  fontWeight: "650",
  letterSpacing: "-0.02em",
} as const;

// Measured rather than laid out, because the name's box grows from zero width: the flex row
// stays centred while it does, so the mark starts in the middle of the frame and is pushed
// aside by the name instead of waiting off-centre for it. Throws if the font is missing
// rather than measuring a fallback.
const NAME_WIDTH = measureText({ ...NAME, validateFontIsLoaded: true }).width;

/** The icon assembles, its right pane drops into place, and the name opens out beside it. */
export const LogoIntro: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Both panes arrive together and level: a plain split view.
  const arrive = spring({ frame, fps, config: { damping: 200 } });
  // Then the translated pane drops to its offset, the displacement the name refers to. Low
  // damping lets it overshoot and settle.
  const drop = spring({ frame: frame - 16, fps, config: { damping: 9, mass: 0.7 } });
  // The name follows once the mark has landed.
  const open = spring({ frame: frame - 34, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            opacity: arrive,
            transform: `translateY(${interpolate(arrive, [0, 1], [60, 0])}px)`,
          }}
        >
          <Mark size={MARK_SIZE} drop={drop} />
        </div>
        <div
          style={{
            width: open * (GAP + NAME_WIDTH),
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              ...NAME,
              paddingLeft: GAP,
              opacity: open,
              transform: `translateX(${interpolate(open, [0, 1], [-24, 0])}px)`,
            }}
          >
            {NAME.text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

import { measureText } from "@remotion/layout-utils";
import type { FC } from "react";
import { interpolate } from "remotion";
import { FONT } from "../theme";
import { Mark } from "./Mark";

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

type LockupProps = {
  /** The mark rising into place, 0 to 1. */
  arrive: number;
  /** The mark's right pane dropping to its offset, 0 to 1 (a spring may overshoot). */
  drop: number;
  /** The name opening out beside the mark, 0 to 1. */
  open: number;
};

/** The mark and the name side by side, each part at whatever stage of arriving it is given. */
export const Lockup: FC<LockupProps> = ({ arrive, drop, open }) => (
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
);

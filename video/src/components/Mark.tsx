import type { CSSProperties, FC } from "react";
import { CYAN, INK } from "../theme";

// The geometry of store-assets/build_icons.py, as fractions of the edge, so this is the
// toolbar icon at any size.
const PADDING = 0.09;
const GAP = 0.1;
const RADIUS = 0.12;
const DISPLACEMENT = 0.09;

const PANE_WIDTH = 0.5 - GAP / 2 - PADDING;
const PANE_HEIGHT = 1 - 2 * PADDING - DISPLACEMENT;

type MarkProps = {
  /** Edge length in pixels. */
  size: number;
  /** How far the right pane has dropped: 0 is level with the left, 1 is the icon's offset. */
  drop: number;
};

/** The parallax icon, drawn as two boxes rather than an image so each pane can move. */
export const Mark: FC<MarkProps> = ({ size, drop }) => {
  const pane: CSSProperties = {
    position: "absolute",
    top: PADDING * size,
    width: PANE_WIDTH * size,
    height: PANE_HEIGHT * size,
    borderRadius: RADIUS * size,
  };
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div style={{ ...pane, left: PADDING * size, background: INK }} />
      <div
        style={{
          ...pane,
          left: (0.5 + GAP / 2) * size,
          background: CYAN,
          transform: `translateY(${drop * DISPLACEMENT * size}px)`,
        }}
      />
    </div>
  );
};

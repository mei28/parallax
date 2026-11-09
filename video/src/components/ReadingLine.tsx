import type { FC } from "react";
import { ANCHOR_LINE_FRACTION } from "../../../src/shared/constants.ts";
import { CYAN } from "../theme";

/**
 * The line the panes are matched at, drawn across both: a fifth of the way down, the same
 * constant the extension reads. Place it over the panes, inside the window.
 */
export const ReadingLine: FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: `${ANCHOR_LINE_FRACTION * 100}%`,
      borderTop: `3px dashed ${CYAN}`,
      opacity,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 21,
        top: -17,
        padding: "3px 13.5px",
        borderRadius: 999,
        border: `1.5px solid ${CYAN}66`,
        background: "#eafcff",
        color: "#0e7490",
        fontSize: 15.75,
        fontWeight: 640,
        letterSpacing: "0.04em",
      }}
    >
      reading line
    </div>
  </div>
);

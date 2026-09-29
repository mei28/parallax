import type { FC } from "react";
import { CYAN } from "../theme";

type PointerProps = {
  opacity: number;
  /** How far the button is held down, 0 to 1: a ring grows around the tip while it is. */
  pressed: number;
};

/** A mouse pointer with its tip at its parent's origin. */
export const Pointer: FC<PointerProps> = ({ opacity, pressed }) => (
  <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
    <div
      style={{
        position: "absolute",
        left: -27,
        top: -27,
        width: 54,
        height: 54,
        borderRadius: "50%",
        background: `${CYAN}33`,
        border: `2.5px solid ${CYAN}`,
        transform: `scale(${pressed})`,
      }}
    />
    <svg
      width={27}
      height={42}
      viewBox="0 0 18 28"
      style={{ position: "absolute", left: -1.5, top: -1.5, overflow: "visible" }}
      aria-hidden="true"
    >
      <path
        d="M1 1 L1 22 L6 17 L9.5 25 L13 23.5 L9.5 15.5 L16 15.5 Z"
        fill="#111"
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

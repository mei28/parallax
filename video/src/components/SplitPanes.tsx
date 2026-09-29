import type { CSSProperties, FC, ReactNode } from "react";

const HANDLE = 13.5;
const GRIP_DOTS = [10.5, 18, 25.5]
  .flatMap((y) =>
    [5.25, 12.75].map(
      (x) => `radial-gradient(circle 1.5px at ${x}px ${y}px, #8a8a94 99%, transparent 100%)`,
    ),
  )
  .join(", ");

/**
 * A box inside the window's content area: the fraction of it along each axis, and a pixel
 * adjustment on top for the handle's thickness. calc() of the two, rather than a grid,
 * because a grid cannot move its tracks from columns to rows.
 */
type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

const place = (box: Box): CSSProperties => ({
  position: "absolute",
  left: `calc(${box.x * 100}% + ${box.dx}px)`,
  top: `calc(${box.y * 100}% + ${box.dy}px)`,
  width: `calc(${box.w * 100}% + ${box.dw}px)`,
  height: `calc(${box.h * 100}% + ${box.dh}px)`,
});

/**
 * Where the original, the handle and the translation sit, split along one axis. The panes
 * share what the handle leaves, `share` and `1 - share` of it, as grid tracks would.
 */
const boxes = (share: number, handle: number, stacked: boolean) => {
  const along = (start: number, size: number, offset: number, extent: number): Box =>
    stacked
      ? { x: 0, y: start, w: 1, h: size, dx: 0, dy: offset, dw: 0, dh: extent }
      : { x: start, y: 0, w: size, h: 1, dx: offset, dy: 0, dw: extent, dh: 0 };
  return {
    original: along(0, share, 0, -share * handle),
    handle: along(share, 0, -share * handle, handle),
    translation: along(share, 1 - share, (1 - share) * handle, -(1 - share) * handle),
  };
};

/** The divider between the panes, with the grip that says it can be dragged. */
const Handle: FC<{ style: CSSProperties; stacked: boolean; children?: ReactNode }> = ({
  style,
  stacked,
  children,
}) => (
  // Above both panes, so whatever rides on the handle is not covered by the one after it.
  <div style={{ ...style, zIndex: 1, background: "#e2e2e6" }}>
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) rotate(${stacked ? 90 : 0}deg)`,
        width: 18,
        height: 36,
        borderRadius: 4.5,
        border: "1.5px solid #c6c6cc",
        backgroundColor: "#fff",
        backgroundImage: GRIP_DOTS,
      }}
    />
    <div style={{ position: "absolute", top: "50%", left: "50%" }}>{children}</div>
  </div>
);

type SplitPanesProps = {
  /** The original pane's share of the space once split, from 0 to 1. */
  ratio: number;
  /** How far the split has opened: 0 is the page on its own, 1 is split at `ratio`. */
  open: number;
  /** Top and bottom, original on top, rather than side by side. */
  stacked: boolean;
  original: ReactNode;
  translation: ReactNode;
  /** Drawn at the centre of the handle and moved with it, for a pointer dragging it. */
  onHandle?: ReactNode;
};

/** The page divided in two, the original first. */
export const SplitPanes: FC<SplitPanesProps> = ({
  ratio,
  open,
  stacked,
  original,
  translation,
  onHandle,
}) => {
  const share = 1 - open * (1 - ratio);
  const handle = HANDLE * open;
  const box = boxes(share, handle, stacked);
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={place(box.original)}>{original}</div>
      <Handle style={place(box.handle)} stacked={stacked}>
        {onHandle}
      </Handle>
      <div style={place(box.translation)}>{translation}</div>
    </div>
  );
};

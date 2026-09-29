import type { FC, ReactNode } from "react";

const HANDLE = 13.5;
const GRIP_DOTS = [10.5, 18, 25.5]
  .flatMap((y) =>
    [5.25, 12.75].map(
      (x) => `radial-gradient(circle 1.5px at ${x}px ${y}px, #8a8a94 99%, transparent 100%)`,
    ),
  )
  .join(", ");

/** The divider between the panes, with the grip that says it can be dragged. */
const Handle: FC = () => (
  <div style={{ position: "relative", background: "#e2e2e6" }}>
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 18,
        height: 36,
        borderRadius: 4.5,
        border: "1.5px solid #c6c6cc",
        backgroundColor: "#fff",
        backgroundImage: GRIP_DOTS,
      }}
    />
  </div>
);

type SplitPanesProps = {
  /** The original pane's share of the width once split, from 0 to 1. */
  ratio: number;
  /** How far the split has opened: 0 is the page on its own, 1 is split at `ratio`. */
  open: number;
  original: ReactNode;
  translation: ReactNode;
};

/** The page divided in two, left and right, the original on the left. */
export const SplitPanes: FC<SplitPanesProps> = ({ ratio, open, original, translation }) => {
  const share = 1 - open * (1 - ratio);
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        // minmax(0, …) so a pane can be narrower than its text; a bare fr would refuse to
        // shrink below the longest line and the split could not open from the edge.
        gridTemplateColumns: `minmax(0, ${share}fr) ${HANDLE * open}px minmax(0, ${1 - share}fr)`,
      }}
    >
      {original}
      <Handle />
      {translation}
    </div>
  );
};

import type { FC } from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Exit } from "../components/Exit";
import { Lockup } from "../components/Lockup";

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
    <Exit>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Lockup arrive={arrive} drop={drop} open={open} />
      </AbsoluteFill>
    </Exit>
  );
};

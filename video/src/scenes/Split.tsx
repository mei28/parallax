import type { FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrowserWindow } from "../components/BrowserWindow";
import { Pane, type Translation } from "../components/Pane";
import { SplitPanes } from "../components/SplitPanes";
import { type Caption, Stage } from "../components/Stage";

const CAPTION: Caption = {
  title: "Split the page, translate one side",
  accent: "translate",
  sub: "What is on screen is translated first, so the wait is the length of one screen.",
};

// The beats of the scene, in its own frames.
/** The divider slides in from the right edge. */
const SPLIT_AT = 30;
const SPLIT_FRAMES = 24;
/** The new pane is a second load of the same page, which arrives once the pane is open. */
const LOAD_AT = SPLIT_AT + SPLIT_FRAMES;
const LOAD_FRAMES = 10;
/** Then its blocks turn one by one. */
const TRANSLATION: Translation = { start: LOAD_AT + LOAD_FRAMES + 8, stagger: 8 };

/** The page splits in two, and the right-hand copy is translated in place, block by block. */
export const Split: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = spring({
    frame: frame - SPLIT_AT,
    fps,
    config: { damping: 200 },
    durationInFrames: SPLIT_FRAMES,
  });
  const loaded = interpolate(frame, [LOAD_AT, LOAD_AT + LOAD_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Stage caption={CAPTION} windowEnters windowExits={false}>
      <BrowserWindow>
        <SplitPanes
          ratio={0.5}
          open={open}
          stacked={false}
          original={<Pane translation="none" loaded={1} scroll={0} mark={null} />}
          translation={<Pane translation={TRANSLATION} loaded={loaded} scroll={0} mark={null} />}
        />
      </BrowserWindow>
    </Stage>
  );
};

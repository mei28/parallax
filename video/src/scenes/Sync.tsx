import type { FC } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BrowserWindow } from "../components/BrowserWindow";
import { Pane } from "../components/Pane";
import { ReadingLine } from "../components/ReadingLine";
import { SplitPanes } from "../components/SplitPanes";
import { type Caption, Stage } from "../components/Stage";
import { usePaneLayouts } from "../components/usePaneLayouts";
import { scrollsFor } from "../sync";

const CAPTION: Caption = {
  title: "Aligned by content, not by percentage",
  accent: "content",
  sub: "A translated paragraph rarely keeps its height, so the panes are matched block by block.",
};

// The beats of the scene, in its own frames.
/** The reading line and the mark on the block under it come up. */
const REVEAL_AT = 8;
const REVEAL_FRAMES = 14;
/** The reader scrolls the original: down, a pause to read, then on to the end. */
const READ = { frames: [30, 95, 115, 180], share: [0, 0.45, 0.45, 1] };

/**
 * The reader scrolls the original and the translation follows, block for block, by the
 * extension's own anchor math. The window carries on from the split scene without a cut.
 */
export const Sync: FC = () => {
  const frame = useCurrentFrame();
  const layouts = usePaneLayouts();
  const reveal = interpolate(frame, [REVEAL_AT, REVEAL_AT + REVEAL_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const read = interpolate(frame, READ.frames, READ.share, {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const aligned = scrollsFor(layouts.original, layouts.translation, read);
  // Even unscrolled, putting the anchor block on the reading line moves the translation a few
  // pixels. The split scene left it at the top, so it settles into place as the line comes
  // up rather than jumping at the cut.
  const scrolls = { ...aligned, translation: aligned.translation * reveal };
  const mark = { id: scrolls.anchor, strength: reveal };

  return (
    <Stage caption={CAPTION} windowEnters={false} windowExits={false}>
      <BrowserWindow>
        <SplitPanes
          ratio={0.5}
          open={1}
          stacked={false}
          original={
            <Pane
              translation="none"
              loaded={1}
              scroll={scrolls.original}
              mark={mark}
              onLayout={layouts.onOriginal}
            />
          }
          translation={
            <Pane
              translation="done"
              loaded={1}
              scroll={scrolls.translation}
              mark={mark}
              onLayout={layouts.onTranslation}
            />
          }
        />
        <ReadingLine opacity={reveal} />
      </BrowserWindow>
    </Stage>
  );
};

import type { FC } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BrowserWindow } from "../components/BrowserWindow";
import { Pane } from "../components/Pane";
import { Pointer } from "../components/Pointer";
import { ReadingLine } from "../components/ReadingLine";
import { SplitPanes } from "../components/SplitPanes";
import { type Caption, Stage } from "../components/Stage";
import { usePaneLayouts } from "../components/usePaneLayouts";
import { scrollsFor } from "../sync";

const CAPTION: Caption = {
  title: "Drag the split anywhere",
  accent: "anywhere",
  sub: "Left and right or top and bottom, at any ratio.",
};

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The beats of the scene, in its own frames.
/** The reading line and the marks, carried over from the sync scene, fade out. */
const FADE_FRAMES = 12;
/** The pointer arrives on the handle, presses, drags, lets go and leaves. */
const POINTER = { frames: [14, 24, 102, 112], opacity: [0, 1, 1, 0] };
const PRESS = { frames: [22, 28, 98, 104], pressed: [0, 1, 1, 0] };
/** The drag: wider, narrower, and back to even, with a beat at each end. */
const DRAG = { frames: [28, 50, 56, 78, 84, 98], ratio: [0.5, 0.68, 0.68, 0.36, 0.36, 0.5] };
/** Then the split turns: the translation closes to the right and opens again from below. */
const CLOSE_AT = 106;
const CLOSE_FRAMES = 14;
const REOPEN_AT = 124;
const REOPEN_FRAMES = 18;

/**
 * The divider is dragged one way and the other, and then the split turns to top and bottom.
 * The panes stay matched throughout: the text rewraps on every frame of the drag, and the
 * translation is scrolled to the original's reading position again from the new layout.
 */
export const Adjust: FC = () => {
  const frame = useCurrentFrame();
  const layouts = usePaneLayouts();
  const fade = interpolate(frame, [0, FADE_FRAMES], [1, 0], CLAMP);
  const ratio = interpolate(frame, DRAG.frames, DRAG.ratio, {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
  const close = interpolate(frame, [CLOSE_AT, CLOSE_AT + CLOSE_FRAMES], [0, 1], {
    ...CLAMP,
    easing: Easing.in(Easing.cubic),
  });
  const reopen = interpolate(frame, [REOPEN_AT, REOPEN_AT + REOPEN_FRAMES], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const stacked = frame >= REOPEN_AT;
  // Closing narrows the translation, and its text would rewrap a word to a line; it fades
  // before that shows. Opening from below changes only its height, so it can arrive whole.
  const loaded = stacked ? 1 : interpolate(close, [0, 0.35], [1, 0], CLAMP);
  // The reader stays where the sync scene left them: at the end of the article.
  const scrolls = scrollsFor(layouts.original, layouts.translation, 1);
  const mark = { id: scrolls.anchor, strength: fade };

  return (
    <Stage caption={CAPTION} windowEnters={false} windowExits>
      <BrowserWindow>
        <SplitPanes
          ratio={ratio}
          open={stacked ? reopen : 1 - close}
          stacked={stacked}
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
              loaded={loaded}
              scroll={scrolls.translation}
              mark={mark}
              onLayout={layouts.onTranslation}
            />
          }
          onHandle={
            <Pointer
              opacity={interpolate(frame, POINTER.frames, POINTER.opacity, CLAMP)}
              pressed={interpolate(frame, PRESS.frames, PRESS.pressed, CLAMP)}
            />
          }
        />
        <ReadingLine opacity={fade} />
      </BrowserWindow>
    </Stage>
  );
};

import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import type { PaneLayout } from "./Pane";

/** A pane measured before the frame had its size reports no height; wait for the real one. */
const isLaidOut = (layout: PaneLayout | null): layout is PaneLayout =>
  layout !== null && layout.viewport > 0;

/**
 * Collects the layouts both panes report once mounted, and holds the render until they have.
 *
 * Where a block sits depends on how its text wraps, which only the browser knows, so a scene
 * that scrolls by blocks has to draw the panes once, measure them, and draw again. The first
 * draw must not be captured as a frame; delayRender keeps Remotion from taking it.
 */
export const usePaneLayouts = () => {
  const [handle] = useState(() => delayRender("Measuring where the blocks sit in both panes"));
  const [original, setOriginal] = useState<PaneLayout | null>(null);
  const [translation, setTranslation] = useState<PaneLayout | null>(null);
  useEffect(() => {
    if (isLaidOut(original) && isLaidOut(translation)) {
      continueRender(handle);
    }
  }, [original, translation, handle]);
  return { original, translation, onOriginal: setOriginal, onTranslation: setTranslation };
};

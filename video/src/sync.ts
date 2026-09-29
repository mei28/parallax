// The extension's own anchor math, imported rather than reimplemented, so the panes in the
// video follow each other exactly as they do in the browser.
import { ANCHOR_LINE_FRACTION } from "../../src/shared/constants.ts";
import { pickAnchor, projectScrollTop } from "../../src/shared/scroll.ts";
import type { PaneLayout } from "./components/Pane";

export type Scrolls = {
  original: number;
  translation: number;
  /** The block under the reading line, the one the two panes are matched on. */
  anchor: number;
};

/**
 * Where the translation scrolls to when the reader has scrolled the original a given share
 * of the way down.
 *
 * @throws if the original is too short to scroll, which would make the scene show nothing.
 */
export const follow = (original: PaneLayout, translation: PaneLayout, read: number): Scrolls => {
  if (original.maxScroll <= 0) {
    throw new Error("The article fits in the pane, so there is nothing to scroll through");
  }
  const scrolled = read * original.maxScroll;
  const pick = pickAnchor(original.samples, scrolled + original.viewport * ANCHOR_LINE_FRACTION);
  const match = translation.samples.find((sample) => sample.id === pick.id);
  if (match === undefined) {
    throw new Error(`Block ${pick.id} has no counterpart in the translation`);
  }
  return {
    original: scrolled,
    translation: projectScrollTop(
      pick,
      match,
      translation.viewport * ANCHOR_LINE_FRACTION,
      translation.maxScroll,
    ),
    anchor: pick.id,
  };
};

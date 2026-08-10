// Shared vocabulary. Types only — no behaviour, no DOM, no chrome APIs.

/** How the two panes are stacked. `horizontal` puts them left and right. */
export type Orientation = "horizontal" | "vertical";

/** `source` shows the page as published; `target` shows it translated. */
export type PaneId = "source" | "target";

/**
 * `single-target` is what collapsing the source pane leaves behind. There is no
 * `single-source`: collapsing the translated pane ends the split, because the original is
 * already underneath with its state intact, whereas the translation exists nowhere else.
 */
export type SplitMode = "split" | "single-target" | "error";

export type ToolbarStatus = "idle" | "downloading" | "translating" | "ready" | "error";

/**
 * A message named rather than written out: the chrome.i18n catalogue key, plus the values
 * to substitute into it. Pure code produces these; src/chrome/i18n.ts turns them into text.
 */
export interface MessageDescriptor {
  readonly key: string;
  readonly substitutions: readonly string[];
}

export interface LanguagePair {
  readonly source: string;
  readonly target: string;
}

export interface Preferences {
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly orientation: Orientation;
  /** Fraction of the split axis given to the source pane, 0..1. */
  readonly ratio: number;
}

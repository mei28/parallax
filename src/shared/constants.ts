// One namespace for everything parallax puts into a page, so a split view can always be
// told apart from the site's own markup and removed completely.
import type { Preferences } from "./types.ts";

export const ATTR_HOST = "data-parallax-host";
export const ATTR_DIALOG = "data-parallax-dialog";
export const ATTR_CONTAINER = "data-parallax-container";
export const ATTR_PANE = "data-parallax-pane";
export const ATTR_FRAME = "data-parallax-frame";
export const ATTR_HANDLE = "data-parallax-handle";
export const ATTR_GRIP = "data-parallax-grip";
export const ATTR_ORIENTATION = "data-parallax-orientation";
export const ATTR_MODE = "data-parallax-mode";
export const ATTR_DRAGGING = "data-parallax-dragging";
export const ATTR_COLLAPSING = "data-parallax-collapsing";
export const ATTR_TOOLBAR = "data-parallax-toolbar";
export const ATTR_MESSAGE = "data-parallax-message";
export const ATTR_PROGRESS = "data-parallax-progress";
export const ATTR_CARD = "data-parallax-card";
export const ATTR_STATUS = "data-parallax-status";

/** Marks corresponding blocks in the two panes. The value is an index, not a DOM id. */
export const ATTR_PAIR_ID = "data-parallax-id";

export const CSS_VAR_RATIO = "--parallax-ratio";
export const CSS_VAR_HANDLE = "--parallax-handle";
export const CSS_VAR_PROGRESS = "--parallax-progress";

export const HANDLE_SIZE_PX = 8;
export const COLLAPSE_THRESHOLD_PX = 120;
export const FRAME_LOAD_TIMEOUT_MS = 10_000;

/** The region above the first real block, which is an anchor in both panes. */
export const ROOT_ANCHOR_ID = -1;

/**
 * Where in the viewport the reading line sits, as a fraction of its height.
 *
 * Anchoring at the very top edge would pick a block the reader has already finished,
 * because it is the one straddling the edge. A fifth of the way down is a block they are
 * actually looking at.
 */
export const ANCHOR_LINE_FRACTION = 0.2;

export const SAMPLE_DEBOUNCE_MS = 100;

/**
 * Languages offered in the popup, labelled in their own script.
 *
 * Chrome's built-in translator supports more pairs than this, but availability() is the only
 * authority on any given pair — the list is what to offer, not a promise about what will
 * work. An unsupported pair is reported as TRANSLATION_UNAVAILABLE before anything is built.
 */
export const LANGUAGES: readonly { readonly code: string; readonly label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "bn", label: "বাংলা" },
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "hi", label: "हिन्दी" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "th", label: "ไทย" },
  { code: "tr", label: "Türkçe" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "zh-Hant", label: "繁體中文" },
];

export const DEFAULT_PREFERENCES: Preferences = {
  sourceLanguage: "en",
  targetLanguage: "ja",
  orientation: "horizontal",
  ratio: 0.5,
};

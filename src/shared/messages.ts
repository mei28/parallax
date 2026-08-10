// The messages that cross between the popup, the service worker and the content script.
import type { Preferences } from "./types.ts";

export type Message =
  | { readonly type: "START_SPLIT"; readonly preferences: Preferences }
  | { readonly type: "STOP_SPLIT" }
  | { readonly type: "TOGGLE_SPLIT"; readonly preferences: Preferences }
  | { readonly type: "TOGGLE_ORIENTATION" }
  | { readonly type: "GET_STATE" };

export interface StateResponse {
  readonly active: boolean;
  /** Present when the last request failed; already rendered for display. */
  readonly error?: string;
}

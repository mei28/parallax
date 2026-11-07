// The messages that cross between the popup, the service worker and the content script.
import type { ArmResult } from "../chrome/framing.ts";
import type { ParallaxFailure } from "./errors.ts";
import type { SarashinaOutcome } from "./sarashina.ts";
import type { LanguagePair, Preferences } from "./types.ts";

export type Message =
  | { readonly type: "START_SPLIT"; readonly preferences: Preferences }
  | { readonly type: "STOP_SPLIT" }
  | { readonly type: "TOGGLE_SPLIT"; readonly preferences: Preferences }
  | { readonly type: "TOGGLE_ORIENTATION" }
  | { readonly type: "RETRANSLATE" }
  | { readonly type: "GET_STATE" };

/**
 * Content script to service worker. declarativeNetRequest is not reachable from a content
 * script, and the tab id these are scoped to comes from the sender rather than the message,
 * so a page cannot ask for another tab's rules.
 */
export type FramingMessage =
  | { readonly type: "ARM_FRAMING"; readonly url: string }
  | { readonly type: "DISARM_FRAMING" }
  | { readonly type: "DIAGNOSE_FRAMING"; readonly url: string };

export interface StateResponse {
  readonly active: boolean;
  /** Present when the last request failed; already rendered for display. */
  readonly error?: string;
  /**
   * Origin whose framing rules refused the last attempt. The popup uses it to offer an
   * override, which only it can ask for: permissions.request needs an extension page.
   */
  readonly blockedOrigin?: string;
}

export type FramingResponse = ArmResult;

/** Which header refused the embed, or null when it could not be determined. */
export interface DiagnoseResponse {
  readonly refusal: string | null;
}

/**
 * Content script to service worker. The worker holds the API key and makes the request, so
 * the key never enters the page's renderer, and the fetch is made from the extension's
 * origin, where the host permission lets it past CORS.
 */
export type SarashinaMessage =
  | { readonly type: "SARASHINA_READY" }
  | { readonly type: "SARASHINA_TRANSLATE"; readonly pair: LanguagePair; readonly text: string };

/** Whether a key is set and the host may be reached; the failure to show when not. */
export interface SarashinaReadyResponse {
  readonly failure: ParallaxFailure | null;
}

export type SarashinaTranslateResponse = SarashinaOutcome;

// The closed set of ways parallax can fail, and how each one names its message.
//
// Nothing here degrades quietly. Every branch the extension cannot take ends in one of
// these codes, and every code resolves to copy, so a failure is always something the reader
// can see and act on rather than a split that mysteriously does nothing.
//
// This module stays pure, so it does not call chrome.i18n. It returns a descriptor — the
// catalogue key plus its substitutions — which src/chrome/i18n.ts renders.
import type { LanguagePair, MessageDescriptor } from "./types.ts";

export type ParallaxFailure =
  // Cannot start
  | { readonly code: "UNSUPPORTED_PAGE"; readonly detail: { readonly scheme: string } }
  | { readonly code: "INJECTION_FAILED"; readonly detail: { readonly reason: string } }
  | { readonly code: "WINDOW_TOO_SMALL"; readonly detail: { readonly required: number } }
  // Translation
  | { readonly code: "TRANSLATOR_API_MISSING" }
  | { readonly code: "TRANSLATION_UNAVAILABLE"; readonly detail: LanguagePair }
  | { readonly code: "SAME_LANGUAGE"; readonly detail: { readonly language: string } }
  | { readonly code: "LOW_CONFIDENCE" }
  | { readonly code: "ACTIVATION_REQUIRED" }
  | { readonly code: "DOWNLOAD_FAILED"; readonly detail: { readonly reason: string } }
  | {
      readonly code: "TRANSLATE_FAILED";
      readonly detail: { readonly done: number; readonly total: number; readonly reason: string };
    }
  // Embedding
  | { readonly code: "FRAME_BLOCKED" }
  | { readonly code: "FRAME_LOAD_TIMEOUT"; readonly detail: { readonly seconds: number } }
  | { readonly code: "FRAME_BUSTED" }
  // Scroll sync only. The split survives these.
  | { readonly code: "DOM_MISMATCH" }
  | { readonly code: "NO_ANCHORS" };

export type ParallaxErrorCode = ParallaxFailure["code"];

/** Every code, so the locale catalogues can be checked for completeness. */
export const ALL_FAILURE_CODES: readonly ParallaxErrorCode[] = [
  "UNSUPPORTED_PAGE",
  "INJECTION_FAILED",
  "WINDOW_TOO_SMALL",
  "TRANSLATOR_API_MISSING",
  "TRANSLATION_UNAVAILABLE",
  "SAME_LANGUAGE",
  "LOW_CONFIDENCE",
  "ACTIVATION_REQUIRED",
  "DOWNLOAD_FAILED",
  "TRANSLATE_FAILED",
  "FRAME_BLOCKED",
  "FRAME_LOAD_TIMEOUT",
  "FRAME_BUSTED",
  "DOM_MISMATCH",
  "NO_ANCHORS",
];

/** Catalogue key for a failure code, e.g. FRAME_BLOCKED -> error_frame_blocked. */
export function messageKey(code: ParallaxErrorCode): string {
  return `error_${code.toLowerCase()}`;
}

/** Describe a failure as a catalogue key and the values to substitute into it. */
export function describeFailure(failure: ParallaxFailure): MessageDescriptor {
  return { key: messageKey(failure.code), substitutions: substitutionsFor(failure) };
}

function substitutionsFor(failure: ParallaxFailure): readonly string[] {
  switch (failure.code) {
    case "UNSUPPORTED_PAGE":
      return [failure.detail.scheme];
    case "INJECTION_FAILED":
      return [failure.detail.reason];
    case "WINDOW_TOO_SMALL":
      return [String(failure.detail.required)];
    case "TRANSLATION_UNAVAILABLE":
      return [failure.detail.source, failure.detail.target];
    case "SAME_LANGUAGE":
      return [failure.detail.language];
    case "DOWNLOAD_FAILED":
      return [failure.detail.reason];
    case "TRANSLATE_FAILED":
      return [String(failure.detail.done), String(failure.detail.total), failure.detail.reason];
    case "FRAME_LOAD_TIMEOUT":
      return [String(failure.detail.seconds)];
    case "TRANSLATOR_API_MISSING":
    case "LOW_CONFIDENCE":
    case "ACTIVATION_REQUIRED":
    case "FRAME_BLOCKED":
    case "FRAME_BUSTED":
    case "DOM_MISMATCH":
    case "NO_ANCHORS":
      return [];
  }
}

/**
 * A failure raised as an exception.
 *
 * `message` is for developers reading a stack trace; what the reader sees comes from
 * `failure` via the locale catalogue, never from here.
 */
export class ParallaxError extends Error {
  readonly code: ParallaxErrorCode;
  readonly failure: ParallaxFailure;

  constructor(failure: ParallaxFailure) {
    super(`${failure.code} ${JSON.stringify("detail" in failure ? failure.detail : {})}`);
    this.name = "ParallaxError";
    this.code = failure.code;
    this.failure = failure;
  }
}

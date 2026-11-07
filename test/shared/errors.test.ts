// Failure description tests.
//
// src/shared stays pure, so it cannot call chrome.i18n. Instead a failure becomes a message
// descriptor — a catalogue key plus its substitutions — and the impure layer renders it.
// That keeps the wording out of the logic, and lets the catalogue itself be checked here.
import { describe, expect, it } from "vitest";
import {
  ALL_FAILURE_CODES,
  describeFailure,
  messageKey,
  ParallaxError,
} from "../../src/shared/errors.ts";
import en from "../../static/_locales/en/messages.json";
import ja from "../../static/_locales/ja/messages.json";

describe("describeFailure", () => {
  it("maps a failure with no detail to a bare key", () => {
    expect(describeFailure({ code: "FRAME_BLOCKED" })).toEqual({
      key: "error_frame_blocked",
      substitutions: [],
    });
  });

  it("passes both languages as substitutions, in order", () => {
    expect(
      describeFailure({ code: "TRANSLATION_UNAVAILABLE", detail: { source: "en", target: "ja" } }),
    ).toEqual({ key: "error_translation_unavailable", substitutions: ["en", "ja"] });
  });

  it("renders numeric detail as strings, because getMessage takes strings", () => {
    expect(describeFailure({ code: "WINDOW_TOO_SMALL", detail: { required: 248 } })).toEqual({
      key: "error_window_too_small",
      substitutions: ["248"],
    });
  });

  it("reports how far translation got before it stopped", () => {
    expect(
      describeFailure({
        code: "TRANSLATE_FAILED",
        detail: { done: 128, total: 402, reason: "the model was unloaded" },
      }),
    ).toEqual({
      key: "error_translate_failed",
      substitutions: ["128", "402", "the model was unloaded"],
    });
  });
});

describe("describeFailure, for a remote translator", () => {
  it.each([
    [{ code: "API_KEY_MISSING" }, []],
    [{ code: "API_PERMISSION_MISSING" }, []],
    [{ code: "API_AUTH_FAILED" }, []],
    [{ code: "API_FORBIDDEN", detail: { message: "Forbidden" } }, ["Forbidden"]],
    [
      { code: "API_REQUEST_FAILED", detail: { status: 500, message: "Internal Server Error" } },
      ["500", "Internal Server Error"],
    ],
    [{ code: "API_TIMEOUT", detail: { seconds: 25 } }, ["25"]],
    [{ code: "API_UNREACHABLE", detail: { reason: "Failed to fetch" } }, ["Failed to fetch"]],
    [{ code: "BATCH_MISMATCH", detail: { expected: 12, actual: 11 } }, ["12", "11"]],
    [{ code: "TEXT_TOO_LONG", detail: { length: 5210, limit: 5000 } }, ["5210", "5000"]],
    [{ code: "PROVIDER_PAIR_UNSUPPORTED", detail: { source: "fr", target: "ja" } }, ["fr", "ja"]],
  ] as const)("describes %o with its detail in order", (failure, substitutions) => {
    expect(describeFailure(failure).substitutions).toEqual(substitutions);
  });
});

describe("ParallaxError", () => {
  it("carries its code and the failure it was built from", () => {
    const error = new ParallaxError({ code: "FRAME_BLOCKED" });
    expect(error.code).toBe("FRAME_BLOCKED");
    expect(error.failure).toEqual({ code: "FRAME_BLOCKED" });
  });

  it("is an Error, so it survives a throw", () => {
    expect(() => {
      throw new ParallaxError({ code: "NO_ANCHORS" });
    }).toThrow(ParallaxError);
  });
});

// A missing translation would surface as a blank error banner — the exact silent failure
// this codebase refuses elsewhere. These tests make the catalogues answer for themselves.
describe("locale catalogues", () => {
  const catalogues = { en, ja } as Record<string, Record<string, { placeholders?: object }>>;

  it("defines a message for every failure code, in every locale", () => {
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      for (const code of ALL_FAILURE_CODES) {
        expect(catalogue[messageKey(code)], `${locale} is missing ${code}`).toBeDefined();
      }
    }
  });

  // Not only failures: the panel's own wording lives here too, and chrome.i18n answers an
  // unknown key with an empty string rather than complaining.
  it("keeps the locales in step, with no key present in only one", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });

  it("uses the same placeholders in every locale", () => {
    for (const key of Object.keys(en)) {
      const enPlaceholders = Object.keys(catalogues.en?.[key]?.placeholders ?? {}).sort();
      const jaPlaceholders = Object.keys(catalogues.ja?.[key]?.placeholders ?? {}).sort();
      expect(jaPlaceholders, `placeholders differ for ${key}`).toEqual(enPlaceholders);
    }
  });

  it("supplies exactly as many substitutions as the catalogue declares placeholders", () => {
    const samples = {
      UNSUPPORTED_PAGE: { code: "UNSUPPORTED_PAGE", detail: { scheme: "chrome:" } },
      INJECTION_FAILED: { code: "INJECTION_FAILED", detail: { reason: "no access" } },
      WINDOW_TOO_SMALL: { code: "WINDOW_TOO_SMALL", detail: { required: 248 } },
      TRANSLATOR_API_MISSING: { code: "TRANSLATOR_API_MISSING" },
      TRANSLATION_UNAVAILABLE: {
        code: "TRANSLATION_UNAVAILABLE",
        detail: { source: "en", target: "ja" },
      },
      SAME_LANGUAGE: { code: "SAME_LANGUAGE", detail: { language: "ja" } },
      LOW_CONFIDENCE: { code: "LOW_CONFIDENCE" },
      ACTIVATION_REQUIRED: { code: "ACTIVATION_REQUIRED" },
      DOWNLOAD_FAILED: { code: "DOWNLOAD_FAILED", detail: { reason: "NetworkError" } },
      TRANSLATE_FAILED: {
        code: "TRANSLATE_FAILED",
        detail: { done: 1, total: 2, reason: "stopped" },
      },
      FRAME_BLOCKED: { code: "FRAME_BLOCKED" },
      FRAME_BLOCKED_UNKNOWN: { code: "FRAME_BLOCKED_UNKNOWN" },
      FRAME_BLOCKED_DESPITE_OVERRIDE: { code: "FRAME_BLOCKED_DESPITE_OVERRIDE" },
      FRAME_BLOCKED_BY: {
        code: "FRAME_BLOCKED_BY",
        detail: { header: "X-Frame-Options: DENY" },
      },
      FRAME_LOAD_TIMEOUT: { code: "FRAME_LOAD_TIMEOUT", detail: { seconds: 10 } },
      FRAME_BUSTED: { code: "FRAME_BUSTED" },
      FRAMING_UNSAFE: { code: "FRAMING_UNSAFE", detail: { reason: "nonce" } },
      NO_ANCHORS: { code: "NO_ANCHORS" },
      API_KEY_MISSING: { code: "API_KEY_MISSING" },
      API_PERMISSION_MISSING: { code: "API_PERMISSION_MISSING" },
      API_AUTH_FAILED: { code: "API_AUTH_FAILED" },
      API_FORBIDDEN: { code: "API_FORBIDDEN", detail: { message: "Forbidden" } },
      API_REQUEST_FAILED: {
        code: "API_REQUEST_FAILED",
        detail: { status: 500, message: "Internal Server Error" },
      },
      API_TIMEOUT: { code: "API_TIMEOUT", detail: { seconds: 25 } },
      API_UNREACHABLE: { code: "API_UNREACHABLE", detail: { reason: "Failed to fetch" } },
      BATCH_MISMATCH: { code: "BATCH_MISMATCH", detail: { expected: 12, actual: 11 } },
      TEXT_TOO_LONG: { code: "TEXT_TOO_LONG", detail: { length: 5210, limit: 5000 } },
      PROVIDER_PAIR_UNSUPPORTED: {
        code: "PROVIDER_PAIR_UNSUPPORTED",
        detail: { source: "fr", target: "ja" },
      },
    } as const;

    for (const code of ALL_FAILURE_CODES) {
      const descriptor = describeFailure(samples[code]);
      const declared = Object.keys(catalogues.en?.[descriptor.key]?.placeholders ?? {}).length;
      expect(descriptor.substitutions.length, `substitution count for ${code}`).toBe(declared);
    }
  });
});

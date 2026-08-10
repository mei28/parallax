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
      FRAME_LOAD_TIMEOUT: { code: "FRAME_LOAD_TIMEOUT", detail: { seconds: 10 } },
      FRAME_BUSTED: { code: "FRAME_BUSTED" },
      FRAMING_UNSAFE: { code: "FRAMING_UNSAFE", detail: { reason: "nonce" } },
      NO_ANCHORS: { code: "NO_ANCHORS" },
    } as const;

    for (const code of ALL_FAILURE_CODES) {
      const descriptor = describeFailure(samples[code]);
      const declared = Object.keys(catalogues.en?.[descriptor.key]?.placeholders ?? {}).length;
      expect(descriptor.substitutions.length, `substitution count for ${code}`).toBe(declared);
    }
  });
});

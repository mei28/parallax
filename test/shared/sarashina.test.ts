// Sarashina request and response tests.
//
// The wire format here was settled by a spike against the live API (.tmp/sarashina-spike.md
// in a working copy): the service rewrites fragments into sentences, so only the paragraph
// boundaries survive, and only when each paragraph is wrapped in <p id>. The cases below are
// the behaviours that spike observed.
import { describe, expect, it } from "vitest";
import { ParallaxError } from "../../src/shared/errors.ts";
import {
  failureForFetchError,
  fitsInBatch,
  fitsInRequest,
  interpretResponse,
  isSarashinaPair,
  joinBlocks,
  requestBody,
  splitBlocks,
} from "../../src/shared/sarashina.ts";

describe("isSarashinaPair", () => {
  it.each([
    ["en", "ja", true],
    ["ja", "en", true],
    ["fr", "ja", false],
    ["en", "fr", false],
    ["ja", "ja", false],
  ])("%s into %s: %s", (source, target, expected) => {
    expect(isSarashinaPair({ source, target })).toBe(expected);
  });
});

describe("joinBlocks", () => {
  // Unwrapped, or joined by newlines alone, the service merges fragments into sentences and
  // the count no longer matches. Wrapped in <p id>, every paragraph came back.
  it("wraps each text in a numbered paragraph, escaping what would read as markup", () => {
    expect(joinBlocks(["Tom & Jerry", "if a < b > c"])).toBe(
      '<p id="0">Tom &amp; Jerry</p>\n<p id="1">if a &lt; b &gt; c</p>',
    );
  });
});

describe("splitBlocks", () => {
  // Recorded from the live API, ja into en: a space before every closing tag.
  it("returns each paragraph's translation in order, trimmed", () => {
    const answer =
      '<p id="0">The results will be announced next week. </p>\n' +
      '<p id="1">For details, please refer to the documentation. </p>';

    expect(splitBlocks(answer, 2)).toEqual([
      "The results will be announced next week.",
      "For details, please refer to the documentation.",
    ]);
  });

  // Recorded from the live API: an escaped "<p>" came back escaped, while "a < b" came back
  // as a bare "<". Undoing the escapes once reads both correctly.
  it("undoes the markup escapes once, whichever way the service answered", () => {
    const answer =
      '<p id="0">段落には&lt;p&gt;要素を用いる。</p>\n' +
      '<p id="1">a < b かつ b > c であっても</p>\n' +
      '<p id="2">&amp;lt; は実体参照</p>';

    expect(splitBlocks(answer, 3)).toEqual([
      "段落には<p>要素を用いる。",
      "a < b かつ b > c であっても",
      "&lt; は実体参照",
    ]);
  });

  // Paragraphs are matched to the blocks they came from by position. One missing, one
  // added, or two swapped would put every translation after it on the wrong paragraph.
  it.each([
    ["one missing", '<p id="0">一</p>\n<p id="2">三</p>', 3, 2],
    ["one added", '<p id="0">一</p>\n<p id="1">二</p>', 1, 2],
    ["two swapped", '<p id="1">二</p>\n<p id="0">一</p>', 2, 2],
    ["the wrapper dropped", "一 二", 2, 0],
  ])("refuses an answer with %s", (_, answer, expected, actual) => {
    expect(() => splitBlocks(answer, expected)).toThrow(
      expect.objectContaining({
        failure: { code: "BATCH_MISMATCH", detail: { expected, actual } },
      }),
    );
    expect(() => splitBlocks(answer, expected)).toThrow(ParallaxError);
  });
});

describe("fitting texts into requests", () => {
  // `<p id="0">` and `</p>` take 14 code points around the text itself.
  const WRAPPER = 14;

  it("keeps a batch to its budget, wrapper included", () => {
    expect(fitsInBatch(["a".repeat(1500 - WRAPPER)])).toBe(true);
    expect(fitsInBatch(["a".repeat(1500 - WRAPPER + 1)])).toBe(false);
  });

  // The service counts code points. An emoji is one, though it is two UTF-16 units.
  it("counts code points, as the service does", () => {
    expect(fitsInBatch(["😀".repeat(1500 - WRAPPER)])).toBe(true);
  });

  it("keeps a single request under the service's hard limit", () => {
    expect(fitsInRequest(["a".repeat(5000 - WRAPPER)])).toBe(true);
    expect(fitsInRequest(["a".repeat(5000 - WRAPPER + 1)])).toBe(false);
  });
});

describe("interpretResponse", () => {
  // Bodies and headers below were recorded from the live API.
  it.each([
    [
      "a translation",
      200,
      '{"translated_text":"こんにちは。"}',
      null,
      { kind: "translated", text: "こんにちは。" },
    ],
    [
      "a rejected key",
      401,
      '{"message":"Unauthorized"}',
      null,
      { kind: "failed", failure: { code: "API_AUTH_FAILED" } },
    ],
    [
      "a refusal from outside Japan",
      403,
      '{"message":"Forbidden"}',
      null,
      { kind: "failed", failure: { code: "API_FORBIDDEN", detail: { message: "Forbidden" } } },
    ],
    [
      "a rate limit",
      429,
      '{"message":"Too Many Requests"}',
      "48",
      { kind: "rate-limited", retryAfterSeconds: 48 },
    ],
    [
      "a rate limit that does not say how long",
      429,
      '{"message":"Too Many Requests"}',
      null,
      {
        kind: "failed",
        failure: {
          code: "API_REQUEST_FAILED",
          detail: { status: 429, message: "Too Many Requests" },
        },
      },
    ],
    [
      "a rate limit given as a date",
      429,
      '{"message":"Too Many Requests"}',
      "Wed, 21 Oct 2026 07:28:00 GMT",
      {
        kind: "failed",
        failure: {
          code: "API_REQUEST_FAILED",
          detail: { status: 429, message: "Too Many Requests" },
        },
      },
    ],
    [
      "a malformed request",
      400,
      '{"message":"invalid request body"}',
      null,
      {
        kind: "failed",
        failure: {
          code: "API_REQUEST_FAILED",
          detail: { status: 400, message: "invalid request body" },
        },
      },
    ],
    [
      "an error page that is not JSON",
      503,
      "Service Unavailable\n",
      null,
      {
        kind: "failed",
        failure: {
          code: "API_REQUEST_FAILED",
          detail: { status: 503, message: "Service Unavailable" },
        },
      },
    ],
    [
      "a success without a translation in it",
      200,
      '{"result":"こんにちは。"}',
      null,
      {
        kind: "failed",
        failure: {
          code: "API_REQUEST_FAILED",
          detail: { status: 200, message: '{"result":"こんにちは。"}' },
        },
      },
    ],
  ])("reads %s", (_, status, body, retryAfter, expected) => {
    expect(interpretResponse(status, body, retryAfter)).toEqual(expected);
  });
});

describe("requestBody", () => {
  it("names the languages the way the service does", () => {
    expect(requestBody({ source: "en", target: "ja" }, "Hello.")).toEqual({
      text: "Hello.",
      source_lang: "en",
      target_lang: "ja",
    });
  });
});

describe("failureForFetchError", () => {
  // AbortSignal.timeout() rejects with a DOMException named TimeoutError.
  it("names a request that ran out of time", () => {
    expect(failureForFetchError("TimeoutError", "signal timed out")).toEqual({
      code: "API_TIMEOUT",
      detail: { seconds: 25 },
    });
  });

  // fetch() rejects with a TypeError when it never got a response: offline, DNS, or the
  // host permission withdrawn mid-split.
  it("names a request that never reached the service", () => {
    expect(failureForFetchError("TypeError", "Failed to fetch")).toEqual({
      code: "API_UNREACHABLE",
      detail: { reason: "Failed to fetch" },
    });
  });
});

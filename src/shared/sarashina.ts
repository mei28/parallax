// Sarashina (SB Intuitions) /v1/translate: what parallax sends it and how it reads the reply.
//
// Pure, so the wire format is testable without the network. The worker does the fetch and
// the content script does the batching; both go through here.
import type { ParallaxFailure } from "./errors.ts";
import { ParallaxError } from "./errors.ts";
import type { LanguagePair } from "./types.ts";

export const SARASHINA_ENDPOINT = "https://api.sarashina.ai/v1/translate";

/** The host permission the worker needs to call the service without CORS getting in the way. */
export const SARASHINA_ORIGIN_PATTERN = "https://api.sarashina.ai/*";

/**
 * How long the worker waits for an answer. Chrome stops an extension service worker whose
 * fetch takes more than 30 seconds to answer; a full 5,000 code point request measured 13.
 */
export const SARASHINA_TIMEOUT_MS = 25_000;

/** The most one request may carry, counted in Unicode code points as the service counts. */
export const SARASHINA_MAX_CODE_POINTS = 5000;

/**
 * How much one batch aims to carry.
 *
 * Measured against the live API, a request takes about 2.7 ms per code point, so a batch
 * this size answers in about four seconds. Throughput does not depend on batch size, so a
 * small batch only brings the first translated screen sooner. Sent one after another, four
 * seconds apart, requests also stay well inside the 30 a minute the service allows.
 */
export const SARASHINA_BATCH_CODE_POINTS = 1500;

/** Length in Unicode code points, which is how the service measures its limit. */
export const codePoints = (text: string): number => [...text].length;

/** Whether these texts, wrapped for sending, stay within one batch's budget. */
export function fitsInBatch(texts: readonly string[]): boolean {
  return codePoints(joinBlocks(texts)) <= SARASHINA_BATCH_CODE_POINTS;
}

/** Whether these texts, wrapped for sending, are within what the service accepts at all. */
export function fitsInRequest(texts: readonly string[]): boolean {
  return codePoints(joinBlocks(texts)) <= SARASHINA_MAX_CODE_POINTS;
}

/** Sarashina translates between English and Japanese, in either direction, and nothing else. */
export function isSarashinaPair(pair: LanguagePair): boolean {
  return (
    (pair.source === "en" && pair.target === "ja") || (pair.source === "ja" && pair.target === "en")
  );
}

const escapeMarkup = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * One request's text: each paragraph wrapped in a numbered <p>.
 *
 * Measured against the live API, the wrapper is what keeps paragraphs apart. Joined by
 * newlines alone, fragments split by inline markup came back merged into sentences.
 */
export function joinBlocks(texts: readonly string[]): string {
  return texts.map((text, index) => `<p id="${index}">${escapeMarkup(text)}</p>`).join("\n");
}

const PARAGRAPH = /<p id="(\d+)">([\s\S]*?)<\/p>/g;

/**
 * Undo escapeMarkup() in a single pass, so "&amp;lt;" reads as "&lt;" rather than "<". The
 * service sometimes answers with the escapes kept and sometimes with them undone.
 */
const unescapeMarkup = (text: string): string =>
  text.replace(/&(lt|gt|amp);/g, (_, name: string) =>
    name === "lt" ? "<" : name === "gt" ? ">" : "&",
  );

/** The paragraphs of a reply, with the number each was sent under. */
function paragraphsIn(answer: string): { readonly id: number; readonly text: string }[] {
  return [...answer.matchAll(PARAGRAPH)].map(([, id, inner]) => {
    if (id === undefined || inner === undefined) {
      // Unreachable: both groups take part in every match of the pattern.
      throw new Error("a paragraph matched without its number or its text");
    }
    return { id: Number(id), text: unescapeMarkup(inner.trim()) };
  });
}

/**
 * Read the paragraphs back out of a reply to joinBlocks(), in the order they were sent.
 *
 * @throws ParallaxError BATCH_MISMATCH unless the reply holds exactly paragraphs 0 to
 * expected - 1, in that order. They are matched to blocks by position, so one out of place
 * would put every translation after it on the wrong paragraph.
 */
export function splitBlocks(answer: string, expected: number): string[] {
  const paragraphs = paragraphsIn(answer);
  if (
    paragraphs.length !== expected ||
    paragraphs.some((paragraph, index) => paragraph.id !== index)
  ) {
    throw new ParallaxError({
      code: "BATCH_MISMATCH",
      detail: { expected, actual: paragraphs.length },
    });
  }
  return paragraphs.map((paragraph) => paragraph.text);
}

/**
 * What a single request came to. Plain data, so the worker can hand it to the content script
 * as a message.
 */
export type SarashinaOutcome =
  | { readonly kind: "translated"; readonly text: string }
  | { readonly kind: "rate-limited"; readonly retryAfterSeconds: number }
  | { readonly kind: "failed"; readonly failure: ParallaxFailure };

/** The body's JSON, or undefined when it is not JSON at all, as error pages often are not. */
function parsed(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function field(value: unknown, name: string): string | undefined {
  if (typeof value !== "object" || value === null || !(name in value)) {
    return undefined;
  }
  const found: unknown = Reflect.get(value, name);
  return typeof found === "string" ? found : undefined;
}

/**
 * Read a response from /v1/translate.
 *
 * @param retryAfter the Retry-After header. The service sends whole seconds; anything else
 * is reported rather than guessed at.
 */
export function interpretResponse(
  status: number,
  body: string,
  retryAfter: string | null,
): SarashinaOutcome {
  const json = parsed(body);
  const message = field(json, "message") ?? body.trim();
  const failed = (failure: ParallaxFailure): SarashinaOutcome => ({ kind: "failed", failure });

  if (status === 200) {
    const text = field(json, "translated_text");
    return text === undefined
      ? failed({ code: "API_REQUEST_FAILED", detail: { status, message: body.trim() } })
      : { kind: "translated", text };
  }
  if (status === 401) {
    return failed({ code: "API_AUTH_FAILED" });
  }
  if (status === 403) {
    return failed({ code: "API_FORBIDDEN", detail: { message } });
  }
  if (status === 429 && retryAfter !== null && /^\d+$/.test(retryAfter)) {
    return { kind: "rate-limited", retryAfterSeconds: Number(retryAfter) };
  }
  return failed({ code: "API_REQUEST_FAILED", detail: { status, message } });
}

/** The JSON body of a /v1/translate request. */
export function requestBody(
  pair: LanguagePair,
  text: string,
): { readonly text: string; readonly source_lang: string; readonly target_lang: string } {
  return { text, source_lang: pair.source, target_lang: pair.target };
}

/**
 * Name a fetch() that never got a response.
 *
 * @param name the rejection's name: AbortSignal.timeout() rejects with TimeoutError, and
 * fetch() itself with TypeError when the request never got an answer.
 */
export function failureForFetchError(name: string, message: string): ParallaxFailure {
  return name === "TimeoutError"
    ? { code: "API_TIMEOUT", detail: { seconds: SARASHINA_TIMEOUT_MS / 1000 } }
    : { code: "API_UNREACHABLE", detail: { reason: message } };
}

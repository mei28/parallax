// Translating through Sarashina, from the content script's side.
//
// The service worker makes the request: it holds the key, and its fetch carries the host
// permission past CORS. What goes into one request, and how the answer is read back into
// paragraphs, is decided here.

import type { ParallaxFailure } from "../shared/errors.ts";
import { ParallaxError } from "../shared/errors.ts";
import type {
  SarashinaMessage,
  SarashinaReadyResponse,
  SarashinaTranslateResponse,
} from "../shared/messages.ts";
import type { SarashinaOutcome } from "../shared/sarashina.ts";
import {
  codePoints,
  fitsInBatch,
  fitsInRequest,
  isSarashinaPair,
  joinBlocks,
  SARASHINA_MAX_CODE_POINTS,
  splitBlocks,
} from "../shared/sarashina.ts";
import type { LanguagePair } from "../shared/types.ts";
import type { BatchOutcome, TranslationEngine } from "./translate-queue.ts";
import { blockUnits } from "./units.ts";

/** The service worker, as far as this engine needs it. Injected so tests need no runtime. */
export interface SarashinaWorker {
  /** null when a key is set and the service may be reached. */
  ready(): Promise<ParallaxFailure | null>;
  translate(pair: LanguagePair, text: string): Promise<SarashinaOutcome>;
}

export const sarashinaWorker: SarashinaWorker = {
  async ready() {
    const message: SarashinaMessage = { type: "SARASHINA_READY" };
    const response: SarashinaReadyResponse = await chrome.runtime.sendMessage(message);
    return response.failure;
  },
  async translate(pair, text) {
    const message: SarashinaMessage = { type: "SARASHINA_TRANSLATE", pair, text };
    const response: SarashinaTranslateResponse = await chrome.runtime.sendMessage(message);
    return response;
  },
};

/**
 * Whether Sarashina can translate this pair here and now.
 *
 * @throws ParallaxError PROVIDER_PAIR_UNSUPPORTED, or whatever the worker found missing:
 * API_KEY_MISSING or API_PERMISSION_MISSING.
 */
export async function checkSarashina(
  pair: LanguagePair,
  worker: SarashinaWorker = sarashinaWorker,
): Promise<"available"> {
  if (!isSarashinaPair(pair)) {
    throw new ParallaxError({ code: "PROVIDER_PAIR_UNSUPPORTED", detail: pair });
  }
  const failure = await worker.ready();
  if (failure !== null) {
    throw new ParallaxError(failure);
  }
  return "available";
}

/** An engine that sends each batch to Sarashina as numbered paragraphs. */
export function createSarashinaEngine(
  pair: LanguagePair,
  worker: SarashinaWorker = sarashinaWorker,
): TranslationEngine {
  return {
    // The service rewrites a paragraph as a whole, so a paragraph is the unit, cut between
    // its nodes only where it is too long for one request.
    unitsOf: (blocks) => blockUnits(blocks, (text) => fitsInRequest([text])),
    async translateBatch(texts): Promise<BatchOutcome> {
      const text = joinBlocks(texts);
      if (!fitsInRequest(texts)) {
        throw new ParallaxError({
          code: "TEXT_TOO_LONG",
          detail: { length: codePoints(text), limit: SARASHINA_MAX_CODE_POINTS },
        });
      }
      const send = async (): Promise<BatchOutcome> => {
        const outcome = await worker.translate(pair, text);
        switch (outcome.kind) {
          case "translated":
            return { kind: "translated", texts: splitBlocks(outcome.text, texts.length) };
          case "rate-limited":
            return outcome;
          case "failed":
            throw new ParallaxError(outcome.failure);
        }
      };
      try {
        return await send();
      } catch (error) {
        // Measured against the live API, about one request in twenty-five came back a
        // paragraph short, and the same request sent again came back whole. One more try of
        // the identical request; a second short answer stops the page by name.
        if (error instanceof ParallaxError && error.code === "BATCH_MISMATCH") {
          return await send();
        }
        throw error;
      }
    },
    accepts: fitsInBatch,
    destroy() {},
  };
}

// The Translator API's lifecycle, and the three states availability() can be in.
//
// This runs in the content script rather than the service worker: the Translator API is not
// exposed to worker contexts, only to windows, extension pages and offscreen documents.
import { ParallaxError } from "../shared/errors.ts";
import type { LanguagePair } from "../shared/types.ts";
import type { TranslationEngine } from "./translate-queue.ts";

export interface CreateCallbacks {
  /** Fraction 0..1 while a language pack downloads. Never called if it is already present. */
  onDownloadProgress(fraction: number): void;
}

/**
 * Whether the pair can be translated here, and whether using it will download anything.
 *
 * Checked before the overlay is built, so an unsupported pair never gets as far as loading
 * two copies of the page.
 *
 * @throws ParallaxError TRANSLATOR_API_MISSING or TRANSLATION_UNAVAILABLE.
 */
export async function checkAvailability(pair: LanguagePair): Promise<"available" | "downloadable"> {
  if (!("Translator" in self)) {
    throw new ParallaxError({ code: "TRANSLATOR_API_MISSING" });
  }
  const availability = await Translator.availability({
    sourceLanguage: pair.source,
    targetLanguage: pair.target,
  });
  if (availability === "unavailable") {
    throw new ParallaxError({ code: "TRANSLATION_UNAVAILABLE", detail: pair });
  }
  // "downloading" is treated as "downloadable": either way the caller must wait on the
  // monitor, and either way create() may need the transient activation a click supplies.
  return availability === "available" ? "available" : "downloadable";
}

/**
 * Open a translation session.
 *
 * The on-device model takes one text per call, so a batch is translated text by text.
 *
 * @throws ParallaxError ACTIVATION_REQUIRED when Chrome wants a user gesture before it will
 * download a pack, DOWNLOAD_FAILED for anything else.
 */
export async function createTranslator(
  pair: LanguagePair,
  callbacks: CreateCallbacks,
): Promise<TranslationEngine> {
  const session = await openSession(pair, callbacks);
  return {
    async translateBatch(texts) {
      const translations: string[] = [];
      for (const text of texts) {
        translations.push(await session.translate(text));
      }
      return translations;
    },
    destroy: () => session.destroy(),
  };
}

async function openSession(pair: LanguagePair, callbacks: CreateCallbacks): Promise<Translator> {
  try {
    return await Translator.create({
      sourceLanguage: pair.source,
      targetLanguage: pair.target,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          callbacks.onDownloadProgress(event.loaded);
        });
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new ParallaxError({ code: "ACTIVATION_REQUIRED" });
    }
    throw new ParallaxError({
      code: "DOWNLOAD_FAILED",
      detail: { reason: error instanceof Error ? error.message : String(error) },
    });
  }
}

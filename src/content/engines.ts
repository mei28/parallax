// The translators a split can use, behind one interface.
import type { LanguagePair, TranslationProvider } from "../shared/types.ts";
import { checkSarashina, createSarashinaEngine } from "./sarashina.ts";
import type { TranslationEngine } from "./translate-queue.ts";
import type { CreateCallbacks } from "./translator.ts";
import { checkAvailability as checkOnDevice, createTranslator } from "./translator.ts";

/**
 * Whether the chosen translator can take this pair, and whether using it will download
 * anything first.
 *
 * @throws ParallaxError naming why not.
 */
export function checkAvailability(
  provider: TranslationProvider,
  pair: LanguagePair,
): Promise<"available" | "downloadable"> {
  return provider === "sarashina" ? checkSarashina(pair) : checkOnDevice(pair);
}

/** Open the chosen translator. */
export async function createEngine(
  provider: TranslationProvider,
  pair: LanguagePair,
  callbacks: CreateCallbacks,
): Promise<TranslationEngine> {
  return provider === "sarashina" ? createSarashinaEngine(pair) : createTranslator(pair, callbacks);
}

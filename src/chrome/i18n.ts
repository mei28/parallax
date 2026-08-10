// Thin adapter over chrome.i18n. This is the only place a MessageDescriptor becomes text.
import type { MessageDescriptor } from "../shared/types.ts";

/**
 * Render a descriptor through the locale catalogue.
 *
 * @throws if the key is missing. chrome.i18n returns "" for an unknown key, which would
 * otherwise show as a blank error banner — the silent failure this codebase refuses. The
 * catalogue completeness test in test/shared/errors.test.ts is what keeps this unreachable.
 */
export function renderMessage(descriptor: MessageDescriptor): string {
  const text = chrome.i18n.getMessage(descriptor.key, [...descriptor.substitutions]);
  if (text === "") {
    throw new Error(`missing i18n message for key "${descriptor.key}"`);
  }
  return text;
}

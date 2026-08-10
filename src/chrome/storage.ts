// Preferences, held in chrome.storage.local.
//
// local rather than sync: the split ratio describes this machine's window, and syncing it to
// a laptop with a narrower screen would only be wrong.
import { DEFAULT_PREFERENCES } from "../shared/constants.ts";
import type { Preferences } from "../shared/types.ts";

const KEY = "preferences";

export async function loadPreferences(): Promise<Preferences> {
  const stored = await chrome.storage.local.get(KEY);
  const saved = stored[KEY] as Partial<Preferences> | undefined;
  return { ...DEFAULT_PREFERENCES, ...saved };
}

export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const merged = { ...(await loadPreferences()), ...patch };
  await chrome.storage.local.set({ [KEY]: merged });
  return merged;
}

const BLOCKED_KEY = "lastBlockedOrigin";

/**
 * The origin that last refused to be embedded.
 *
 * Kept in storage rather than in the content script's memory because the popup is what has
 * to act on it, and only an extension page can call permissions.request. Storage survives
 * the content script, the service worker and the popup all being torn down between the
 * failure and the reader getting round to doing something about it.
 *
 * storage.local rather than storage.session: session storage is closed to content scripts
 * unless the worker widens its access level, and this is written from one.
 */
export async function recordBlockedOrigin(origin: string): Promise<void> {
  await chrome.storage.local.set({ [BLOCKED_KEY]: origin });
}

export async function loadBlockedOrigin(): Promise<string | null> {
  const stored = await chrome.storage.local.get(BLOCKED_KEY);
  const origin = stored[BLOCKED_KEY];
  return typeof origin === "string" ? origin : null;
}

export async function clearBlockedOrigin(): Promise<void> {
  await chrome.storage.local.remove(BLOCKED_KEY);
}

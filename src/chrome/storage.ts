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

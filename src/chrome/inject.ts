// Putting the content script into a tab on demand.
//
// parallax declares no content script. Injecting only when the reader asks keeps the
// extension off every page they visit, and lets activeTab stand in for host permissions —
// which is what keeps the install-time permission warning away.
import { ParallaxError } from "../shared/errors.ts";
import type { Message, StateResponse } from "../shared/messages.ts";

/**
 * Ensure content.js is running in a tab's top frame, then deliver a message to it.
 *
 * Injection is idempotent: content/index.ts marks the isolated world it lands in, so a
 * second executeScript on the same tab is a no-op rather than a second overlay.
 *
 * @throws ParallaxError INJECTION_FAILED with Chrome's own explanation.
 */
export async function sendToTab(tabId: number, message: Message): Promise<StateResponse> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["content.js"],
    });
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    throw new ParallaxError({
      code: "INJECTION_FAILED",
      detail: { reason: error instanceof Error ? error.message : String(error) },
    });
  }
}

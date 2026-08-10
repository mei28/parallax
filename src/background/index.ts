// Service worker entry point.
//
// It owns the keyboard commands and nothing else. The Translator API is not available in
// worker contexts, and the popup talks to the tab directly, so there is no reason for any
// other work to pass through here.
import { armFraming, diagnoseFraming, disarmFraming } from "../chrome/framing.ts";
import { sendToTab } from "../chrome/inject.ts";
import { loadPreferences } from "../chrome/storage.ts";
import type { DiagnoseResponse, FramingMessage, FramingResponse } from "../shared/messages.ts";
import { isSplittableUrl } from "../shared/url.ts";

chrome.commands.onCommand.addListener((command, tab) => {
  void handleCommand(command, tab);
});

// Framing overrides live here because declarativeNetRequest is not reachable from a content
// script. The tab id comes from the sender, never from the message, so a page cannot reach
// into another tab.
chrome.runtime.onMessage.addListener(
  (
    message: FramingMessage,
    sender,
    respond: (response: FramingResponse | DiagnoseResponse) => void,
  ) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      return false;
    }
    if (message.type === "ARM_FRAMING") {
      armFraming(tabId, message.url).then(
        (result) => respond(result),
        (error: unknown) =>
          respond({
            kind: "failed",
            reason: error instanceof Error ? error.message : String(error),
          }),
      );
      return true;
    }
    if (message.type === "DIAGNOSE_FRAMING") {
      diagnoseFraming(message.url).then(
        (refusal) => respond({ refusal }),
        () => respond({ refusal: null }),
      );
      return true;
    }
    if (message.type === "DISARM_FRAMING") {
      disarmFraming(tabId).finally(() => respond({ kind: "no-permission" }));
      return true;
    }
    return false;
  },
);

// A split cannot outlive its tab, and neither should the weakened headers.
chrome.tabs.onRemoved.addListener((tabId) => {
  void disarmFraming(tabId);
});

async function handleCommand(command: string, tab?: chrome.tabs.Tab): Promise<void> {
  if (tab?.id === undefined || tab.url === undefined || !isSplittableUrl(tab.url)) {
    return;
  }

  // A commands invocation grants activeTab, which is what lets this inject without any
  // host permission.
  if (command === "toggle-split") {
    const preferences = await loadPreferences();
    await sendToTab(tab.id, { type: "TOGGLE_SPLIT", preferences });
    return;
  }
  if (command === "toggle-orientation") {
    await sendToTab(tab.id, { type: "TOGGLE_ORIENTATION" });
  }
}

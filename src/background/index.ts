// Service worker entry point.
//
// It owns the keyboard commands and nothing else. The Translator API is not available in
// worker contexts, and the popup talks to the tab directly, so there is no reason for any
// other work to pass through here.
import { sendToTab } from "../chrome/inject.ts";
import { loadPreferences } from "../chrome/storage.ts";
import { isSplittableUrl } from "../shared/url.ts";

chrome.commands.onCommand.addListener((command, tab) => {
  void handleCommand(command, tab);
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

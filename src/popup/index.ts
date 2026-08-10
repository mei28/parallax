// Popup UI.
//
// It injects and messages the tab directly rather than going through the service worker.
// Opening the popup is itself the user gesture that grants activeTab, so the extra hop would
// buy nothing.
import { sendToTab } from "../chrome/inject.ts";
import { loadPreferences, savePreferences } from "../chrome/storage.ts";
import { LANGUAGES } from "../shared/constants.ts";
import { ParallaxError } from "../shared/errors.ts";
import type { Orientation } from "../shared/types.ts";
import { isSplittableUrl } from "../shared/url.ts";

function required<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`popup.html is missing #${id}`);
  }
  return element as unknown as T;
}

const sourceSelect = required<HTMLSelectElement>("source");
const targetSelect = required<HTMLSelectElement>("target");
const horizontalRadio = required<HTMLInputElement>("horizontal");
const verticalRadio = required<HTMLInputElement>("vertical");
const toggleButton = required<HTMLButtonElement>("toggle");
const errorLine = required<HTMLParagraphElement>("error");

function fillLanguages(select: HTMLSelectElement, selected: string): void {
  select.replaceChildren(
    ...LANGUAGES.map(
      ({ code, label }) => new Option(`${label} (${code})`, code, false, code === selected),
    ),
  );
}

function paintOrientation(orientation: Orientation): void {
  horizontalRadio.checked = orientation === "horizontal";
  verticalRadio.checked = orientation === "vertical";
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function main(): Promise<void> {
  const preferences = await loadPreferences();
  fillLanguages(sourceSelect, preferences.sourceLanguage);
  fillLanguages(targetSelect, preferences.targetLanguage);
  paintOrientation(preferences.orientation);

  const tab = await activeTab();
  if (tab?.id === undefined || tab.url === undefined || !isSplittableUrl(tab.url)) {
    toggleButton.disabled = true;
    errorLine.textContent = "parallax cannot run on this page.";
    return;
  }
  const tabId = tab.id;

  // A tab with no content script yet simply has no split; that is not a failure to report.
  let active = false;
  try {
    active = (await chrome.tabs.sendMessage(tabId, { type: "GET_STATE" })).active;
  } catch {
    active = false;
  }
  toggleButton.textContent = active ? "Stop split" : "Split this page";

  sourceSelect.addEventListener("change", () => {
    void savePreferences({ sourceLanguage: sourceSelect.value });
  });
  targetSelect.addEventListener("change", () => {
    void savePreferences({ targetLanguage: targetSelect.value });
  });
  for (const [radio, orientation] of [
    [horizontalRadio, "horizontal"],
    [verticalRadio, "vertical"],
  ] as const) {
    radio.addEventListener("change", () => {
      void savePreferences({ orientation });
    });
  }

  toggleButton.addEventListener("click", () => {
    void (async () => {
      errorLine.textContent = "";
      toggleButton.disabled = true;
      try {
        if (active) {
          await sendToTab(tabId, { type: "STOP_SPLIT" });
        } else {
          const current = await savePreferences({
            sourceLanguage: sourceSelect.value,
            targetLanguage: targetSelect.value,
          });
          const response = await sendToTab(tabId, { type: "START_SPLIT", preferences: current });
          if (response.error !== undefined) {
            errorLine.textContent = response.error;
            toggleButton.disabled = false;
            return;
          }
        }
        window.close();
      } catch (error) {
        errorLine.textContent = error instanceof ParallaxError ? error.message : String(error);
        toggleButton.disabled = false;
      }
    })();
  });
}

void main();

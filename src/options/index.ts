// Options page: the Sarashina API key, and the host permission that goes with it.
//
// Only an extension page can call permissions.request, and only from a click, so this is
// where both are asked for. The key itself is never shown again once saved.
import { checkSarashinaReady } from "../chrome/sarashina.ts";
import { removeApiKey, saveApiKey } from "../chrome/storage.ts";
import { SARASHINA_ORIGIN_PATTERN } from "../shared/sarashina.ts";

function required<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`options.html is missing #${id}`);
  }
  return element as unknown as T;
}

const keyInput = required<HTMLInputElement>("key");
const saveButton = required<HTMLButtonElement>("save");
const removeButton = required<HTMLButtonElement>("remove");
const statusLine = required<HTMLParagraphElement>("status");

async function paintState(): Promise<void> {
  const failure = await checkSarashinaReady();
  keyInput.placeholder = failure?.code === "API_KEY_MISSING" ? "" : "A key is saved";
  statusLine.textContent =
    failure === null
      ? "Ready. Choose Sarashina in the popup to use it."
      : failure.code === "API_KEY_MISSING"
        ? "No key is saved."
        : "A key is saved, but access to api.sarashina.ai has not been allowed. Save it again.";
}

saveButton.addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (key === "") {
    statusLine.textContent = "Enter a key first.";
    return;
  }
  // Called before anything is awaited: permissions.request needs the click's user gesture,
  // and awaiting first would spend it.
  chrome.permissions
    .request({ origins: [SARASHINA_ORIGIN_PATTERN] })
    .then(async (granted) => {
      if (!granted) {
        statusLine.textContent =
          "Access to api.sarashina.ai was not allowed, so nothing was saved.";
        return;
      }
      await saveApiKey(key);
      keyInput.value = "";
      await paintState();
    })
    .catch((error: unknown) => {
      statusLine.textContent = error instanceof Error ? error.message : String(error);
    });
});

removeButton.addEventListener("click", () => {
  // Both go: the permission is only there for the key's sake.
  Promise.all([removeApiKey(), chrome.permissions.remove({ origins: [SARASHINA_ORIGIN_PATTERN] })])
    .then(paintState)
    .catch((error: unknown) => {
      statusLine.textContent = error instanceof Error ? error.message : String(error);
    });
});

paintState().catch((error: unknown) => {
  statusLine.textContent = `parallax could not read its settings: ${
    error instanceof Error ? error.message : String(error)
  }`;
});

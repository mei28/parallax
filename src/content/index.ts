// Content script entry point.
//
// Injected programmatically into the top frame only, so the two iframes this script creates
// never re-run it. The marker below makes a repeated injection a no-op rather than a second
// overlay stacked on the first.
import { renderMessage } from "../chrome/i18n.ts";
import { describeFailure, ParallaxError } from "../shared/errors.ts";
import type { Message, StateResponse } from "../shared/messages.ts";
import type { Controller } from "./controller.ts";
import { startSplit } from "./controller.ts";

declare global {
  interface Window {
    __parallaxInstalled?: true;
  }
}

if (window.__parallaxInstalled !== true) {
  window.__parallaxInstalled = true;

  let controller: Controller | null = null;

  const stop = (): void => {
    controller?.destroy();
    controller = null;
  };

  const start = async (message: Extract<Message, { type: "START_SPLIT" }>): Promise<void> => {
    stop();
    controller = await startSplit(document, message.preferences);
  };

  chrome.runtime.onMessage.addListener(
    (message: Message, _sender, respond: (response: StateResponse) => void) => {
      switch (message.type) {
        case "GET_STATE":
          respond({ active: controller !== null });
          return false;

        case "STOP_SPLIT":
          stop();
          respond({ active: false });
          return false;

        case "START_SPLIT":
        case "TOGGLE_SPLIT": {
          if (message.type === "TOGGLE_SPLIT" && controller !== null) {
            stop();
            respond({ active: false });
            return false;
          }
          start({ type: "START_SPLIT", preferences: message.preferences })
            .then(() => respond({ active: true }))
            .catch((error: unknown) => {
              // The split never opened, so there is no overlay to show this in.
              const failure =
                error instanceof ParallaxError
                  ? error.failure
                  : ({
                      code: "INJECTION_FAILED",
                      detail: { reason: error instanceof Error ? error.message : String(error) },
                    } as const);
              respond({ active: false, error: renderMessage(describeFailure(failure)) });
            });
          return true; // respond() is called asynchronously
        }

        case "TOGGLE_ORIENTATION":
          respond({ active: controller !== null });
          return false;
      }
    },
  );
}

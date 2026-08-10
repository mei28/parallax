// Asking the service worker to relax a site's framing rules for this tab.
//
// The content script cannot do any of it itself: declarativeNetRequest is not exposed here,
// and reading the served policy needs a cross-origin fetch. The tab the rules apply to comes
// from the message sender, not from anything sent, so this cannot reach another tab.
import type { ArmResult } from "../chrome/framing.ts";
import type { DiagnoseResponse, FramingMessage } from "../shared/messages.ts";

export async function requestFramingOverride(url: string): Promise<ArmResult> {
  const message: FramingMessage = { type: "ARM_FRAMING", url };
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Which header refused the embed, or null when it could not be determined. */
export async function diagnoseFraming(url: string): Promise<string | null> {
  const message: FramingMessage = { type: "DIAGNOSE_FRAMING", url };
  try {
    const response: DiagnoseResponse = await chrome.runtime.sendMessage(message);
    return response.refusal;
  } catch {
    return null;
  }
}

export async function releaseFramingOverride(): Promise<void> {
  const message: FramingMessage = { type: "DISARM_FRAMING" };
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // The worker is gone, which means its session rules are gone with it.
  }
}

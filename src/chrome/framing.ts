// Arming and disarming the framing override, in the service worker.
//
// All of it lives here rather than half in the content script, because both halves need the
// host permission: reading the served policy takes a cross-origin fetch, and applying it
// takes declarativeNetRequest. Asking without the permission therefore costs nothing — it
// returns before the fetch.
//
// Session rules rather than dynamic ones, so the weakening cannot outlive the browser, and
// tab-scoped conditions so it cannot outlive the split that asked for it.
import { planCspRewrite } from "../shared/csp.ts";
import { buildFramingRules, framingRuleId } from "../shared/framing-rules.ts";

export type ArmResult =
  | { readonly kind: "armed" }
  | { readonly kind: "no-permission" }
  | { readonly kind: "unsafe"; readonly reason: "nonce" | "hash" }
  | { readonly kind: "failed"; readonly reason: string };

function originPattern(url: string): string {
  return `${new URL(url).origin}/*`;
}

/** Whether the reader has already granted parallax access to this origin. */
export async function hasOriginPermission(url: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [originPattern(url)] });
}

/**
 * Let one tab embed one origin, by serving that origin's subframe responses without their
 * framing restrictions.
 *
 * The policy is read from a live request rather than assumed, because only the served value
 * says whether rewriting is safe. A policy carrying a per-response nonce is not: replaying a
 * captured nonce would block every inline script the page has, breaking it far worse than
 * refusing to embed it.
 */
export async function armFraming(tabId: number, url: string): Promise<ArmResult> {
  if (!(await hasOriginPermission(url))) {
    return { kind: "no-permission" };
  }

  let served: string | null;
  try {
    const response = await fetch(url, { method: "GET", credentials: "include" });
    served = response.headers.get("content-security-policy");
    // The body is not wanted; releasing it keeps the request from being held open.
    await response.body?.cancel();
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
  }

  const plan = planCspRewrite(served);
  if (plan.kind === "unsafe") {
    return { kind: "unsafe", reason: plan.reason };
  }

  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [framingRuleId(tabId)],
      addRules: buildFramingRules(tabId, url, plan),
    });
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
  return { kind: "armed" };
}

/** Put the site's own framing rules back. Safe to call when nothing was armed. */
export async function disarmFraming(tabId: number): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [framingRuleId(tabId)],
  });
}

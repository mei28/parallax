// The declarativeNetRequest rules that let a site refusing to be embedded appear in a pane.
//
// These strip a real security header, so their scope is the point. Each rule is confined to
// one tab, to subframe requests, and to the single origin the reader granted — never to the
// browsing session at large. They are session rules, so they also die with the browser.
import type { CspPlan } from "./csp.ts";

/**
 * Rule ids are derived from the tab id so a second split in the same tab replaces its
 * predecessor instead of stacking, and so clearing one tab's rule cannot clear another's.
 * The offset keeps them clear of any static ruleset added later.
 */
const RULE_ID_BASE = 1_000_000;

export const FRAMING_RULE_PRIORITY = 1;

export function framingRuleId(tabId: number): number {
  return RULE_ID_BASE + tabId;
}

/**
 * Build the rules that permit framing for one tab and one origin.
 *
 * Returns nothing when the policy cannot be rewritten safely — see planCspRewrite. Removing
 * the whole CSP instead would embed the page at the cost of its XSS protections, which is a
 * trade nobody asked for.
 */
export function buildFramingRules(
  tabId: number,
  url: string,
  csp: CspPlan,
): chrome.declarativeNetRequest.Rule[] {
  if (csp.kind === "unsafe") {
    return [];
  }

  const responseHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
    // X-Frame-Options does nothing but control embedding, so removing it has no collateral.
    { header: "x-frame-options", operation: "remove" },
  ];
  if (csp.kind === "remove") {
    responseHeaders.push({ header: "content-security-policy", operation: "remove" });
  } else if (csp.kind === "replace") {
    responseHeaders.push({
      header: "content-security-policy",
      operation: "set",
      value: csp.value,
    });
  }

  return [
    {
      id: framingRuleId(tabId),
      priority: FRAMING_RULE_PRIORITY,
      action: { type: "modifyHeaders", responseHeaders },
      condition: {
        tabIds: [tabId],
        resourceTypes: ["sub_frame"],
        urlFilter: `||${new URL(url).hostname}/`,
      },
    },
  ];
}

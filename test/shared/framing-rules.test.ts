// The declarativeNetRequest rules that let a refusing site be embedded.
//
// These weaken a real security header, so their shape matters: scoped to one tab, to
// subframe requests, and to the one origin the reader allowed. Getting that wrong would
// strip framing protection from the whole browser session.
import { describe, expect, it } from "vitest";
import { buildFramingRules, FRAMING_RULE_PRIORITY } from "../../src/shared/framing-rules.ts";

const TAB = 42;

function rule(csp: Parameters<typeof buildFramingRules>[2]) {
  const rules = buildFramingRules(TAB, "https://github.com/features", csp);
  expect(rules).toHaveLength(1);
  return rules[0];
}

describe("buildFramingRules", () => {
  it("always removes X-Frame-Options, which controls nothing else", () => {
    expect(rule({ kind: "keep" })?.action.responseHeaders).toContainEqual({
      header: "x-frame-options",
      operation: "remove",
    });
  });

  it("leaves the CSP header untouched when the policy allows framing", () => {
    const headers = rule({ kind: "keep" })?.action.responseHeaders ?? [];
    expect(headers.some((h) => h.header === "content-security-policy")).toBe(false);
  });

  it("removes the CSP header when framing was all it said", () => {
    expect(rule({ kind: "remove" })?.action.responseHeaders).toContainEqual({
      header: "content-security-policy",
      operation: "remove",
    });
  });

  it("replaces the CSP with the rewritten policy, keeping its other directives", () => {
    expect(
      rule({ kind: "replace", value: "default-src 'self'" })?.action.responseHeaders,
    ).toContainEqual({
      header: "content-security-policy",
      operation: "set",
      value: "default-src 'self'",
    });
  });

  it("confines the rule to the tab the reader asked in", () => {
    expect(rule({ kind: "keep" })?.condition.tabIds).toEqual([TAB]);
  });

  it("confines the rule to subframe requests, leaving top-level loads alone", () => {
    expect(rule({ kind: "keep" })?.condition.resourceTypes).toEqual(["sub_frame"]);
  });

  it("confines the rule to the origin that was allowed", () => {
    expect(rule({ kind: "keep" })?.condition.urlFilter).toBe("||github.com/");
  });

  it("gives each tab its own rule id, so one split cannot clear another's", () => {
    const mine = buildFramingRules(TAB, "https://github.com/", { kind: "keep" });
    const theirs = buildFramingRules(TAB + 1, "https://github.com/", { kind: "keep" });
    expect(mine[0]?.id).not.toBe(theirs[0]?.id);
  });

  it("gives the same tab the same id every time, so re-arming replaces rather than piles up", () => {
    const first = buildFramingRules(TAB, "https://github.com/", { kind: "keep" });
    const second = buildFramingRules(TAB, "https://example.com/", { kind: "remove" });
    expect(first[0]?.id).toBe(second[0]?.id);
  });

  it("uses a priority the rule set agrees on", () => {
    expect(rule({ kind: "keep" })?.priority).toBe(FRAMING_RULE_PRIORITY);
  });

  it("refuses to build anything when rewriting would break the page", () => {
    expect(
      buildFramingRules(TAB, "https://github.com/", { kind: "unsafe", reason: "nonce" }),
    ).toEqual([]);
  });
});

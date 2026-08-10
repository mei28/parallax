// Rewriting a Content-Security-Policy so a page can be embedded, without weakening anything
// else it asked for.
//
// declarativeNetRequest can only remove or replace a header wholesale, so dropping one
// directive means reading the value and setting a new one. That is safe only when the rest
// of the policy does not depend on this particular response — which nonces do.
import { describe, expect, it } from "vitest";
import { describeFramingRefusal, planCspRewrite } from "../../src/shared/csp.ts";

describe("planCspRewrite", () => {
  it("leaves a policy alone when it says nothing about framing", () => {
    expect(planCspRewrite("default-src 'self'; script-src 'self'")).toEqual({ kind: "keep" });
  });

  it("leaves an absent policy alone", () => {
    expect(planCspRewrite(null)).toEqual({ kind: "keep" });
  });

  it("drops the framing directive and keeps the rest", () => {
    expect(planCspRewrite("default-src 'self'; frame-ancestors 'none'; img-src *")).toEqual({
      kind: "replace",
      value: "default-src 'self'; img-src *",
    });
  });

  it("removes the header when framing was all it said", () => {
    expect(planCspRewrite("frame-ancestors 'none'")).toEqual({ kind: "remove" });
  });

  it("matches the directive whatever the spacing and case", () => {
    expect(planCspRewrite("  Frame-Ancestors   'none' ;  script-src 'self'  ")).toEqual({
      kind: "replace",
      value: "script-src 'self'",
    });
  });

  it("does not mistake a directive that merely starts the same way", () => {
    expect(planCspRewrite("frame-src 'self'")).toEqual({ kind: "keep" });
  });

  it("handles several policies in one comma-separated header", () => {
    expect(planCspRewrite("frame-ancestors 'none', default-src 'self'")).toEqual({
      kind: "replace",
      value: "default-src 'self'",
    });
  });

  // A nonce is minted per response. Replaying a captured one would block every inline script
  // the page has — breaking it far worse than refusing to embed it.
  it("refuses to rewrite a policy carrying a nonce", () => {
    expect(planCspRewrite("script-src 'nonce-r4nd0m'; frame-ancestors 'none'")).toEqual({
      kind: "unsafe",
      reason: "nonce",
    });
  });

  it("refuses to rewrite a policy carrying a hash", () => {
    expect(planCspRewrite("script-src 'sha256-abc123='; frame-ancestors 'none'")).toEqual({
      kind: "unsafe",
      reason: "hash",
    });
  });

  it("ignores a nonce when there is no framing directive to remove", () => {
    expect(planCspRewrite("script-src 'nonce-r4nd0m'")).toEqual({ kind: "keep" });
  });
});

// Which header actually refused the embed.
//
// Naming the wrong one is worse than naming none: X sends X-Frame-Options: SAMEORIGIN, which
// is harmless here because both panes are same-origin, and refuses through frame-ancestors
// instead. A message blaming XFO would send the reader looking in the wrong place.
describe("describeFramingRefusal", () => {
  it("names X-Frame-Options when it denies outright", () => {
    expect(describeFramingRefusal("DENY", null)).toBe("X-Frame-Options: DENY");
  });

  it("says nothing about SAMEORIGIN, which same-origin panes satisfy", () => {
    expect(describeFramingRefusal("SAMEORIGIN", null)).toBeNull();
  });

  it("names frame-ancestors when the policy allows no ancestor", () => {
    expect(describeFramingRefusal(null, "frame-ancestors 'none'")).toBe(
      "Content-Security-Policy: frame-ancestors 'none'",
    );
  });

  it("names frame-ancestors when it lists only other origins", () => {
    expect(describeFramingRefusal(null, "frame-ancestors https://elsewhere.test")).toBe(
      "Content-Security-Policy: frame-ancestors https://elsewhere.test",
    );
  });

  it("says nothing when the policy permits the page's own origin", () => {
    expect(describeFramingRefusal(null, "frame-ancestors 'self'")).toBeNull();
  });

  it("prefers frame-ancestors, which the spec says overrides X-Frame-Options", () => {
    expect(describeFramingRefusal("SAMEORIGIN", "default-src 'self'; frame-ancestors 'none'")).toBe(
      "Content-Security-Policy: frame-ancestors 'none'",
    );
  });

  it("says nothing when neither header restricts framing", () => {
    expect(describeFramingRefusal(null, "default-src 'self'")).toBeNull();
    expect(describeFramingRefusal(null, null)).toBeNull();
  });
});

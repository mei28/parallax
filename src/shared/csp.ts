// Deciding what to do with a page's Content-Security-Policy so that it can be embedded.
//
// declarativeNetRequest's modifyHeaders can only remove a header or replace it whole, so
// dropping a single directive means reading the served value and setting a rewritten one.
// That substitution is only sound if the rest of the policy is the same for every response.
// Nonces and hashes are not: a nonce is minted per response, and replaying a captured one
// would block every inline script on the page. Refusing is better than that.

export type CspPlan =
  /** The policy does not restrict framing. Leave the header exactly as served. */
  | { readonly kind: "keep" }
  /** Framing was all it said. The header can go. */
  | { readonly kind: "remove" }
  /** Send this instead of what the server sent. */
  | { readonly kind: "replace"; readonly value: string }
  /** Rewriting would break the page. Report it rather than embed at that cost. */
  | { readonly kind: "unsafe"; readonly reason: "nonce" | "hash" };

const FRAME_ANCESTORS = /^frame-ancestors\b/i;

/**
 * Work out how to serve a policy that permits framing.
 *
 * @param header the Content-Security-Policy value as served, or null if there was none.
 */
export function planCspRewrite(header: string | null): CspPlan {
  if (header === null || header.trim() === "") {
    return { kind: "keep" };
  }

  // A single header can carry several policies separated by commas, and each policy is a
  // list of directives separated by semicolons. Only whole directives are matched, so
  // frame-src is left alone.
  const policies = header.split(",");
  const kept: string[] = [];
  let removedAny = false;

  for (const policy of policies) {
    const directives = policy
      .split(";")
      .map((directive) => directive.trim())
      .filter((directive) => directive !== "");
    const remaining = directives.filter((directive) => {
      if (FRAME_ANCESTORS.test(directive)) {
        removedAny = true;
        return false;
      }
      return true;
    });
    if (remaining.length > 0) {
      kept.push(remaining.join("; "));
    }
  }

  if (!removedAny) {
    return { kind: "keep" };
  }
  if (/'nonce-/i.test(header)) {
    return { kind: "unsafe", reason: "nonce" };
  }
  if (/'sha(256|384|512)-/i.test(header)) {
    return { kind: "unsafe", reason: "hash" };
  }
  if (kept.length === 0) {
    return { kind: "remove" };
  }
  return { kind: "replace", value: kept.join(", ") };
}

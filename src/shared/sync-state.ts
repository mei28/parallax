// Echo suppression for two-way scroll syncing.
//
// Writing the follower's scrollTop fires a scroll event on it, which would sync the leader
// straight back. Rather than a timer or a leader lock, the exact value written is
// remembered: a scroll event carrying that value is our own write coming back.
//
// The expectation survives repeated echoes, because Chrome can fire more than one scroll
// event for a single assignment. It is cleared only when a different value arrives, which
// is the user actually scrolling.
import type { PaneId } from "./types.ts";

export interface SyncState {
  readonly expected: Readonly<Record<PaneId, number | null>>;
}

export type ScrollObservation =
  | { readonly kind: "echo"; readonly state: SyncState }
  | { readonly kind: "lead"; readonly state: SyncState };

export function createSyncState(): SyncState {
  return { expected: { source: null, target: null } };
}

/** Record the scrollTop about to be written to a pane. */
export function expectScroll(state: SyncState, pane: PaneId, scrollTop: number): SyncState {
  return { expected: { ...state.expected, [pane]: scrollTop } };
}

/** Classify a scroll event as our own write returning, or as the user leading. */
export function observeScroll(
  state: SyncState,
  pane: PaneId,
  scrollTop: number,
): ScrollObservation {
  if (state.expected[pane] === scrollTop) {
    return { kind: "echo", state };
  }
  return { kind: "lead", state: { expected: { ...state.expected, [pane]: null } } };
}

// Echo-suppression tests.
//
// Syncing pane B writes B.scrollTop, which fires a scroll event on B. Without a guard that
// event would sync A back, and the two panes would drive each other. The guard compares the
// event against the exact value last written, so it needs no timers and no leader lock.
import { describe, expect, it } from "vitest";
import { createSyncState, expectScroll, observeScroll } from "../../src/shared/sync-state.ts";

describe("observeScroll", () => {
  it("treats a scroll with no pending write as user input", () => {
    expect(observeScroll(createSyncState(), "source", 120).kind).toBe("lead");
  });

  it("treats a scroll matching the pending write as an echo", () => {
    const state = expectScroll(createSyncState(), "target", 500);
    expect(observeScroll(state, "target", 500).kind).toBe("echo");
  });

  it("keeps treating the written value as an echo when Chrome fires twice", () => {
    const state = expectScroll(createSyncState(), "target", 500);
    const first = observeScroll(state, "target", 500);
    expect(first.kind).toBe("echo");
    expect(observeScroll(first.state, "target", 500).kind).toBe("echo");
  });

  it("treats a different value as the user taking over, and forgets the expectation", () => {
    const state = expectScroll(createSyncState(), "target", 500);
    const lead = observeScroll(state, "target", 520);
    expect(lead.kind).toBe("lead");
    expect(observeScroll(lead.state, "target", 500).kind).toBe("lead");
  });

  it("keeps each pane's expectation to itself", () => {
    const state = expectScroll(createSyncState(), "target", 500);
    expect(observeScroll(state, "source", 500).kind).toBe("lead");
  });
});

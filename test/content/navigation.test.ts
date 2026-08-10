// @vitest-environment jsdom
// Following a link in one pane with the other.
//
// Clicking a link navigates only the pane it was clicked in, which would leave the two
// showing different pages. The other pane has to be sent after it — and then told apart from
// the reader navigating again, which is the same echo problem the scroll sync has.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaneFrame } from "../../src/content/navigation.ts";
import { createNavigationFollower } from "../../src/content/navigation.ts";

const HOME = "https://example.test/article";

/** A frame that records where it was sent and fires load when told to. */
function fakeFrame(url = HOME) {
  const handlers: (() => void)[] = [];
  const frame: PaneFrame & { visited: string[]; arrive(at?: string): void } = {
    visited: [],
    currentUrl: () => url,
    navigate: (to: string) => {
      frame.visited.push(to);
      url = to;
    },
    onLoad: (handler) => handlers.push(handler),
    // The browser finishing a navigation.
    arrive: (at?: string) => {
      if (at !== undefined) {
        url = at;
      }
      for (const handler of [...handlers]) {
        handler();
      }
    },
  };
  return frame;
}

let source: ReturnType<typeof fakeFrame>;
let target: ReturnType<typeof fakeFrame>;
let onNavigated: ReturnType<typeof vi.fn>;
let onLeftOrigin: ReturnType<typeof vi.fn>;

function start() {
  onNavigated = vi.fn();
  onLeftOrigin = vi.fn();
  createNavigationFollower({
    frames: { source, target },
    origin: new URL(HOME).origin,
    startedAt: HOME,
    onNavigated,
    onLeftOrigin,
    signal: new AbortController().signal,
  });
}

beforeEach(() => {
  source = fakeFrame();
  target = fakeFrame();
});

describe("createNavigationFollower", () => {
  it("sends the other pane after a link followed in the original", async () => {
    start();

    source.arrive("https://example.test/next");
    target.arrive();
    await Promise.resolve();

    expect(target.visited).toEqual(["https://example.test/next"]);
  });

  it("sends the other pane after a link followed in the translation", async () => {
    start();

    target.arrive("https://example.test/next");
    source.arrive();
    await Promise.resolve();

    expect(source.visited).toEqual(["https://example.test/next"]);
  });

  it("does not send the leader back where it already is", async () => {
    start();

    source.arrive("https://example.test/next");
    target.arrive();
    await Promise.resolve();

    expect(source.visited).toEqual([]);
  });

  it("reports the new page once both panes are on it", async () => {
    start();

    source.arrive("https://example.test/next");
    target.arrive();
    await Promise.resolve();

    expect(onNavigated).toHaveBeenCalledWith("https://example.test/next");
  });

  it("ignores the load its own catch-up caused", async () => {
    start();

    source.arrive("https://example.test/next");
    target.arrive();
    await Promise.resolve();

    expect(source.visited).toEqual([]);
    expect(target.visited).toEqual(["https://example.test/next"]);
  });

  it("ignores a reload that lands on the same page", async () => {
    start();

    source.arrive(HOME);
    await Promise.resolve();

    expect(target.visited).toEqual([]);
    expect(onNavigated).not.toHaveBeenCalled();
  });

  it("keeps the fragment out of it, since it loads nothing new", async () => {
    start();

    source.arrive(`${HOME}#section`);
    await Promise.resolve();

    expect(target.visited).toEqual([]);
  });

  it("stops rather than following a link to another site", async () => {
    start();

    source.arrive("https://elsewhere.test/page");
    await Promise.resolve();

    expect(target.visited).toEqual([]);
    expect(onLeftOrigin).toHaveBeenCalledWith("https://elsewhere.test/page");
    expect(onNavigated).not.toHaveBeenCalled();
  });

  it("treats an unreadable pane as having left the origin", async () => {
    source.currentUrl = () => null;
    start();

    source.arrive();
    await Promise.resolve();

    expect(onLeftOrigin).toHaveBeenCalled();
  });
});

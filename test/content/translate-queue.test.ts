// @vitest-environment jsdom
// Translation queue tests.
//
// The on-device translator runs one call at a time, measured at roughly 29 ms each, so the
// order the queue works in is the difference between a page that is readable immediately
// and one that blocks for a quarter of a minute. The translate function is injected, so all
// of that ordering is testable without touching the real API.
import { describe, expect, it, vi } from "vitest";
import type { TranslateTarget } from "../../src/content/translate-queue.ts";
import { createQueue } from "../../src/content/translate-queue.ts";

function target(text: string, anchorId: number): TranslateTarget {
  return { node: document.createTextNode(text), anchorId };
}

/** An engine that brackets each text, built on a per-text function the test can watch. */
function engine(translate: (text: string) => Promise<string> = async (text) => `[${text}]`) {
  return {
    translateBatch: async (texts: readonly string[]) => Promise.all(texts.map(translate)),
  };
}

function options(overrides: Partial<Parameters<typeof createQueue>[0]> = {}) {
  return {
    engine: engine(),
    onProgress: () => {},
    onCommit: () => {},
    onError: () => {},
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("createQueue", () => {
  it("writes the translation back into the node", async () => {
    const queue = createQueue(options());
    const item = target("Hello", 0);

    queue.enqueue([item]);
    await queue.whenIdle();

    expect(item.node.data).toBe("[Hello]");
  });

  it("preserves the whitespace around the text it translated", async () => {
    const queue = createQueue(options());
    const item = target("\n  Hello\n", 0);

    queue.enqueue([item]);
    await queue.whenIdle();

    expect(item.node.data).toBe("\n  [Hello]\n");
  });

  it("translates repeated text once and reuses the result", async () => {
    const translate = vi.fn(async (text: string) => `[${text}]`);
    const queue = createQueue(options({ engine: engine(translate) }));
    const first = target("Home", 0);
    const second = target("Home", 1);

    queue.enqueue([first, second]);
    await queue.whenIdle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(second.node.data).toBe("[Home]");
  });

  it("reports progress against the total enqueued", async () => {
    const onProgress = vi.fn();
    const queue = createQueue(options({ onProgress }));

    queue.enqueue([target("One", 0), target("Two", 1)]);
    await queue.whenIdle();

    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });

  it("works the prioritised anchors first, then the rest in order", async () => {
    const order: string[] = [];
    const translate = vi.fn(async (text: string) => {
      order.push(text);
      return `[${text}]`;
    });
    const queue = createQueue(options({ engine: engine(translate) }));

    queue.enqueue([target("First", 0), target("Second", 1), target("Third", 2)]);
    queue.prioritize([2]);
    await queue.whenIdle();

    expect(order).toEqual(["Third", "First", "Second"]);
  });

  it("stops at the first failure instead of skipping past it", async () => {
    const translate = vi.fn(async (text: string) => {
      if (text === "Two") {
        throw new Error("the model was unloaded");
      }
      return `[${text}]`;
    });
    const onError = vi.fn();
    const queue = createQueue(options({ engine: engine(translate), onError }));
    const third = target("Three", 2);

    queue.enqueue([target("One", 0), target("Two", 1), third]);
    await queue.whenIdle();

    expect(translate).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledOnce();
    expect(third.node.data).toBe("Three");
  });

  it("reports how far it got when it failed", async () => {
    const onError = vi.fn();
    const queue = createQueue(
      options({
        engine: engine(async () => {
          throw new Error("nope");
        }),
        onError,
      }),
    );

    queue.enqueue([target("One", 0), target("Two", 1)]);
    await queue.whenIdle();

    expect(onError).toHaveBeenCalledWith({
      code: "TRANSLATE_FAILED",
      detail: { done: 0, total: 2, reason: "nope" },
    });
  });

  it("stops translating once the controller aborts", async () => {
    const controller = new AbortController();
    const translate = vi.fn(async (text: string) => {
      controller.abort();
      return `[${text}]`;
    });
    const queue = createQueue(options({ engine: engine(translate), signal: controller.signal }));

    queue.enqueue([target("One", 0), target("Two", 1), target("Three", 2)]);
    await queue.whenIdle();

    expect(translate).toHaveBeenCalledTimes(1);
  });
});

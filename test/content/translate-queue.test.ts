// @vitest-environment jsdom
// Translation queue tests.
//
// The on-device translator runs one call at a time, measured at roughly 29 ms each, so the
// order the queue works in is the difference between a page that is readable immediately
// and one that blocks for a quarter of a minute. The translate function is injected, so all
// of that ordering is testable without touching the real API.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchOutcome } from "../../src/content/translate-queue.ts";
import { createQueue } from "../../src/content/translate-queue.ts";
import { nodeUnit } from "../../src/content/units.ts";
import { ParallaxError } from "../../src/shared/errors.ts";

/** A one-node unit, with its node alongside so a test can read what was written. */
function target(text: string, anchorId: number) {
  const node = document.createTextNode(text);
  return { ...nodeUnit(node, anchorId), node };
}

/** A translateBatch that answers with whatever `answer` returns for the texts it was sent. */
function answering(answer: (texts: readonly string[]) => Promise<readonly string[]>) {
  return async (texts: readonly string[]) => ({
    kind: "translated" as const,
    texts: await answer(texts),
  });
}

/**
 * An engine that brackets each text, built on a per-text function the test can watch.
 *
 * By default it takes one text per batch, as the on-device translator does, so the ordering
 * tests below see one call per text.
 */
function engine(
  translate: (text: string) => Promise<string> = async (text) => `[${text}]`,
  accepts: (texts: readonly string[]) => boolean = (texts) => texts.length <= 1,
) {
  return {
    translateBatch: answering(async (texts) => Promise.all(texts.map(translate))),
    accepts,
  };
}

function options(overrides: Partial<Parameters<typeof createQueue>[0]> = {}) {
  return {
    engine: engine(),
    onProgress: () => {},
    onCommit: () => {},
    onError: () => {},
    onWait: () => {},
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

  // A remote translator takes seconds to answer its first request. Until then the status
  // line would still say the panes are loading.
  it("reports the work it has queued before anything is translated", () => {
    const onProgress = vi.fn();
    const queue = createQueue(options({ onProgress }));

    queue.enqueue([target("One", 0), target("Two", 1)]);

    expect(onProgress).toHaveBeenCalledWith(0, 2);
  });

  describe("batches", () => {
    // A remote translator allows a few requests a minute, so what fits in one request goes
    // in one request.
    it("sends neighbouring texts together while the engine accepts them", async () => {
      const translateBatch = vi.fn(async (texts: readonly string[]) =>
        texts.map((text) => `[${text}]`),
      );
      const queue = createQueue(
        options({ engine: { translateBatch: answering(translateBatch), accepts: () => true } }),
      );
      const items = [target("One", 0), target("Two", 1)];

      queue.enqueue(items);
      await queue.whenIdle();

      expect(translateBatch.mock.calls).toEqual([[["One", "Two"]]]);
      expect(items.map((item) => item.node.data)).toEqual(["[One]", "[Two]"]);
    });

    // Skipping ahead to something that fits would undo the order prioritize() chose.
    it("ends a batch at the first text that does not fit, which leads the next", async () => {
      const translateBatch = vi.fn(async (texts: readonly string[]) =>
        texts.map((text) => `[${text}]`),
      );
      const accepts = (texts: readonly string[]) => texts.join("").length <= 6;
      const queue = createQueue(
        options({ engine: { translateBatch: answering(translateBatch), accepts } }),
      );

      queue.enqueue([target("One", 0), target("Two", 1), target("Three", 2), target("Y", 3)]);
      await queue.whenIdle();

      expect(translateBatch.mock.calls).toEqual([[["One", "Two"]], [["Three", "Y"]]]);
    });

    it("sends a text repeated inside a batch once, and writes it everywhere", async () => {
      const translateBatch = vi.fn(async (texts: readonly string[]) =>
        texts.map((text) => `[${text}]`),
      );
      const queue = createQueue(
        options({ engine: { translateBatch: answering(translateBatch), accepts: () => true } }),
      );
      const items = [target("Home", 0), target("About", 1), target("Home", 2)];

      queue.enqueue(items);
      await queue.whenIdle();

      expect(translateBatch.mock.calls).toEqual([[["Home", "About"]]]);
      expect(items.map((item) => item.node.data)).toEqual(["[Home]", "[About]", "[Home]"]);
    });

    it("writes what it already knows without asking the engine", async () => {
      const translateBatch = vi.fn(async (texts: readonly string[]) =>
        texts.map((text) => `[${text}]`),
      );
      const queue = createQueue(
        options({ engine: { translateBatch: answering(translateBatch), accepts: () => true } }),
      );
      queue.enqueue([target("Home", 0)]);
      await queue.whenIdle();
      const again = [target("Home", 1), target("Home", 2)];

      queue.enqueue(again);
      await queue.whenIdle();

      expect(translateBatch).toHaveBeenCalledOnce();
      expect(again.map((item) => item.node.data)).toEqual(["[Home]", "[Home]"]);
    });

    it("sends a text alone when even a batch of one is more than the engine accepts", async () => {
      const translateBatch = vi.fn(async (texts: readonly string[]) =>
        texts.map((text) => `[${text}]`),
      );
      const queue = createQueue(
        options({ engine: { translateBatch: answering(translateBatch), accepts: () => false } }),
      );
      const item = target("Too long", 0);

      queue.enqueue([item]);
      await queue.whenIdle();

      expect(translateBatch).toHaveBeenCalledWith(["Too long"]);
      expect(item.node.data).toBe("[Too long]");
    });

    // Answers are matched to texts by position, so a count that is off means every
    // translation after the gap would land on the wrong text.
    it.each([
      ["more", ["[One]", "[Two]", "[Three]"]],
      ["fewer", ["[One]"]],
    ])(
      "stops, writing nothing, when the engine answers %s texts than it was sent",
      async (_, answer) => {
        const onError = vi.fn();
        const queue = createQueue(
          options({
            engine: { translateBatch: answering(async () => answer), accepts: () => true },
            onError,
          }),
        );
        const items = [target("One", 0), target("Two", 1)];

        queue.enqueue(items);
        await queue.whenIdle();

        expect(onError).toHaveBeenCalledWith({
          code: "TRANSLATE_FAILED",
          detail: {
            done: 0,
            total: 2,
            reason: `the translator answered ${answer.length} texts for 2`,
          },
        });
        expect(items.map((item) => item.node.data)).toEqual(["One", "Two"]);
      },
    );

    it("counts a batch as done only once it is written", async () => {
      let calls = 0;
      const translateBatch = async (texts: readonly string[]) => {
        if (++calls === 2) {
          throw new Error("the service went away");
        }
        return texts.map((text) => `[${text}]`);
      };
      const onError = vi.fn();
      const queue = createQueue(
        options({
          engine: {
            translateBatch: answering(translateBatch),
            accepts: (texts) => texts.length <= 2,
          },
          onError,
        }),
      );
      const items = ["A", "B", "C", "D"].map((text, index) => target(text, index));

      queue.enqueue(items);
      await queue.whenIdle();

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ detail: expect.objectContaining({ done: 2, total: 4 }) }),
      );
      expect(items.map((item) => item.node.data)).toEqual(["[A]", "[B]", "C", "D"]);
    });

    // An engine that talks to a service knows why it failed — a rejected key, a region the
    // service refuses — and that is what the reader needs to read, not a generic failure.
    it("reports an engine's own named failure as it is", async () => {
      const onError = vi.fn();
      const queue = createQueue(
        options({
          engine: {
            translateBatch: answering(async () => {
              throw new ParallaxError({ code: "TRANSLATOR_API_MISSING" });
            }),
            accepts: () => true,
          },
          onError,
        }),
      );

      queue.enqueue([target("One", 0)]);
      await queue.whenIdle();

      expect(onError).toHaveBeenCalledWith({ code: "TRANSLATOR_API_MISSING" });
    });
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

  // Following a link aborts the page while a request may still be out. What it brings back
  // belongs to the page that was left, and writing it would report progress on the new one.
  it("drops a translation that lands after the page was left", async () => {
    const controller = new AbortController();
    let land: (texts: readonly string[]) => void = () => {};
    const translateBatch = vi.fn(
      () =>
        new Promise<readonly string[]>((resolve) => {
          land = resolve;
        }),
    );
    const onProgress = vi.fn();
    const queue = createQueue(
      options({
        engine: { translateBatch: answering(translateBatch), accepts: () => true },
        onProgress,
        signal: controller.signal,
      }),
    );
    const item = target("Hello", 0);

    queue.enqueue([item]);
    await vi.waitFor(() => expect(translateBatch).toHaveBeenCalled());
    controller.abort();
    land(["[Hello]"]);
    await queue.whenIdle();

    expect(item.node.data).toBe("Hello");
    expect(onProgress).not.toHaveBeenCalledWith(1, 1);
  });

  it("does not report a failure that lands after the page was left", async () => {
    const controller = new AbortController();
    let fail: (error: Error) => void = () => {};
    const translateBatch = vi.fn(
      () =>
        new Promise<readonly string[]>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const onError = vi.fn();
    const queue = createQueue(
      options({
        engine: { translateBatch: answering(translateBatch), accepts: () => true },
        onError,
        signal: controller.signal,
      }),
    );

    queue.enqueue([target("Hello", 0)]);
    await vi.waitFor(() => expect(translateBatch).toHaveBeenCalled());
    controller.abort();
    fail(new Error("the request was cut off"));
    await queue.whenIdle();

    expect(onError).not.toHaveBeenCalled();
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

  // A translator that rewrites a whole paragraph cannot say which of its words belong to a
  // link inside it. The paragraph's translation goes into one of its nodes, and the rest
  // give up their words but keep their spacing, so nothing is inserted, moved or removed.
  it("writes a unit's translation into its primary node and empties the others", async () => {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = "Read the <a>docs</a> for details.";
    const [before, link, after] = [
      paragraph.firstChild,
      paragraph.querySelector("a")?.firstChild,
      paragraph.lastChild,
    ] as Text[];
    const unit = {
      text: "Read the docs for details.",
      nodes: [before, link, after] as Text[],
      primary: 0,
      anchorId: 0,
    };
    const queue = createQueue(options());

    queue.enqueue([unit]);
    await queue.whenIdle();

    expect(unit.nodes.map((node) => node.data)).toEqual(["[Read the docs for details.] ", "", " "]);
  });

  // A remote service allows so many requests a minute and says how long to wait when the
  // reader goes past that. Waiting is the way through; the translation is not broken.
  describe("rate limits", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Refuses its first request for `seconds`, then brackets every text it is sent. */
    function limitedOnce(seconds: number) {
      let refused = false;
      return vi.fn(async (texts: readonly string[]): Promise<BatchOutcome> => {
        if (!refused) {
          refused = true;
          return { kind: "rate-limited", retryAfterSeconds: seconds };
        }
        return { kind: "translated", texts: texts.map((text) => `[${text}]`) };
      });
    }

    it("waits out the limit, counting down, then sends the same texts again", async () => {
      const translateBatch = limitedOnce(3);
      const onWait = vi.fn();
      const queue = createQueue(
        options({ engine: { translateBatch, accepts: () => true }, onWait }),
      );
      const item = target("One", 0);

      queue.enqueue([item]);
      await vi.advanceTimersByTimeAsync(3000);
      await queue.whenIdle();

      expect(onWait.mock.calls).toEqual([[3], [2], [1]]);
      expect(translateBatch.mock.calls).toEqual([[["One"]], [["One"]]]);
      expect(item.node.data).toBe("[One]");
    });

    // The wait can be most of a minute. What was translated before it should be readable,
    // and scroll-synced, for all of that time.
    it("settles what it has written before it starts waiting", async () => {
      let calls = 0;
      const translateBatch = vi.fn(
        async (texts: readonly string[]): Promise<BatchOutcome> =>
          ++calls === 2
            ? { kind: "rate-limited", retryAfterSeconds: 2 }
            : { kind: "translated", texts: texts.map((text) => `[${text}]`) },
      );
      const events: string[] = [];
      const first = target("One", 0);
      const queue = createQueue(
        options({
          engine: { translateBatch, accepts: (texts) => texts.length <= 1 },
          onCommit: () => events.push(`commit, first reads ${first.node.data}`),
          onWait: (seconds) => events.push(`wait ${seconds}`),
        }),
      );

      queue.enqueue([first, target("Two", 1)]);
      await vi.advanceTimersByTimeAsync(2000);
      await queue.whenIdle();

      expect(events.slice(0, 2)).toEqual(["commit, first reads [One]", "wait 2"]);
    });

    // The reader keeps scrolling while the service makes them wait.
    it("lets what came into view during the wait go first", async () => {
      const translateBatch = limitedOnce(2);
      const queue = createQueue(
        options({ engine: { translateBatch, accepts: (texts) => texts.length <= 1 } }),
      );

      queue.enqueue([target("First", 0), target("Second", 1), target("Third", 2)]);
      await vi.advanceTimersByTimeAsync(0);
      queue.prioritize([2]);
      await vi.advanceTimersByTimeAsync(2000);
      await queue.whenIdle();

      expect(translateBatch.mock.calls.slice(1)).toEqual([[["Third"]], [["First"]], [["Second"]]]);
    });

    // The next request takes seconds of its own. "1 second left" should not sit there
    // while it is out.
    it("puts the progress line back as soon as the wait is over", async () => {
      let calls = 0;
      const translateBatch = vi.fn(
        (): Promise<BatchOutcome> =>
          ++calls === 1
            ? Promise.resolve({ kind: "rate-limited", retryAfterSeconds: 1 })
            : new Promise(() => {}),
      );
      const events: string[] = [];
      const queue = createQueue(
        options({
          engine: { translateBatch, accepts: () => true },
          onProgress: (done, total) => events.push(`progress ${done}/${total}`),
          onWait: (seconds) => events.push(`wait ${seconds}`),
        }),
      );

      queue.enqueue([target("One", 0)]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(translateBatch).toHaveBeenCalledTimes(2);
      expect(events).toEqual(["progress 0/1", "wait 1", "progress 0/1"]);
      queue.destroy();
    });

    // The overlay outlives the page: a countdown that kept going would tell the next page
    // it is waiting on a request it never made.
    it("stops counting, and sends nothing more, once the page is left during the wait", async () => {
      const translateBatch = limitedOnce(5);
      const onWait = vi.fn();
      const controller = new AbortController();
      const queue = createQueue(
        options({
          engine: { translateBatch, accepts: () => true },
          onWait,
          signal: controller.signal,
        }),
      );

      queue.enqueue([target("One", 0)]);
      await vi.advanceTimersByTimeAsync(1000);
      controller.abort();
      await vi.advanceTimersByTimeAsync(10_000);
      await queue.whenIdle();

      expect(onWait.mock.calls).toEqual([[5], [4]]);
      expect(translateBatch).toHaveBeenCalledOnce();
    });
  });
});

// The translation queue.
//
// The on-device translator runs one call at a time — measured at roughly 29 ms per call —
// so a 400-node article translated front to back would block for well over ten seconds. A
// remote one takes seconds per request and allows so many a minute. Three things make both
// tolerable: working the blocks currently in view first, never asking for the same string
// twice, and sending as much in one request as the engine accepts.
import type { ParallaxFailure } from "../shared/errors.ts";
import { ParallaxError } from "../shared/errors.ts";
import { reassemble, segmentWhitespace } from "../shared/text.ts";

/** Text nodes translated as one piece, and what is sent to the translator for them. */
export interface TranslationUnit {
  readonly text: string;
  /** In document order. */
  readonly nodes: readonly Text[];
  /** Which of `nodes` receives the translation. */
  readonly primary: number;
  /** The paired block this unit belongs to, which is how prioritize() addresses it. */
  readonly anchorId: number;
}

/**
 * What a batch came back as. A rate limit is not a failure: the service has said when it
 * will take the same request.
 */
export type BatchOutcome =
  | { readonly kind: "translated"; readonly texts: readonly string[] }
  | { readonly kind: "rate-limited"; readonly retryAfterSeconds: number };

/**
 * A translator as the queue sees it: texts in, the same number of translations out, in the
 * same order. Injected so the queue is testable without the real Translator API.
 */
export interface TranslationEngine {
  translateBatch(texts: readonly string[]): Promise<BatchOutcome>;
  /** Whether these texts can go out in one batch. */
  accepts(texts: readonly string[]): boolean;
  destroy(): void;
}

export interface QueueOptions {
  engine: Pick<TranslationEngine, "translateBatch" | "accepts">;
  onProgress: (done: number, total: number) => void;
  /**
   * Called every so many units written, before a rate limit is waited out, and once the
   * queue drains, so scroll samples can be recomputed.
   */
  onCommit: () => void;
  onError: (failure: ParallaxFailure) => void;
  /** Called once a second, with the seconds left, while a rate limit is waited out. */
  onWait: (secondsLeft: number) => void;
  signal: AbortSignal;
}

export interface Queue {
  enqueue(units: readonly TranslationUnit[]): void;
  /** Move the named anchors to the front, preserving the relative order of the rest. */
  prioritize(anchorIds: readonly number[]): void;
  /** Resolves when the queue has drained, aborted, or failed. */
  whenIdle(): Promise<void>;
  destroy(): void;
}

/** How many units are written before scroll samples are told to refresh. */
const COMMIT_BATCH = 20;

export function createQueue(options: QueueOptions): Queue {
  const pending: TranslationUnit[] = [];
  const memo = new Map<string, string>();
  let total = 0;
  let done = 0;
  let running: Promise<void> | null = null;
  let stopped = false;

  /** Whether the page this queue serves has been left or closed. Checked after every wait. */
  const abandoned = (): boolean => stopped || options.signal.aborted;

  /**
   * The items at the front of the queue that go out together, and the texts to send for them.
   *
   * A contiguous run, so the order prioritize() set is the order the reader sees.
   */
  function takeBatch(): { items: TranslationUnit[]; texts: string[] } {
    const items: TranslationUnit[] = [];
    const texts: string[] = [];
    for (const item of pending) {
      if (!memo.has(item.text) && !texts.includes(item.text)) {
        // A batch always takes its first text: one the engine cannot take even alone is
        // the engine's to refuse, by name, not the queue's to skip.
        if (texts.length > 0 && !options.engine.accepts([...texts, item.text])) {
          break;
        }
        texts.push(item.text);
      }
      items.push(item);
    }
    pending.splice(0, items.length);
    return { items, texts };
  }

  /**
   * Keep each answer against the text it answers. They are matched by position, so a count
   * that is off in either direction is a failure, not something to line up as best it can.
   */
  function remember(texts: readonly string[], translations: readonly string[]): void {
    const miscounted = new Error(
      `the translator answered ${translations.length} texts for ${texts.length}`,
    );
    if (translations.length > texts.length) {
      throw miscounted;
    }
    for (const [index, text] of texts.entries()) {
      const translation = translations[index];
      if (translation === undefined) {
        throw miscounted;
      }
      memo.set(text, translation);
    }
  }

  function write(item: TranslationUnit): void {
    const translation = memo.get(item.text);
    if (translation === undefined) {
      // Unreachable: a batch holds only texts that were memoised or were just answered.
      throw new Error(`no translation was kept for ${JSON.stringify(item.text)}`);
    }
    // Only Text.data is assigned, never an element touched: the two panes must keep the same
    // structure for the scroll sync to pair them. A node that gives up its words keeps the
    // whitespace around them, so the spacing between the elements left standing survives.
    for (const [index, node] of item.nodes.entries()) {
      node.data = reassemble(
        segmentWhitespace(node.data),
        index === item.primary ? translation : "",
      );
    }
  }

  /**
   * Ask the engine for the texts the memo does not hold yet.
   *
   * @returns "ready" when the batch can be written, "stop" when the queue is finished with,
   * or how long to wait before sending the same texts again.
   */
  async function learn(
    texts: readonly string[],
  ): Promise<"ready" | "stop" | { readonly waitSeconds: number }> {
    if (texts.length === 0) {
      return "ready";
    }
    try {
      const outcome = await options.engine.translateBatch(texts);
      if (abandoned()) {
        return "stop";
      }
      if (outcome.kind === "rate-limited") {
        return { waitSeconds: outcome.retryAfterSeconds };
      }
      remember(texts, outcome.texts);
      return "ready";
    } catch (error) {
      if (abandoned()) {
        return "stop";
      }
      // Stop here rather than skipping the batch. Everything after it stays in the
      // original language, visibly, instead of leaving a hole nobody notices.
      stopped = true;
      options.onError(
        error instanceof ParallaxError
          ? error.failure
          : {
              code: "TRANSLATE_FAILED",
              detail: {
                done,
                total,
                reason: error instanceof Error ? error.message : String(error),
              },
            },
      );
      return "stop";
    }
  }

  /**
   * Count a rate limit down a second at a time.
   *
   * @returns whether the queue should carry on afterwards.
   */
  async function waitOut(seconds: number): Promise<boolean> {
    for (let left = seconds; left > 0; left--) {
      options.onWait(left);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (abandoned()) {
        return false;
      }
    }
    return true;
  }

  async function drain(): Promise<void> {
    let sinceCommit = 0;
    while (pending.length > 0 && !abandoned()) {
      const { items, texts } = takeBatch();
      const learnt = await learn(texts);
      if (learnt === "stop") {
        return;
      }
      if (learnt !== "ready") {
        pending.unshift(...items);
        if (sinceCommit > 0) {
          sinceCommit = 0;
          options.onCommit();
        }
        if (!(await waitOut(learnt.waitSeconds))) {
          return;
        }
        options.onProgress(done, total);
        continue;
      }

      for (const item of items) {
        write(item);
      }
      done += items.length;
      options.onProgress(done, total);

      sinceCommit += items.length;
      if (sinceCommit >= COMMIT_BATCH) {
        sinceCommit = 0;
        options.onCommit();
      }
    }
    if (sinceCommit > 0) {
      options.onCommit();
    }
  }

  function schedule(): void {
    if (running !== null || stopped) {
      return;
    }
    // Start on a microtask so a prioritise() call made straight after enqueue() still
    // decides what gets translated first.
    running = Promise.resolve()
      .then(drain)
      .finally(() => {
        running = null;
      });
  }

  return {
    enqueue(units) {
      pending.push(...units);
      total += units.length;
      options.onProgress(done, total);
      schedule();
    },

    prioritize(anchorIds) {
      const wanted = new Set(anchorIds);
      const front: TranslationUnit[] = [];
      const back: TranslationUnit[] = [];
      for (const item of pending) {
        (wanted.has(item.anchorId) ? front : back).push(item);
      }
      pending.length = 0;
      pending.push(...front, ...back);
    },

    async whenIdle() {
      while (running !== null) {
        await running;
      }
    },

    destroy() {
      stopped = true;
      pending.length = 0;
    },
  };
}

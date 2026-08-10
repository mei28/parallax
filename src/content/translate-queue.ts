// The translation queue.
//
// The on-device translator runs one call at a time — measured at roughly 29 ms per call —
// so a 400-node article translated front to back would block for well over ten seconds. Two
// things make that tolerable: working the blocks currently in view first, and never asking
// for the same string twice.
import { reassemble, segmentWhitespace } from "../shared/text.ts";

export interface TranslateTarget {
  readonly node: Text;
  /** The paired block this text belongs to, which is how prioritise() addresses it. */
  readonly anchorId: number;
}

export interface TranslationFailure {
  readonly done: number;
  readonly total: number;
  readonly reason: string;
}

export interface QueueOptions {
  /** Injected so the queue is testable without the real Translator API. */
  translate: (text: string) => Promise<string>;
  onProgress: (done: number, total: number) => void;
  /** Called after each batch lands, so scroll samples can be recomputed. */
  onCommit: () => void;
  onError: (failure: TranslationFailure) => void;
  signal: AbortSignal;
}

export interface Queue {
  enqueue(targets: readonly TranslateTarget[]): void;
  /** Move the named anchors to the front, preserving the relative order of the rest. */
  prioritize(anchorIds: readonly number[]): void;
  /** Resolves when the queue has drained, aborted, or failed. */
  whenIdle(): Promise<void>;
  destroy(): void;
}

/** How many nodes are written before scroll samples are told to refresh. */
const COMMIT_BATCH = 20;

export function createQueue(options: QueueOptions): Queue {
  const pending: TranslateTarget[] = [];
  const memo = new Map<string, string>();
  let total = 0;
  let done = 0;
  let running: Promise<void> | null = null;
  let stopped = false;

  async function drain(): Promise<void> {
    let sinceCommit = 0;
    while (pending.length > 0 && !stopped && !options.signal.aborted) {
      const item = pending.shift();
      if (item === undefined) {
        break;
      }

      const segmented = segmentWhitespace(item.node.data);
      const cached = memo.get(segmented.core);
      let translated: string;
      if (cached === undefined) {
        try {
          translated = await options.translate(segmented.core);
        } catch (error) {
          // Stop here rather than skipping the node. Everything after it stays in the
          // original language, visibly, instead of leaving a hole nobody notices.
          stopped = true;
          options.onError({
            done,
            total,
            reason: error instanceof Error ? error.message : String(error),
          });
          return;
        }
        memo.set(segmented.core, translated);
      } else {
        translated = cached;
      }

      item.node.data = reassemble(segmented, translated);
      done++;
      options.onProgress(done, total);

      if (++sinceCommit >= COMMIT_BATCH) {
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
    enqueue(targets) {
      pending.push(...targets);
      total += targets.length;
      schedule();
    },

    prioritize(anchorIds) {
      const wanted = new Set(anchorIds);
      const front: TranslateTarget[] = [];
      const back: TranslateTarget[] = [];
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

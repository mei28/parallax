// @vitest-environment jsdom
// Sarashina engine tests.
//
// The worker holds the key and makes the request; this side decides what goes in one
// request and reads the answer back into paragraphs. The worker is injected, so all of
// that is testable without chrome.runtime or the network.
import { describe, expect, it, vi } from "vitest";
import type { SarashinaWorker } from "../../src/content/sarashina.ts";
import { checkSarashina, createSarashinaEngine } from "../../src/content/sarashina.ts";

const EN_JA = { source: "en", target: "ja" } as const;

function worker(overrides: Partial<SarashinaWorker> = {}): SarashinaWorker {
  return {
    ready: vi.fn(async () => null),
    translate: vi.fn(async () => ({ kind: "translated" as const, text: "" })),
    ...overrides,
  };
}

describe("checkSarashina", () => {
  it("refuses a pair the service cannot translate, without asking the worker", async () => {
    const asked = worker();

    await expect(checkSarashina({ source: "fr", target: "ja" }, asked)).rejects.toMatchObject({
      failure: { code: "PROVIDER_PAIR_UNSUPPORTED", detail: { source: "fr", target: "ja" } },
    });
    expect(asked.ready).not.toHaveBeenCalled();
  });

  // Checked before the overlay is built, so a missing key costs no page loads.
  it("reports what the worker found missing", async () => {
    const missing = worker({ ready: async () => ({ code: "API_KEY_MISSING" }) });

    await expect(checkSarashina(EN_JA, missing)).rejects.toMatchObject({
      failure: { code: "API_KEY_MISSING" },
    });
  });

  it("answers available once a key is set and the service may be reached", async () => {
    await expect(checkSarashina(EN_JA, worker())).resolves.toBe("available");
  });
});

describe("createSarashinaEngine", () => {
  it("sends a batch as numbered paragraphs and reads the answer back paragraph by paragraph", async () => {
    const translate = vi.fn(async () => ({
      kind: "translated" as const,
      text: '<p id="0">こんにちは。</p>\n<p id="1">さようなら。</p>',
    }));
    const engine = createSarashinaEngine(EN_JA, worker({ translate }));

    const outcome = await engine.translateBatch(["Hello.", "Goodbye."]);

    expect(translate).toHaveBeenCalledWith(EN_JA, '<p id="0">Hello.</p>\n<p id="1">Goodbye.</p>');
    expect(outcome).toEqual({ kind: "translated", texts: ["こんにちは。", "さようなら。"] });
  });

  // Measured against the live API: about one request in twenty-five came back a paragraph
  // short, and the same request sent again came back whole.
  it("sends a batch once more when a paragraph goes missing, and reads the second answer", async () => {
    const short = '<p id="0">こんにちは。さようなら。</p>';
    const whole = '<p id="0">こんにちは。</p>\n<p id="1">さようなら。</p>';
    const translate = vi
      .fn()
      .mockResolvedValueOnce({ kind: "translated", text: short })
      .mockResolvedValueOnce({ kind: "translated", text: whole });
    const engine = createSarashinaEngine(EN_JA, worker({ translate }));

    const outcome = await engine.translateBatch(["Hello.", "Goodbye."]);

    expect(translate.mock.calls).toEqual([
      [EN_JA, '<p id="0">Hello.</p>\n<p id="1">Goodbye.</p>'],
      [EN_JA, '<p id="0">Hello.</p>\n<p id="1">Goodbye.</p>'],
    ]);
    expect(outcome).toEqual({ kind: "translated", texts: ["こんにちは。", "さようなら。"] });
  });

  it("stops by name when the second answer is short as well", async () => {
    const translate = vi.fn(async () => ({
      kind: "translated" as const,
      text: '<p id="0">こんにちは。さようなら。</p>',
    }));
    const engine = createSarashinaEngine(EN_JA, worker({ translate }));

    await expect(engine.translateBatch(["Hello.", "Goodbye."])).rejects.toMatchObject({
      failure: { code: "BATCH_MISMATCH", detail: { expected: 2, actual: 1 } },
    });
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it("raises what the worker reports as a named failure", async () => {
    const engine = createSarashinaEngine(
      EN_JA,
      worker({
        translate: async () => ({ kind: "failed", failure: { code: "API_AUTH_FAILED" } }),
      }),
    );

    await expect(engine.translateBatch(["Hello."])).rejects.toMatchObject({
      failure: { code: "API_AUTH_FAILED" },
    });
  });

  // Waiting is the queue's to do: only it knows what was written and what is in view.
  it("hands a rate limit on to the queue", async () => {
    const engine = createSarashinaEngine(
      EN_JA,
      worker({ translate: async () => ({ kind: "rate-limited", retryAfterSeconds: 48 }) }),
    );

    await expect(engine.translateBatch(["Hello."])).resolves.toEqual({
      kind: "rate-limited",
      retryAfterSeconds: 48,
    });
  });

  it("takes into a batch only what keeps it within the batch budget", () => {
    const engine = createSarashinaEngine(EN_JA, worker());

    expect(engine.accepts(["a".repeat(700), "b".repeat(700)])).toBe(true);
    expect(engine.accepts(["a".repeat(700), "b".repeat(800)])).toBe(false);
  });

  // Paragraphs are cut between nodes to fit, so only a single text node this long gets here.
  // The service would answer 400; saying why is better.
  it("refuses, by name, a text longer than the service accepts, without sending it", async () => {
    const translate = vi.fn();
    const engine = createSarashinaEngine(EN_JA, worker({ translate }));

    await expect(engine.translateBatch(["a".repeat(5000)])).rejects.toMatchObject({
      failure: { code: "TEXT_TOO_LONG", detail: { length: 5014, limit: 5000 } },
    });
    expect(translate).not.toHaveBeenCalled();
  });
});

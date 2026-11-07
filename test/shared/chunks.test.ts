// Chunking tests.
//
// A paragraph longer than one request can carry is cut between its text nodes, never inside
// one: a node is the smallest thing a translation can be written back into.
import { describe, expect, it } from "vitest";
import { chunkWhile } from "../../src/shared/chunks.ts";

const shortEnough = (items: readonly string[]) => items.join("").length <= 6;

describe("chunkWhile", () => {
  it("keeps everything together when it all fits", () => {
    expect(chunkWhile(["ab", "cd"], shortEnough)).toEqual([["ab", "cd"]]);
  });

  it("starts a new chunk at the first item that would not fit", () => {
    expect(chunkWhile(["ab", "cd", "ef", "g"], shortEnough)).toEqual([["ab", "cd", "ef"], ["g"]]);
  });

  // Too long to send is the sender's to report, by name. Dropping it here would leave a
  // paragraph silently untranslated.
  it("gives an item that does not fit even alone a chunk of its own", () => {
    expect(chunkWhile(["ab", "toolong", "cd"], shortEnough)).toEqual([["ab"], ["toolong"], ["cd"]]);
  });
});

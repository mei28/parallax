// Cutting a run of items into the fewest consecutive pieces that each fit.

/**
 * Split `items` into consecutive chunks, each as long as `fits` allows.
 *
 * Order is kept, and nothing is dropped.
 */
export function chunkWhile<T>(items: readonly T[], fits: (chunk: readonly T[]) => boolean): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  for (const item of items) {
    if (current.length > 0 && !fits([...current, item])) {
      chunks.push(current);
      current = [];
    }
    current.push(item);
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

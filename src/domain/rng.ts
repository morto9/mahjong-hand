/**
 * Deterministic pseudo-random source.
 *
 * A seeded RNG rather than `Math.random` for two reasons: domain tests need
 * reproducible deals, and a shareable "seed of the day" mode becomes a config
 * change rather than a rewrite.
 */

export interface Rng {
  /** Float in [0, 1). Advances the generator. */
  next(): number;
  /**
   * Current internal state. Storing this in `GameState` after each transition is
   * what keeps the reducer pure: the same state plus the same action always
   * produces the same next state, even though the generator itself is mutable.
   */
  readonly state: number;
}

/**
 * Mulberry32 — small, fast, good enough distribution for shuffling a wall.
 * Pass `state` to resume a generator exactly where a previous one left off.
 */
export function createRng(state: number): Rng {
  let current = state >>> 0;
  return {
    get state() {
      return current;
    },
    next() {
      current = (current + 0x6d2b79f5) >>> 0;
      let t = current;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Fisher–Yates. Returns a new array; the input is left untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * Dealing a hand: draw N tiles and snapshot what they are worth right now.
 */
import type { GameConfig } from './config';
import { draw, type DrawResult } from './deck';
import type { Rng } from './rng';
import type { DeckState, Hand, TileValueTable } from './types';
import { totalOf } from './values';

let handCounter = 0;

export interface DealResult {
  readonly hand: Hand;
  readonly deck: DeckState;
  readonly didReshuffle: boolean;
}

export function dealHand(
  deck: DeckState,
  values: TileValueTable,
  config: GameConfig,
  rng: Rng,
): DealResult {
  const result: DrawResult = draw(deck, config.handSize, rng);
  handCounter += 1;
  return {
    hand: {
      id: `hand-${handCounter}`,
      tiles: result.tiles,
      total: totalOf(result.tiles, values),
    },
    deck: result.deck,
    didReshuffle: result.didReshuffle,
  };
}

/** Test hook: keeps hand ids deterministic across runs. */
export function resetHandCounter(): void {
  handCounter = 0;
}

/**
 * Moves the counter past `value`, so a restored run keeps minting fresh hand
 * ids rather than reusing ones already sitting in its history.
 */
export function advanceHandCounter(value: number): void {
  handCounter = Math.max(handCounter, value);
}

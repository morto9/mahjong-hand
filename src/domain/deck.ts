/**
 * Draw pile / discard pile management.
 *
 * Reshuffle rule from the brief: when the draw pile is empty, a *fresh* deck is
 * added, combined with the discard pile, and shuffled into the new draw pile.
 * Drawing therefore never fails — but each rebuild is counted, and the third one
 * ends the run.
 */
import { createDeck } from './tiles';
import type { DeckState, Tile } from './types';
import { shuffle, type Rng } from './rng';

export function createDeckState(rng: Rng): DeckState {
  return {
    drawPile: shuffle(createDeck(), rng),
    discardPile: [],
    reshuffleCount: 0,
  };
}

/** Rebuilds the draw pile from a new deck plus everything discarded so far. */
export function reshuffle(deck: DeckState, rng: Rng): DeckState {
  const combined = [...createDeck(), ...deck.drawPile, ...deck.discardPile];
  return {
    drawPile: shuffle(combined, rng),
    discardPile: [],
    reshuffleCount: deck.reshuffleCount + 1,
  };
}

export interface DrawResult {
  readonly deck: DeckState;
  readonly tiles: readonly Tile[];
  /** True when the draw emptied the pile and forced a rebuild. */
  readonly didReshuffle: boolean;
}

/**
 * Draws `count` tiles, reshuffling mid-draw if the pile runs dry.
 *
 * The reshuffle is reported rather than acted upon: the reducer decides whether
 * hitting the limit ends the game, keeping this module purely about tiles.
 */
export function draw(deck: DeckState, count: number, rng: Rng): DrawResult {
  let current = deck;
  let didReshuffle = false;
  const tiles: Tile[] = [];

  for (let i = 0; i < count; i += 1) {
    if (current.drawPile.length === 0) {
      current = reshuffle(current, rng);
      didReshuffle = true;
    }
    const [next, ...rest] = current.drawPile;
    // `rest` can only be empty if the pile was, and a reshuffle just refilled it.
    tiles.push(next as Tile);
    current = { ...current, drawPile: rest };
  }

  return { deck: current, tiles, didReshuffle };
}

/** Moves played tiles onto the discard pile. */
export function discard(deck: DeckState, tiles: readonly Tile[]): DeckState {
  return { ...deck, discardPile: [...deck.discardPile, ...tiles] };
}

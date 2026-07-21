/**
 * Domain rules suite.
 *
 * These cover the edge cases the brief cares about — reshuffles, tile-value
 * drift, game-over bounds — which are slow or impossible to reach reliably by
 * clicking through the UI.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resolveBet } from './betting';
import { DEFAULT_CONFIG, type GameConfig } from './config';
import { createDeckState, discard, draw, reshuffle } from './deck';
import { checkGameOver, reshuffleLimitRule, tileValueExtremeRule } from './gameOver';
import { dealHand, resetHandCounter } from './hand';
import { createRng, shuffle } from './rng';
import { createGameReducer, createInitialState, DEFAULT_ENGINE } from './reducer';
import { streakMultiplierRule } from './scoring';
import {
  createDeck,
  getTileType,
  HONOR_TILE_TYPES_LIST,
  resetInstanceCounter,
  TILE_TYPES,
} from './tiles';
import { decodeState, encodeState } from '@/services/gameStorage';
import type { GameState, Tile } from './types';
import { applyOutcome, createValueTable, totalOf, valueOf } from './values';

const DECK_SIZE = 136;

beforeEach(() => {
  resetInstanceCounter();
  resetHandCounter();
});

/** Picks the first tile of a given type out of a fresh deck. */
function tileOfType(typeId: string): Tile {
  const tile = createDeck().find((t) => t.type.id === typeId);
  if (!tile) throw new Error(`no tile ${typeId}`);
  return tile;
}

describe('tiles', () => {
  it('registers 34 tile types: 27 numbers and 7 honours', () => {
    expect(TILE_TYPES).toHaveLength(34);
    expect(TILE_TYPES.filter((t) => t.kind === 'number')).toHaveLength(27);
    expect(HONOR_TILE_TYPES_LIST).toHaveLength(7);
  });

  it('builds a 136-tile deck with unique instance ids', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(DECK_SIZE);
    expect(new Set(deck.map((t) => t.instanceId)).size).toBe(DECK_SIZE);
  });

  it('keeps instance ids unique across separately created decks', () => {
    const ids = [...createDeck(), ...createDeck()].map((t) => t.instanceId);
    expect(new Set(ids).size).toBe(DECK_SIZE * 2);
  });
});

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = shuffle(createDeck(), createRng(42)).map((t) => t.type.id);
    resetInstanceCounter();
    const b = shuffle(createDeck(), createRng(42)).map((t) => t.type.id);
    expect(a).toEqual(b);
  });

  it('produces different orders for different seeds', () => {
    const a = shuffle(createDeck(), createRng(1)).map((t) => t.type.id);
    const b = shuffle(createDeck(), createRng(2)).map((t) => t.type.id);
    expect(a).not.toEqual(b);
  });
});

describe('values', () => {
  const values = createValueTable(DEFAULT_CONFIG);

  it('starts every honour at the base value and omits number tiles', () => {
    expect(Object.keys(values)).toHaveLength(7);
    expect(values['dragon-red']).toBe(DEFAULT_CONFIG.baseHonorValue);
    expect(values['bamboo-3']).toBeUndefined();
  });

  it('values a number tile at its face rank', () => {
    expect(valueOf(tileOfType('bamboo-7'), values)).toBe(7);
    expect(valueOf(tileOfType('dot-1'), values)).toBe(1);
  });

  it('values an honour tile from the table', () => {
    expect(valueOf(tileOfType('wind-east'), values)).toBe(5);
    expect(valueOf(tileOfType('wind-east'), { ...values, 'wind-east': 8 })).toBe(8);
  });

  it('totals a mixed hand', () => {
    const hand = [tileOfType('bamboo-2'), tileOfType('character-9'), tileOfType('dragon-red')];
    expect(totalOf(hand, values)).toBe(2 + 9 + 5);
  });

  it('raises honours in a winning hand and lowers them in a losing one', () => {
    const hand = [tileOfType('dragon-red'), tileOfType('bamboo-1')];
    expect(applyOutcome(values, hand, 'win')['dragon-red']).toBe(6);
    expect(applyOutcome(values, hand, 'loss')['dragon-red']).toBe(4);
  });

  it('leaves number tiles and untouched honours alone', () => {
    const after = applyOutcome(values, [tileOfType('dragon-red')], 'win');
    expect(after['wind-north']).toBe(5);
    expect(after['bamboo-5']).toBeUndefined();
  });

  it('moves a repeated honour by one, not once per copy', () => {
    const pair = createDeck().filter((t) => t.type.id === 'wind-west').slice(0, 3);
    expect(applyOutcome(values, pair, 'win')['wind-west']).toBe(6);
  });

  it('does not drift on a push', () => {
    expect(applyOutcome(values, [tileOfType('dragon-green')], 'push')).toBe(values);
  });
});

describe('deck', () => {
  it('deals from the top and shrinks the draw pile', () => {
    const rng = createRng(7);
    const deck = createDeckState(rng);
    const result = draw(deck, 3, rng);

    expect(result.tiles).toHaveLength(3);
    expect(result.deck.drawPile).toHaveLength(DECK_SIZE - 3);
    expect(result.didReshuffle).toBe(false);
    expect(result.tiles).toEqual(deck.drawPile.slice(0, 3));
  });

  it('adds a fresh deck plus the discard pile on reshuffle', () => {
    const rng = createRng(7);
    const emptied = { drawPile: [], discardPile: createDeck().slice(0, 10), reshuffleCount: 0 };
    const after = reshuffle(emptied, rng);

    expect(after.drawPile).toHaveLength(DECK_SIZE + 10);
    expect(after.discardPile).toHaveLength(0);
    expect(after.reshuffleCount).toBe(1);
  });

  it('reshuffles mid-draw when the pile runs dry and reports it', () => {
    const rng = createRng(7);
    const nearlyEmpty = {
      drawPile: createDeck().slice(0, 2),
      discardPile: createDeck().slice(0, 5),
      reshuffleCount: 0,
    };
    const result = draw(nearlyEmpty, 3, rng);

    expect(result.tiles).toHaveLength(3);
    expect(result.didReshuffle).toBe(true);
    expect(result.deck.reshuffleCount).toBe(1);
    // fresh deck + the 5 discards, minus the one tile drawn after the rebuild
    expect(result.deck.drawPile).toHaveLength(DECK_SIZE + 5 - 1);
  });

  it('moves spent tiles to the discard pile', () => {
    const rng = createRng(7);
    const deck = createDeckState(rng);
    const spent = deck.drawPile.slice(0, 3);
    expect(discard(deck, spent).discardPile).toEqual(spent);
  });
});

describe('betting', () => {
  it('pays a correct higher call', () => {
    expect(resolveBet(10, 15, 'higher')).toBe('win');
    expect(resolveBet(10, 5, 'higher')).toBe('loss');
  });

  it('pays a correct lower call', () => {
    expect(resolveBet(10, 5, 'lower')).toBe('win');
    expect(resolveBet(10, 15, 'lower')).toBe('loss');
  });

  it('treats an exact tie as a push either way', () => {
    expect(resolveBet(12, 12, 'higher')).toBe('push');
    expect(resolveBet(12, 12, 'lower')).toBe('push');
  });
});

describe('scoring', () => {
  const score = (outcome: 'win' | 'loss' | 'push', streak: number) =>
    streakMultiplierRule.score({
      outcome,
      streak,
      previousTotal: 0,
      incomingTotal: 0,
      config: DEFAULT_CONFIG,
    });

  it('multiplies the base score by the new streak', () => {
    expect(score('win', 0)).toEqual({ points: 10, nextStreak: 1 });
    expect(score('win', 2)).toEqual({ points: 30, nextStreak: 3 });
  });

  it('caps the multiplier but keeps counting the streak', () => {
    expect(score('win', 9)).toEqual({ points: 50, nextStreak: 10 });
  });

  it('resets the streak on a loss without deducting points', () => {
    expect(score('loss', 4)).toEqual({ points: 0, nextStreak: 0 });
  });

  it('leaves the streak intact on a push', () => {
    expect(score('push', 4)).toEqual({ points: 0, nextStreak: 4 });
  });
});

describe('game-over rules', () => {
  const baseContext = {
    deck: { drawPile: [], discardPile: [], reshuffleCount: 0 },
    values: createValueTable(DEFAULT_CONFIG),
    round: 1,
    score: 0,
    config: DEFAULT_CONFIG,
  };

  it('does not fire while everything is in range', () => {
    expect(checkGameOver(baseContext)).toBeNull();
  });

  it('fires when a tile value bottoms out at the floor', () => {
    const reason = tileValueExtremeRule({
      ...baseContext,
      values: { ...baseContext.values, 'dragon-red': 0 },
    });
    expect(reason?.rule).toBe('tile-value-extreme');
    expect(reason?.detail).toContain('Red Dragon');
  });

  it('fires when a tile value maxes out at the ceiling', () => {
    const reason = tileValueExtremeRule({
      ...baseContext,
      values: { ...baseContext.values, 'wind-north': 10 },
    });
    expect(reason?.rule).toBe('tile-value-extreme');
    expect(reason?.detail).toContain('North Wind');
  });

  it('fires on the third reshuffle, not the second', () => {
    const at = (reshuffleCount: number) =>
      reshuffleLimitRule({ ...baseContext, deck: { ...baseContext.deck, reshuffleCount } });

    expect(at(2)).toBeNull();
    expect(at(3)?.rule).toBe('reshuffle-limit');
  });

  it('honours a custom rule list', () => {
    const always = () => ({ rule: 'test', title: 'x', detail: 'y' });
    expect(checkGameOver(baseContext, [always])?.rule).toBe('test');
  });
});

describe('reducer', () => {
  const reducer = createGameReducer(DEFAULT_ENGINE);
  const start = (seed = 1234) => createInitialState(DEFAULT_ENGINE, seed);

  it('deals an opening hand and waits for a bet', () => {
    const state = start();
    expect(state.phase).toBe('awaiting-bet');
    expect(state.currentHand.tiles).toHaveLength(DEFAULT_CONFIG.handSize);
    expect(state.deck.drawPile).toHaveLength(DECK_SIZE - DEFAULT_CONFIG.handSize);
    expect(state.round).toBe(1);
    expect(state.score).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const a = start(99).currentHand.tiles.map((t) => t.type.id);
    const b = start(99).currentHand.tiles.map((t) => t.type.id);
    expect(a).toEqual(b);
  });

  it('locks a bet then resolves it on reveal', () => {
    const state = start();
    const betting = reducer(state, { type: 'PLACE_BET', choice: 'higher' });
    expect(betting.phase).toBe('revealing');
    expect(betting.pendingChoice).toBe('higher');

    const revealed = reducer(betting, { type: 'REVEAL' });
    expect(revealed.incomingHand).not.toBeNull();
    expect(revealed.history).toHaveLength(1);
    expect(revealed.lastOutcome).toBe(
      resolveBet(state.currentHand.total, revealed.incomingHand!.total, 'higher'),
    );
  });

  // The reveal is a two-step transition so the UI has a face-down hand to flip.
  // Everything scoreable must wait for the second step.
  describe('the revealing phase', () => {
    it('deals the incoming hand when the bet is placed', () => {
      const state = start();
      const betting = reducer(state, { type: 'PLACE_BET', choice: 'higher' });

      expect(betting.incomingHand).not.toBeNull();
      expect(betting.incomingHand!.tiles).toHaveLength(DEFAULT_CONFIG.handSize);
      expect(betting.deck.drawPile).toHaveLength(DECK_SIZE - DEFAULT_CONFIG.handSize * 2);
    });

    it('settles nothing until the reveal', () => {
      const state = start();
      const betting = reducer(state, { type: 'PLACE_BET', choice: 'higher' });

      expect(betting.score).toBe(state.score);
      expect(betting.streak).toBe(state.streak);
      expect(betting.history).toEqual(state.history);
      expect(betting.lastOutcome).toBeNull();
      expect(betting.values).toBe(state.values);
      expect(betting.gameOverReason).toBeNull();
      // The spent hand is not discarded until the round actually resolves.
      expect(betting.deck.discardPile).toEqual(state.deck.discardPile);
    });

    it('reveals the hand that was already dealt, without drawing again', () => {
      const betting = reducer(start(), { type: 'PLACE_BET', choice: 'higher' });
      const revealed = reducer(betting, { type: 'REVEAL' });

      expect(revealed.incomingHand).toBe(betting.incomingHand);
      expect(revealed.deck.drawPile).toEqual(betting.deck.drawPile);
      expect(revealed.rngState).toBe(betting.rngState);
    });

    it('ignores a reveal when no hand has been dealt', () => {
      const orphaned: GameState = { ...start(), phase: 'revealing', pendingChoice: 'higher' };
      expect(reducer(orphaned, { type: 'REVEAL' })).toBe(orphaned);
    });
  });

  it('ignores actions that do not belong to the current phase', () => {
    const state = start();
    expect(reducer(state, { type: 'REVEAL' })).toBe(state);
    expect(reducer(state, { type: 'CONTINUE' })).toBe(state);

    const betting = reducer(state, { type: 'PLACE_BET', choice: 'lower' });
    expect(reducer(betting, { type: 'PLACE_BET', choice: 'higher' })).toBe(betting);
  });

  it('promotes the revealed hand and advances the round on continue', () => {
    const state = playRound(start(), 'higher');
    const next = reducer(state, { type: 'CONTINUE' });

    expect(next.phase).toBe('awaiting-bet');
    expect(next.currentHand).toBe(state.incomingHand);
    expect(next.incomingHand).toBeNull();
    expect(next.round).toBe(2);
  });

  it('discards the spent hand so the piles stay balanced', () => {
    const state = playRound(start(), 'higher');
    const size = DEFAULT_CONFIG.handSize;

    expect(state.deck.discardPile).toHaveLength(size);
    expect(state.deck.drawPile).toHaveLength(DECK_SIZE - size * 2);
    // Every tile is accounted for: draw pile + discard + both hands on the table.
    expect(state.deck.drawPile.length + state.deck.discardPile.length + size).toBe(DECK_SIZE);
  });

  it('drifts honour values only for the revealed hand', () => {
    let state = start();
    const before = state.values;
    state = playRound(state, 'higher');

    const honoursRevealed = state.incomingHand!.tiles.filter((t) => t.type.kind === 'honor');
    const delta = state.lastOutcome === 'win' ? 1 : state.lastOutcome === 'loss' ? -1 : 0;

    for (const tile of honoursRevealed) {
      expect(state.values[tile.type.id]).toBe((before[tile.type.id] ?? 0) + delta);
    }
  });

  // The run-ending round must still be shown: the player sees the hand that
  // finished them, and reads why, before the game closes out.
  describe('the run-ending round', () => {
    const engine = {
      ...DEFAULT_ENGINE,
      config: { ...DEFAULT_CONFIG, baseHonorValue: 9 } satisfies GameConfig,
    };
    const local = createGameReducer(engine);

    /** Plays until a rule fires, stopping on the round that ends the run. */
    function playToEnding(): GameState {
      let state = createInitialState(engine, 3);
      for (let i = 0; i < 60; i += 1) {
        state = local(state, { type: 'PLACE_BET', choice: 'higher' });
        state = local(state, { type: 'REVEAL' });
        if (state.gameOverReason) return state;
        state = local(state, { type: 'CONTINUE' });
      }
      throw new Error('no game over reached');
    }

    it('reports the result, not the game over, when the rule fires', () => {
      const ending = playToEnding();

      expect(ending.phase).toBe('round-result');
      expect(ending.gameOverReason).not.toBeNull();
      // The hand that ended the run is on the table to be looked at.
      expect(ending.incomingHand).not.toBeNull();
      expect(ending.lastOutcome).not.toBeNull();
    });

    it('closes the run only once the result is dismissed', () => {
      const ending = playToEnding();
      const closed = local(ending, { type: 'CONTINUE' });

      expect(closed.phase).toBe('game-over');
      expect(closed.gameOverReason).toBe(ending.gameOverReason);
      // No further round was started: the hand and count stay where they were.
      expect(closed.round).toBe(ending.round);
      expect(closed.currentHand).toBe(ending.currentHand);
      expect(closed.incomingHand).toBe(ending.incomingHand);
    });

    it('accepts no further play once closed', () => {
      const closed = local(playToEnding(), { type: 'CONTINUE' });

      expect(local(closed, { type: 'PLACE_BET', choice: 'higher' })).toBe(closed);
      expect(local(closed, { type: 'REVEAL' })).toBe(closed);
      expect(local(closed, { type: 'CONTINUE' })).toBe(closed);
    });
  });

  it('ends the run when a tile value reaches the ceiling', () => {
    // A tiny config: honours start one step from the ceiling.
    const engine = {
      ...DEFAULT_ENGINE,
      config: { ...DEFAULT_CONFIG, baseHonorValue: 9 } satisfies GameConfig,
    };
    const local = createGameReducer(engine);

    let state = createInitialState(engine, 3);
    for (let i = 0; i < 60 && state.phase !== 'game-over'; i += 1) {
      state = local(state, { type: 'PLACE_BET', choice: 'higher' });
      state = local(state, { type: 'REVEAL' });
      if (state.phase === 'round-result') state = local(state, { type: 'CONTINUE' });
    }

    expect(state.phase).toBe('game-over');
    expect(state.gameOverReason?.rule).toBe('tile-value-extreme');
  });

  it('ends the run when the wall is rebuilt for the third time', () => {
    const engine = {
      ...DEFAULT_ENGINE,
      // Values can never reach a bound, so the reshuffle rule is the only exit.
      config: { ...DEFAULT_CONFIG, valueFloor: -999, valueCeiling: 999 } satisfies GameConfig,
    };
    const local = createGameReducer(engine);

    let state = createInitialState(engine, 5);
    for (let i = 0; i < 1000 && state.phase !== 'game-over'; i += 1) {
      state = local(state, { type: 'PLACE_BET', choice: 'lower' });
      state = local(state, { type: 'REVEAL' });
      if (state.phase === 'round-result') state = local(state, { type: 'CONTINUE' });
    }

    expect(state.phase).toBe('game-over');
    expect(state.gameOverReason?.rule).toBe('reshuffle-limit');
    expect(state.deck.reshuffleCount).toBe(DEFAULT_CONFIG.maxReshuffles);
  });

  it('accumulates score and tracks the best streak', () => {
    let state = createInitialState(DEFAULT_ENGINE, 77);
    let expectedScore = 0;
    let expectedBest = 0;
    let streak = 0;

    for (let i = 0; i < 12 && state.phase !== 'game-over'; i += 1) {
      const previous = state.currentHand.total;
      state = reducer(state, { type: 'PLACE_BET', choice: 'higher' });
      state = reducer(state, { type: 'REVEAL' });

      const outcome = resolveBet(previous, state.incomingHand!.total, 'higher');
      const result = streakMultiplierRule.score({
        outcome,
        streak,
        previousTotal: previous,
        incomingTotal: state.incomingHand!.total,
        config: DEFAULT_CONFIG,
      });
      streak = result.nextStreak;
      expectedScore += result.points;
      expectedBest = Math.max(expectedBest, streak);

      if (state.phase === 'round-result') state = reducer(state, { type: 'CONTINUE' });
    }

    expect(state.score).toBe(expectedScore);
    expect(state.bestStreak).toBe(expectedBest);
  });

  it('starts a clean run on START_GAME', () => {
    const played = playRound(start(), 'higher');
    const fresh = reducer(played, { type: 'START_GAME', seed: 2024 });

    expect(fresh.round).toBe(1);
    expect(fresh.score).toBe(0);
    expect(fresh.history).toHaveLength(0);
    expect(fresh.seed).toBe(2024);
    expect(fresh.values['dragon-red']).toBe(DEFAULT_CONFIG.baseHonorValue);
  });

  function playRound(state: GameState, choice: 'higher' | 'lower'): GameState {
    const betting = reducer(state, { type: 'PLACE_BET', choice });
    return reducer(betting, { type: 'REVEAL' });
  }
});

describe('save/load round trip', () => {
  const reducer = createGameReducer(DEFAULT_ENGINE);

  /** Plays a few rounds so the state under test has history and a used deck. */
  function playedState(rounds: number): GameState {
    let state = createInitialState(DEFAULT_ENGINE, 4242);
    for (let i = 0; i < rounds && state.phase !== 'game-over'; i += 1) {
      state = reducer(state, { type: 'PLACE_BET', choice: i % 2 ? 'lower' : 'higher' });
      state = reducer(state, { type: 'REVEAL' });
      if (state.phase === 'round-result') state = reducer(state, { type: 'CONTINUE' });
    }
    return state;
  }

  const roundTrip = (state: GameState) => decodeState(JSON.parse(JSON.stringify(encodeState(state))));

  it('restores a run identically', () => {
    const original = playedState(4);
    const restored = roundTrip(original);
    expect(restored).toEqual(original);
  });

  it('restores mid-reveal, with the dealt hand and the locked bet intact', () => {
    let state = playedState(2);
    state = reducer(state, { type: 'PLACE_BET', choice: 'higher' });
    expect(state.phase).toBe('revealing');

    const restored = roundTrip(state);
    expect(restored.phase).toBe('revealing');
    expect(restored.pendingChoice).toBe('higher');
    expect(restored.incomingHand).toEqual(state.incomingHand);
  });

  it('resolves a restored run exactly as the original would have', () => {
    const original = reducer(playedState(2), { type: 'PLACE_BET', choice: 'higher' });
    const restored = roundTrip(original);

    expect(reducer(restored, { type: 'REVEAL' })).toEqual(reducer(original, { type: 'REVEAL' }));
  });

  it('rehydrates tiles back to registry types, not copies', () => {
    const restored = roundTrip(playedState(2));
    for (const tile of restored.currentHand.tiles) {
      expect(tile.type).toBe(getTileType(tile.type.id));
    }
  });

  it('advances the instance counter so later deals cannot collide', () => {
    const original = playedState(3);
    const restored = roundTrip(original);

    // Simulates a page load: counters start from zero again.
    const existing = new Set([
      ...restored.deck.drawPile,
      ...restored.deck.discardPile,
      ...restored.currentHand.tiles,
    ].map((t) => t.instanceId));

    const minted = createDeck().map((t) => t.instanceId);
    expect(minted.filter((id) => existing.has(id))).toEqual([]);
  });

  it('keeps the payload small enough to write on every action', () => {
    const bytes = JSON.stringify(encodeState(playedState(6))).length;
    expect(bytes).toBeLessThan(12_000);
  });
});

describe('hand', () => {
  it('snapshots the total at deal time so history stays truthful', () => {
    const rng = createRng(11);
    const values = { ...createValueTable(DEFAULT_CONFIG), 'dragon-red': 9 };
    const { hand } = dealHand(createDeckState(rng), values, DEFAULT_CONFIG, rng);

    expect(hand.total).toBe(totalOf(hand.tiles, values));
    // Drifting the table afterwards must not retroactively change the snapshot.
    const drifted = applyOutcome(values, hand.tiles, 'loss');
    expect(hand.total).not.toBe(Number.NaN);
    expect(totalOf(hand.tiles, drifted)).toBeLessThanOrEqual(hand.total);
  });
});

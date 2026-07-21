/**
 * Derived views over game state.
 *
 * Keeping these here means a component never recomputes game facts inline, and a
 * change to how something is derived has exactly one home.
 */
import { useMemo } from 'react';

import { HONOR_TILE_TYPES_LIST } from '@/domain/tiles';
import type { HonorTileType, RoundRecord } from '@/domain/types';
import { useGame } from './GameProvider';

export interface DeckStatus {
  readonly drawCount: number;
  readonly discardCount: number;
  readonly reshuffleCount: number;
  readonly maxReshuffles: number;
  /** 0–1, for the draw-pile meter. */
  readonly drawFraction: number;
  /** True once the draw pile is thin enough to warn about. */
  readonly runningLow: boolean;
}

export interface HonorValue {
  readonly type: HonorTileType;
  readonly value: number;
  /** Movement from the starting value, for the up/down indicator. */
  readonly drift: number;
  /** True when this tile is one step from ending the run. */
  readonly atRisk: boolean;
  /** How this tile moved in the round just resolved: +1, -1, or 0. */
  readonly lastMove: number;
}

export function useDeckStatus(): DeckStatus {
  const { state, config } = useGame();
  const { deck } = state;

  return useMemo(() => {
    const drawCount = deck.drawPile.length;
    const total = drawCount + deck.discardPile.length;
    return {
      drawCount,
      discardCount: deck.discardPile.length,
      reshuffleCount: deck.reshuffleCount,
      maxReshuffles: config.maxReshuffles,
      drawFraction: total === 0 ? 0 : drawCount / total,
      runningLow: drawCount <= config.handSize * 4,
    };
  }, [deck, config]);
}

export function useHonorValues(): HonorValue[] {
  const { state, config } = useGame();
  const lastRound = state.history[state.history.length - 1];

  /**
   * Which honour types moved in the round just resolved, and by how much.
   * Read from the round record rather than diffing value tables, so the answer
   * matches exactly what the rules did.
   */
  const lastMoves = useMemo(() => {
    const moves = new Map<string, number>();
    if (!lastRound || state.phase !== 'round-result') return moves;

    const delta = lastRound.outcome === 'win' ? 1 : lastRound.outcome === 'loss' ? -1 : 0;
    if (delta === 0) return moves;

    for (const tile of lastRound.hand.tiles) {
      if (tile.type.kind === 'honor') moves.set(tile.type.id, delta);
    }
    return moves;
  }, [lastRound, state.phase]);

  return useMemo(
    () =>
      HONOR_TILE_TYPES_LIST.map((type) => {
        const value = state.values[type.id] ?? config.baseHonorValue;
        return {
          type,
          value,
          drift: value - config.baseHonorValue,
          atRisk: value <= config.valueFloor + 1 || value >= config.valueCeiling - 1,
          lastMove: lastMoves.get(type.id) ?? 0,
        };
      }),
    [state.values, config, lastMoves],
  );
}

/** Most recent rounds first — the history strip reads newest to oldest. */
export function useRecentHistory(limit = 12): RoundRecord[] {
  const { state } = useGame();
  return useMemo(() => state.history.slice(-limit).reverse(), [state.history, limit]);
}

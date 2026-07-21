/**
 * Tile valuation and the dynamic drift of honour tiles.
 *
 * Rules:
 *  - a number tile is always worth its rank;
 *  - a dragon or wind starts at `baseHonorValue` and moves +1 when it appears in
 *    a winning hand, -1 when it appears in a losing hand, and not at all on a push;
 *  - drift is per tile *type*, so all four Red Dragons share one value.
 */
import type { GameConfig } from './config';
import { HONOR_TILE_TYPES_LIST } from './tiles';
import type { BetOutcome, Tile, TileValueTable } from './types';

/** Fresh table with every honour tile at its base value. */
export function createValueTable(config: GameConfig): TileValueTable {
  const table: Record<string, number> = {};
  for (const type of HONOR_TILE_TYPES_LIST) {
    table[type.id] = config.baseHonorValue;
  }
  return table;
}

/** The current worth of a single tile. The only place value is derived. */
export function valueOf(tile: Tile, values: TileValueTable): number {
  if (tile.type.kind === 'number') return tile.type.rank;
  return values[tile.type.id] ?? 0;
}

/** Sum of a set of tiles under the given value table. */
export function totalOf(tiles: readonly Tile[], values: TileValueTable): number {
  return tiles.reduce((sum, tile) => sum + valueOf(tile, values), 0);
}

/**
 * Applies one round's outcome to the value table.
 *
 * A tile type present multiple times in the hand still moves by one: the rule is
 * "this tile was part of a winning hand", not "once per copy".
 */
export function applyOutcome(
  values: TileValueTable,
  tiles: readonly Tile[],
  outcome: BetOutcome,
): TileValueTable {
  if (outcome === 'push') return values;

  const delta = outcome === 'win' ? 1 : -1;
  const affected = new Set(
    tiles.filter((tile) => tile.type.kind === 'honor').map((tile) => tile.type.id),
  );
  if (affected.size === 0) return values;

  const next: Record<string, number> = { ...values };
  for (const typeId of affected) {
    next[typeId] = (next[typeId] ?? 0) + delta;
  }
  return next;
}

/** Honour values that have hit a game-ending bound, if any. */
export function extremeValues(
  values: TileValueTable,
  config: GameConfig,
): { typeId: string; value: number }[] {
  return Object.entries(values)
    .filter(([, value]) => value <= config.valueFloor || value >= config.valueCeiling)
    .map(([typeId, value]) => ({ typeId, value }));
}

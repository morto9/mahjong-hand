/**
 * Game-over conditions as a registry of independent predicates.
 *
 * Adding a new way to lose ("survive 20 rounds", "score below zero") means
 * appending one function to `GAME_OVER_RULES`. The reducer runs them in order
 * after every resolved round and stops at the first that fires.
 */
import type { GameConfig } from './config';
import { getTileType } from './tiles';
import type { DeckState, GameOverReason, TileValueTable } from './types';
import { extremeValues } from './values';

/** The slice of state a game-over rule is allowed to inspect. */
export interface GameOverContext {
  readonly deck: DeckState;
  readonly values: TileValueTable;
  readonly round: number;
  readonly score: number;
  readonly config: GameConfig;
}

export type GameOverRule = (context: GameOverContext) => GameOverReason | null;

/** Any dragon or wind whose drifting value has hit the floor or the ceiling. */
export const tileValueExtremeRule: GameOverRule = ({ values, config }) => {
  const extremes = extremeValues(values, config);
  const first = extremes[0];
  if (!first) return null;

  const label = getTileType(first.typeId).label;
  const direction = first.value <= config.valueFloor ? 'bottomed out' : 'maxed out';
  return {
    rule: 'tile-value-extreme',
    title: 'Tile out of balance',
    detail: `The ${label} ${direction} at ${first.value}. A tile that reaches ${config.valueFloor} or ${config.valueCeiling} ends the run.`,
  };
};

/** The wall has been rebuilt too many times. */
export const reshuffleLimitRule: GameOverRule = ({ deck, config }) => {
  if (deck.reshuffleCount < config.maxReshuffles) return null;
  return {
    rule: 'reshuffle-limit',
    title: 'The wall is spent',
    detail: `The draw pile ran out for the ${ordinal(config.maxReshuffles)} time. No more tiles to deal.`,
  };
};

/** Evaluated in order; the first match ends the game. */
export const GAME_OVER_RULES: readonly GameOverRule[] = [reshuffleLimitRule, tileValueExtremeRule];

export function checkGameOver(
  context: GameOverContext,
  rules: readonly GameOverRule[] = GAME_OVER_RULES,
): GameOverReason | null {
  for (const rule of rules) {
    const reason = rule(context);
    if (reason) return reason;
  }
  return null;
}

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = n % 100;
  return `${n}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

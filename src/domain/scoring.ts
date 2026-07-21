/**
 * Scoring is a strategy, not an `if`.
 *
 * Swap `streakMultiplierRule` for another `ScoringRule` (or pick one per
 * difficulty) and the rest of the game is unaffected.
 */
import type { GameConfig } from './config';
import type { BetOutcome } from './types';

export interface ScoringInput {
  readonly outcome: BetOutcome;
  /** Streak *before* this round resolved. */
  readonly streak: number;
  readonly previousTotal: number;
  readonly incomingTotal: number;
  readonly config: GameConfig;
}

export interface ScoringResult {
  readonly points: number;
  readonly nextStreak: number;
}

export interface ScoringRule {
  readonly id: string;
  readonly describe: string;
  score(input: ScoringInput): ScoringResult;
}

/**
 * Default rule: `scoreBase × streak`, where the streak counts this round and is
 * capped by `streakCap`. A loss resets the streak but never ends the run; a push
 * leaves everything untouched.
 */
export const streakMultiplierRule: ScoringRule = {
  id: 'streak-multiplier',
  describe: 'Correct calls score 10 points times your streak, up to 5x.',
  score({ outcome, streak, config }) {
    if (outcome === 'push') return { points: 0, nextStreak: streak };
    if (outcome === 'loss') return { points: 0, nextStreak: 0 };

    const nextStreak = streak + 1;
    const multiplier = Math.min(nextStreak, config.streakCap);
    return { points: config.scoreBase * multiplier, nextStreak };
  },
};

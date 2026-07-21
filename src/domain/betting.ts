/**
 * Bet resolution. Deliberately trivial and deliberately isolated: new bet types
 * (equal, range, double-or-nothing) slot in here without touching the reducer's
 * flow control.
 */
import type { BetChoice, BetOutcome } from './types';

export function resolveBet(
  previousTotal: number,
  incomingTotal: number,
  choice: BetChoice,
): BetOutcome {
  if (incomingTotal === previousTotal) return 'push';
  const wentHigher = incomingTotal > previousTotal;
  const calledHigher = choice === 'higher';
  return wentHigher === calledHigher ? 'win' : 'loss';
}

export const BET_CHOICES: readonly BetChoice[] = ['higher', 'lower'];

/**
 * Rule copy shared between the landing page's "How it plays" panel and the
 * in-game tutorial. Generated from the live config so it can never drift from
 * the rules actually in force. Glyphs come from the tile registry, looked up
 * by the caller against `typeId`.
 */
import type { ReactNode } from 'react';

import type { GameConfig } from './config';

export interface RuleEntry {
  readonly typeId: string;
  readonly body: ReactNode;
}

export function buildRuleCopy(config: GameConfig): RuleEntry[] {
  return [
    {
      typeId: 'dot-1',
      body: (
        <span>
          <strong>Number tiles</strong> are worth their face value, 1 to 9.
        </span>
      ),
    },
    {
      typeId: 'dragon-red',
      body: (
        <span>
          <strong>Dragons and winds</strong> start at {config.baseHonorValue}, rise by 1 in a
          winning hand and fall by 1 in a losing one.
        </span>
      ),
    },
    {
      typeId: 'wind-east',
      body: (
        <span>
          <strong>The run ends</strong> if any honour hits {config.valueFloor} or{' '}
          {config.valueCeiling}, or when the wall is rebuilt for the {config.maxReshuffles}
          {ordinalSuffix(config.maxReshuffles)} time.
        </span>
      ),
    },
    {
      typeId: 'bamboo-1',
      body: (
        <span>
          <strong>Correct calls</strong> score {config.scoreBase} × your streak, up to{' '}
          {config.streakCap}×. Ties are a push.
        </span>
      ),
    },
  ];
}

export function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

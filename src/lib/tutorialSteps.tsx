/**
 * The first-run walkthrough's step data — what each step highlights, and what
 * has to actually happen in the real game before it moves on.
 *
 * `phase-enter` steps deliberately carry no button: they advance only when the
 * player's real action lands (a real bet, a real reveal, a real "Next hand"
 * click), so the walkthrough narrates the player's own first hand rather than
 * a scripted demo running alongside it.
 */
import type { ReactNode } from 'react';

import type { GameConfig } from '@/domain/config';
import { buildRuleCopy } from '@/domain/ruleText';
import type { GamePhase } from '@/domain/types';

export type TutorialPlacement = 'center' | 'below' | 'above' | 'left' | 'right';

export type TutorialAdvance = { type: 'manual' } | { type: 'phase-enter'; phase: GamePhase };

export interface TutorialStep {
  readonly id: string;
  /** `null` for a centered, unanchored step. */
  readonly target: string | null;
  readonly placement: TutorialPlacement;
  readonly title: string;
  readonly body: ReactNode;
  readonly advance: TutorialAdvance;
  /** Button text for a manual step. */
  readonly advanceLabel?: string;
  /** Caption shown instead of a button while waiting on a real game event. */
  readonly waitingHint?: string;
}

export function buildTutorialSteps(config: GameConfig): TutorialStep[] {
  const rules = buildRuleCopy(config);
  const ruleBody = (typeId: string): ReactNode => rules.find((r) => r.typeId === typeId)!.body;

  return [
    {
      id: 'welcome',
      target: null,
      placement: 'center',
      title: 'Welcome to the table',
      body: "Let's play your first hand together.",
      advance: { type: 'manual' },
      advanceLabel: "Let's go",
    },
    {
      id: 'current-hand',
      target: 'current-hand',
      placement: 'below',
      title: 'This is the hand on the table',
      body: ruleBody('dot-1'),
      advance: { type: 'manual' },
      advanceLabel: 'Next',
    },
    {
      id: 'honour-values',
      target: 'honour-values',
      placement: 'right',
      title: 'Dragons and winds drift',
      body: ruleBody('dragon-red'),
      advance: { type: 'manual' },
      advanceLabel: 'Next',
    },
    {
      id: 'bet-controls',
      target: 'bet-controls',
      placement: 'above',
      title: 'Call it',
      body: 'Will the next hand total more, or less, than this one? Go ahead and place a bet.',
      advance: { type: 'phase-enter', phase: 'revealing' },
      waitingHint: 'Place your real bet to continue',
    },
    {
      id: 'revealing',
      target: 'bet-controls',
      placement: 'above',
      title: 'Watch the reveal',
      body: 'The next hand is turning over now.',
      advance: { type: 'phase-enter', phase: 'round-result' },
      waitingHint: 'Watching the reveal…',
    },
    {
      id: 'round-feedback',
      target: 'round-feedback',
      placement: 'above',
      title: 'Here is how it landed',
      body: ruleBody('bamboo-1'),
      advance: { type: 'phase-enter', phase: 'awaiting-bet' },
      waitingHint: 'Click Next hand to continue',
    },
    {
      id: 'run-stats',
      target: 'run-stats',
      placement: 'right',
      title: 'Keep an eye on your run',
      body: ruleBody('wind-east'),
      advance: { type: 'manual' },
      advanceLabel: 'Got it',
    },
  ];
}

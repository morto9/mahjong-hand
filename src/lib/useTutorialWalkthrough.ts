/**
 * Drives the tutorial's step index against the *real* game state.
 *
 * Manual steps only move on `advance()`. `phase-enter` steps only move when
 * `phase` actually transitions into the step's target phase — mirroring
 * `GameProvider.tsx`'s own edge-triggered `previousSeed`/`previousPhase` refs,
 * so a stray re-render with an unchanged phase can never double-advance a step.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { GamePhase } from '@/domain/types';
import type { TutorialStep } from './tutorialSteps';

interface UseTutorialWalkthroughArgs {
  steps: readonly TutorialStep[];
  phase: GamePhase;
  onExit?: () => void;
}

export interface TutorialWalkthrough {
  active: boolean;
  step: TutorialStep | null;
  stepIndex: number;
  totalSteps: number;
  start: () => void;
  advance: () => void;
  skip: () => void;
}

export function useTutorialWalkthrough({
  steps,
  phase,
  onExit,
}: UseTutorialWalkthroughArgs): TutorialWalkthrough {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  const exit = useCallback(() => {
    setActive(false);
    onExit?.();
  }, [onExit]);

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  const advance = useCallback(() => {
    setIndex((current) => {
      if (current >= steps.length - 1) {
        exit();
        return current;
      }
      return current + 1;
    });
  }, [steps.length, exit]);

  const skip = useCallback(() => exit(), [exit]);

  // Edge-triggered against `phase`, same shape as `GameProvider`'s own guards:
  // only fires on an actual transition, never on mount or an unrelated re-render.
  const previousPhase = useRef<GamePhase>(phase);
  useEffect(() => {
    const from = previousPhase.current;
    previousPhase.current = phase;
    if (from === phase) return;
    if (!active) return;

    const step = steps[index];
    if (step?.advance.type === 'phase-enter' && step.advance.phase === phase) advance();
  }, [phase, active, steps, index, advance]);

  const step = active ? (steps[index] ?? null) : null;

  return { active, step, stepIndex: index, totalSteps: steps.length, start, advance, skip };
}

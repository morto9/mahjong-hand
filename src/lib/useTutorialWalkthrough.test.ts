/**
 * `useTutorialWalkthrough` is edge-triggered against `phase`, the same shape
 * as `GameProvider.tsx`'s own `previousSeed`/`previousPhase` refs — these prove
 * `phase-enter` steps only move on a real transition into the matching phase,
 * never on an unrelated change or a re-render that leaves `phase` untouched.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { GamePhase } from '@/domain/types';
import type { TutorialStep } from './tutorialSteps';
import { useTutorialWalkthrough } from './useTutorialWalkthrough';

const STEPS: TutorialStep[] = [
  { id: 'welcome', target: null, placement: 'center', title: 'A', body: 'a', advance: { type: 'manual' } },
  { id: 'bet', target: 'bet-controls', placement: 'above', title: 'B', body: 'b', advance: { type: 'phase-enter', phase: 'revealing' } },
  { id: 'reveal', target: 'bet-controls', placement: 'above', title: 'C', body: 'c', advance: { type: 'phase-enter', phase: 'round-result' } },
  { id: 'done', target: 'run-stats', placement: 'right', title: 'D', body: 'd', advance: { type: 'manual' } },
];

function setup(initialPhase: GamePhase = 'awaiting-bet') {
  const onExit = vi.fn();
  const { result, rerender } = renderHook(
    ({ phase }: { phase: GamePhase }) => useTutorialWalkthrough({ steps: STEPS, phase, onExit }),
    { initialProps: { phase: initialPhase } },
  );
  return { result, rerender, onExit };
}

describe('useTutorialWalkthrough', () => {
  it('starts inactive', () => {
    const { result } = setup();
    expect(result.current.active).toBe(false);
    expect(result.current.step).toBeNull();
  });

  it('start() activates at step 0', () => {
    const { result } = setup();
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.step?.id).toBe('welcome');
  });

  it('a manual step only advances via advance(), never via a phase change alone', () => {
    const { result, rerender } = setup();
    act(() => result.current.start());

    rerender({ phase: 'revealing' });
    // Step 0 is manual — an unrelated phase change must not move it.
    expect(result.current.stepIndex).toBe(0);

    act(() => result.current.advance());
    expect(result.current.stepIndex).toBe(1);
  });

  it('a phase-enter step does not advance on an unmatched phase', () => {
    const { result, rerender } = setup();
    act(() => result.current.start());
    act(() => result.current.advance()); // -> step 1, waits for 'revealing'

    rerender({ phase: 'game-over' });
    expect(result.current.stepIndex).toBe(1);
  });

  it('a phase-enter step advances on the matching transition', () => {
    const { result, rerender } = setup();
    act(() => result.current.start());
    act(() => result.current.advance()); // -> step 1, waits for 'revealing'

    rerender({ phase: 'revealing' });
    expect(result.current.stepIndex).toBe(2);
  });

  it('does not re-fire on a re-render with an unchanged phase', () => {
    const { result, rerender } = setup();
    act(() => result.current.start());
    act(() => result.current.advance());

    rerender({ phase: 'revealing' });
    expect(result.current.stepIndex).toBe(2);

    rerender({ phase: 'revealing' });
    expect(result.current.stepIndex).toBe(2);
  });

  it('skip() calls onExit and deactivates from any step', () => {
    const { result, onExit } = setup();
    act(() => result.current.start());
    act(() => result.current.advance());

    act(() => result.current.skip());
    expect(result.current.active).toBe(false);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('advancing past the final step calls onExit and deactivates', () => {
    const { result, onExit } = setup();
    act(() => result.current.start());
    act(() => result.current.advance()); // 1
    act(() => result.current.advance()); // 2
    act(() => result.current.advance()); // 3 (last)

    act(() => result.current.advance()); // completes
    expect(result.current.active).toBe(false);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('start() after completion resets to step 0 with no storage dependency', () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.skip());

    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.stepIndex).toBe(0);
  });
});

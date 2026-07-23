/**
 * The `newGame` sound cue.
 *
 * It has to be fired from a dedicated effect watching `state.seed`, not folded
 * into the existing phase-transition effect: `phase` alone can't tell a fresh
 * run apart from an ordinary `CONTINUE` — both land on `awaiting-bet`. A
 * phase-only check would have fired on every hand, not just the first. These
 * prove the seed-based distinction actually holds, by driving real dispatches
 * through the provider rather than asserting on the reducer directly.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { audio } from '@/services/audio';
import { GameProvider, useGame } from './GameProvider';

vi.mock('@/services/audio', () => ({
  audio: { play: vi.fn(), setMuted: vi.fn(), muted: false },
}));

/** Exposes real dispatches and the resulting phase, so a test can drive and observe. */
function Harness() {
  const { state, placeBet, continueRound, startGame } = useGame();
  return (
    <div>
      <p data-testid="phase">{state.phase}</p>
      <button onClick={() => startGame()}>start</button>
      <button onClick={() => placeBet('higher')}>bet</button>
      <button onClick={() => continueRound()}>continue</button>
    </div>
  );
}

function renderHarness() {
  render(
    <GameProvider>
      <Harness />
    </GameProvider>,
  );
  return userEvent.setup();
}

const AFTER_REVEAL = { timeout: 3000 };

beforeEach(() => {
  vi.mocked(audio.play).mockClear();
});

describe('the newGame cue', () => {
  it('does not fire on mount — nothing has happened yet', () => {
    renderHarness();
    expect(audio.play).not.toHaveBeenCalledWith('newGame');
  });

  it('fires the moment a run starts, including the very first one', async () => {
    const user = renderHarness();
    await user.click(screen.getByText('start'));
    expect(audio.play).toHaveBeenCalledWith('newGame');
  });

  it('fires again on a second run — this is not a one-shot guard', async () => {
    const user = renderHarness();
    await user.click(screen.getByText('start'));
    await user.click(screen.getByText('start'));
    expect(vi.mocked(audio.play).mock.calls.filter((c) => c[0] === 'newGame')).toHaveLength(2);
  });

  it('stays silent through an ordinary hand — placing a bet and continuing', async () => {
    const user = renderHarness();
    await user.click(screen.getByText('start'));
    vi.mocked(audio.play).mockClear();

    await user.click(screen.getByText('bet'));
    await waitFor(
      () => expect(screen.getByTestId('phase')).toHaveTextContent('round-result'),
      AFTER_REVEAL,
    );
    await user.click(screen.getByText('continue'));

    // This is the case a phase-only check gets wrong: CONTINUE also lands on
    // `awaiting-bet`, same as START_GAME does.
    expect(screen.getByTestId('phase')).toHaveTextContent('awaiting-bet');
    expect(audio.play).not.toHaveBeenCalledWith('newGame');
  });
});

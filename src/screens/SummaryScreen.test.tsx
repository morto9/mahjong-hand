/**
 * The `highScore` cue.
 *
 * `qualifies` is a settled fact by the time this screen mounts — App.tsx
 * computes it from the already-final `state.score` — so the sound is gated
 * entirely on the prop, not on anything this screen derives itself. That
 * makes it cheap to test directly, without constructing a real finished run.
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { audio } from '@/services/audio';
import { GameProvider } from '@/state/GameProvider';
import { SummaryScreen } from './SummaryScreen';

vi.mock('@/services/audio', () => ({
  audio: { play: vi.fn(), setMuted: vi.fn(), muted: false },
}));

function renderSummary(qualifies: boolean) {
  render(
    <GameProvider>
      <SummaryScreen
        qualifies={qualifies}
        onSubmitScore={() => {}}
        onPlayAgain={() => {}}
        onHome={() => {}}
      />
    </GameProvider>,
  );
}

beforeEach(() => {
  vi.mocked(audio.play).mockClear();
});

describe('the highScore cue', () => {
  it('fires once when the score clears the board', () => {
    renderSummary(true);
    expect(audio.play).toHaveBeenCalledWith('highScore');
    expect(vi.mocked(audio.play).mock.calls.filter((c) => c[0] === 'highScore')).toHaveLength(1);
  });

  it('stays silent when it does not qualify', () => {
    renderSummary(false);
    expect(audio.play).not.toHaveBeenCalledWith('highScore');
  });
});

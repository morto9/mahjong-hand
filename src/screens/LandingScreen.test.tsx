/**
 * The landing page and the resume flow.
 *
 * Resume is the feature most likely to rot silently: it depends on module-level
 * counters, a wire format, and an App-level flag that must be withdrawn when a
 * run finishes. A bug in that last part shipped and was caught by hand — these
 * cover it.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App from '@/App';
import { DEFAULT_ENGINE, createGameReducer, createInitialState } from '@/domain/reducer';
import { runStore } from '@/services/gameStorage';
import { leaderboard } from '@/services/leaderboard';
import { statValue } from '@/test/helpers';

/** Seeds a resumable run a few hands in, exactly as the provider would save it. */
function seedSavedRun(rounds = 3) {
  const reducer = createGameReducer(DEFAULT_ENGINE);
  let state = createInitialState(DEFAULT_ENGINE, 20_26);
  for (let i = 0; i < rounds && !state.gameOverReason; i += 1) {
    state = reducer(state, { type: 'PLACE_BET', choice: 'higher' });
    state = reducer(state, { type: 'REVEAL' });
    if (!state.gameOverReason) state = reducer(state, { type: 'CONTINUE' });
  }
  runStore.save(state);
  return state;
}

describe('the landing page', () => {
  it('invites a new game when there is nothing to resume', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('shows placeholder scores to a brand new visitor, not an empty board', () => {
    render(<App />);
    const board = screen.getByText('Top 5').closest('section') as HTMLElement;
    expect(within(board).getAllByRole('listitem')).toHaveLength(5);
    expect(within(board).getByText('Wei')).toBeInTheDocument();
  });

  it('drops the placeholder scores entirely the moment a real one is recorded', () => {
    leaderboard.submit({ name: 'Ren', score: 5, rounds: 1, bestStreak: 1 });

    render(<App />);

    const board = screen.getByText('Top 5').closest('section') as HTMLElement;
    expect(within(board).getAllByRole('listitem')).toHaveLength(1);
    expect(within(board).getByText('Ren')).toBeInTheDocument();
    expect(within(board).queryByText('Wei')).not.toBeInTheDocument();
  });

  it('lists the top five scores, highest first', () => {
    for (const [name, score] of [
      ['Ada', 40],
      ['Bo', 130],
      ['Cy', 70],
      ['Dee', 10],
      ['Eve', 200],
      ['Fen', 5],
    ] as const) {
      leaderboard.submit({ name, score, rounds: 4, bestStreak: 2 });
    }

    render(<App />);
    const board = screen.getByText('Top 5').closest('section') as HTMLElement;
    const names = within(board)
      .getAllByRole('listitem')
      .map((row) => row.textContent);

    expect(names).toHaveLength(5);
    expect(names[0]).toContain('Eve'); // 200
    expect(names[1]).toContain('Bo'); // 130
    expect(names[4]).toContain('Dee'); // 10 — last one to make the cut
    // The lowest score is pushed off the board entirely.
    expect(board.textContent).not.toContain('Fen');
  });

  it('starts a run at hand one', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /new game/i }));

    expect(screen.getByLabelText('Bet Higher')).toBeEnabled();
    expect(statValue('Hand')).toBe('1');
    expect(statValue('Score')).toBe('0');
  });
});

describe('resuming a saved run', () => {
  it('offers the run', () => {
    seedSavedRun();
    render(<App />);

    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('restores the run exactly where it was left', async () => {
    const saved = seedSavedRun();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /resume/i }));

    expect(statValue('Hand')).toBe(String(saved.round));
    expect(statValue('Score')).toBe(String(saved.score));
    expect(statValue('Draw')).toBe(String(saved.deck.drawPile.length));
    expect(statValue('Discard')).toBe(String(saved.deck.discardPile.length));
  });

  it('carries the drifted honour values across', async () => {
    const saved = seedSavedRun(5);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /resume/i }));

    const rail = screen.getByText('Honour values').closest('section') as HTMLElement;
    expect(
      within(rail).getByLabelText(`Red Dragon is worth ${saved.values['dragon-red']}`),
    ).toBeInTheDocument();
  });

  it('discards the saved run when a new game is started instead', async () => {
    seedSavedRun();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /new game/i }));

    expect(statValue('Hand')).toBe('1');
    expect(statValue('Score')).toBe('0');
  });

  it('keeps the run resumable after leaving the table mid-game', async () => {
    // Unrelated to onboarding — skip the auto-starting tutorial so Settings
    // (where "Exit game" lives) is reachable right after "New game".
    localStorage.setItem('jade-wager.tutorial-seen', 'true');
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /new game/i }));
    // Exit lives in the settings menu, which has to be opened first.
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /exit game/i }));

    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });
});

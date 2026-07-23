/**
 * The run ending.
 *
 * The regression guarded here: a round that ends the run used to skip
 * `round-result` and navigate straight to the summary, so the player never saw
 * the hand that finished them or read why. These assert that the ending is
 * shown, and that leaving the board is the player's own decision.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppShell } from '@/App';
import { DEFAULT_CONFIG, type GameConfig } from '@/domain/config';
import { GameProvider } from '@/state/GameProvider';
import { faceUpTiles, table } from '@/test/helpers';

/**
 * Zero permitted reshuffles means `reshuffleLimitRule` fires the moment the
 * first round resolves — a deterministic game over in exactly one hand, with no
 * dependence on which tiles happen to be dealt.
 */
const ENDS_IMMEDIATELY: GameConfig = { ...DEFAULT_CONFIG, maxReshuffles: 0 };

const AFTER_REVEAL = { timeout: 3000 };

function renderApp(config: GameConfig = ENDS_IMMEDIATELY) {
  render(
    <GameProvider config={config}>
      <AppShell hasRestoredRun={false} />
    </GameProvider>,
  );
  return userEvent.setup();
}

/** Starts a run and plays the single hand that ends it. */
async function playTheFinalHand(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /new game/i }));
  await user.click(screen.getByLabelText('Bet Higher'));
  return screen.findByRole('button', { name: /see final score/i }, AFTER_REVEAL);
}

describe('when a run ends', () => {
  it('shows the hand that ended it, resolved, on the board', async () => {
    const user = renderApp();
    await playTheFinalHand(user);

    // Still on the table, with both hands face up to be read.
    expect(table()).toBeInTheDocument();
    expect(faceUpTiles()).toHaveLength(DEFAULT_CONFIG.handSize * 2);
  });

  it('explains why the run is over, alongside the way out', async () => {
    const user = renderApp();
    const dismiss = await playTheFinalHand(user);

    // The explanation must sit in the same panel as the button that leaves it.
    const feedback = dismiss.closest('div') as HTMLElement;
    expect(within(feedback).getByText(/the wall is spent/i)).toBeInTheDocument();
    expect(within(feedback).getByText(/no more tiles to deal/i)).toBeInTheDocument();
  });

  it('announces the ending to screen readers', async () => {
    // Unrelated to onboarding — skip the auto-starting tutorial, which adds
    // its own `role="status"` element and would make this query ambiguous.
    localStorage.setItem('jade-wager.tutorial-seen', 'true');
    const user = renderApp();
    await playTheFinalHand(user);

    expect(screen.getByRole('status')).toHaveTextContent(/the wall is spent/i);
  });

  it('does not jump to the summary on its own', async () => {
    const user = renderApp();
    await playTheFinalHand(user);

    // Exact text: the dismiss button reads "See final score", the summary
    // heading reads "Final score" — only the latter means we have navigated.
    expect(screen.queryByText('Final score')).not.toBeInTheDocument();
    // Give the reveal timer room to fire again if anything were still pending.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByText('Final score')).not.toBeInTheDocument();
    expect(table()).toBeInTheDocument();
  });

  it('goes to the summary when the player dismisses the result', async () => {
    const user = renderApp();
    const dismiss = await playTheFinalHand(user);

    await user.click(dismiss);

    expect(await screen.findByText('Final score')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /table/i })).not.toBeInTheDocument();
  });

  it('reports the run on the summary and offers a way on', async () => {
    const user = renderApp();
    await user.click(await playTheFinalHand(user));

    const summary = (await screen.findByText('Final score')).closest('section') as HTMLElement;
    expect(within(summary).getByText('Hands played')).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: /play again/i })).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: /back to menu/i })).toBeInTheDocument();
  });

  it('stops offering the finished run as resumable', async () => {
    const user = renderApp();
    await user.click(await playTheFinalHand(user));
    await screen.findByText('Final score');

    await user.click(screen.getByRole('button', { name: /back to menu/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /resume run/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('jade-wager.run.v1')).toBeNull();
  });

  it('deals a fresh run on play again', async () => {
    const user = renderApp();
    await user.click(await playTheFinalHand(user));
    await screen.findByText('Final score');

    await user.click(screen.getByRole('button', { name: /play again/i }));

    expect(await screen.findByLabelText('Bet Higher')).toBeEnabled();
    expect(screen.getByText('Hand').parentElement?.textContent).toContain('1');
  });
});

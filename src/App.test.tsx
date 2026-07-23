/**
 * The first-run tutorial, driven end-to-end against a real first hand rather
 * than a scripted demo — every advance in these tests comes from a real click
 * on the real controls, exactly as a player's would.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App from '@/App';

const AFTER_REVEAL = { timeout: 3000 };

async function startNewGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /new game/i }));
}

describe('the first-run tutorial', () => {
  it('walks a brand-new player through their real first hand, then never shows again', async () => {
    const user = userEvent.setup();
    render(<App />);

    await startNewGame(user);

    expect(screen.getByText(/welcome to the table/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /let's go/i }));

    expect(screen.getByText(/this is the hand on the table/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    expect(screen.getByText(/dragons and winds drift/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    // Step 3: waits on a real bet — no advance button, just the real controls.
    expect(screen.getByText(/place your real bet to continue/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Bet Higher'));

    // Auto-advanced into the reveal step without any tutorial-issued click.
    expect(screen.getByText(/watch the reveal/i)).toBeInTheDocument();

    await waitFor(
      () => expect(screen.getByText(/here is how it landed/i)).toBeInTheDocument(),
      AFTER_REVEAL,
    );

    await user.click(screen.getByRole('button', { name: /next hand/i }));

    expect(screen.getByText(/keep an eye on your run/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /got it/i }));

    expect(screen.queryByText(/keep an eye on your run/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('jade-wager.tutorial-seen')).toBe('true');
  });

  it('does not auto-show once the tutorial has already been seen', async () => {
    localStorage.setItem('jade-wager.tutorial-seen', 'true');
    const user = userEvent.setup();
    render(<App />);

    await startNewGame(user);

    expect(screen.queryByText(/welcome to the table/i)).not.toBeInTheDocument();
  });

  it('replaying from the landing page shows it regardless of the seen flag', async () => {
    localStorage.setItem('jade-wager.tutorial-seen', 'true');
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /how to play/i }));

    expect(screen.getByText(/welcome to the table/i)).toBeInTheDocument();
  });

  it('hides the corner Settings control while the tutorial is active', async () => {
    const user = userEvent.setup();
    render(<App />);

    await startNewGame(user);

    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /skip tutorial/i }));

    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });
});

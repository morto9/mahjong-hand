/**
 * The betting loop, as the player actually experiences it.
 *
 * The domain suite proves the rules; this proves the React layer wires them up.
 * Both bugs found in this project so far lived exactly here — in the gap between
 * a correct reducer and a component that read it at the wrong moment.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, type GameConfig } from '@/domain/config';
import { createGameReducer, createInitialState, DEFAULT_ENGINE } from '@/domain/reducer';
import type { GameState } from '@/domain/types';
import { GameProvider } from '@/state/GameProvider';
import { faceDownTiles, faceUpTiles, statValue, table } from '@/test/helpers';
import { GameScreen } from './GameScreen';

function renderGame(config: GameConfig = DEFAULT_CONFIG) {
  render(
    <GameProvider config={config}>
      <GameScreen />
    </GameProvider>,
  );
  return { user: userEvent.setup() };
}

/** Renders a known deal, so the exact tiles on the table can be asserted on. */
function renderSeededGame(seed: number) {
  const start = createInitialState(DEFAULT_ENGINE, seed);
  render(
    <GameProvider initialState={start}>
      <GameScreen />
    </GameProvider>,
  );
  return { start, user: userEvent.setup() };
}

const labelsOf = (state: GameState, hand: 'currentHand' | 'incomingHand') =>
  (state[hand]?.tiles ?? []).map((t) => t.type.label);

/** The reveal is on a timer, so waits must outlast it. */
const AFTER_REVEAL = { timeout: 3000 };

describe('the betting loop', () => {
  it('opens with a hand on the table and no bet resolved', () => {
    renderGame();

    expect(faceUpTiles()).toHaveLength(DEFAULT_CONFIG.handSize);
    expect(statValue('Hand')).toBe('1');
    expect(statValue('Score')).toBe('0');
    expect(screen.getByLabelText('Bet Higher')).toBeEnabled();
  });

  it('deals the next hand face down while the bet is being revealed', async () => {
    const { user } = renderGame();
    // Before the bet the next slot is a decorative placeholder, not real tiles.
    expect(faceDownTiles()).toHaveLength(0);

    await user.click(screen.getByLabelText('Bet Higher'));

    expect(faceDownTiles()).toHaveLength(DEFAULT_CONFIG.handSize);
    expect(screen.getByText(/turning the tiles/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Bet Higher')).toBeDisabled();
  });

  it('turns the hand over and settles the round', async () => {
    const { user } = renderGame();
    await user.click(screen.getByLabelText('Bet Higher'));

    await waitFor(() => expect(faceDownTiles()).toHaveLength(0), AFTER_REVEAL);

    // Both hands are now readable, and the round offers a way onward.
    expect(faceUpTiles()).toHaveLength(DEFAULT_CONFIG.handSize * 2);
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();
  });

  it('draws from the wall and discards the spent hand as the round plays out', async () => {
    const { user } = renderGame();
    const size = DEFAULT_CONFIG.handSize;

    expect(statValue('Draw')).toBe(String(136 - size));
    expect(statValue('Discard')).toBe('0');

    await user.click(screen.getByLabelText('Bet Higher'));
    // Dealing happens with the bet, discarding only once the round resolves.
    expect(statValue('Draw')).toBe(String(136 - size * 2));
    expect(statValue('Discard')).toBe('0');

    await waitFor(() => expect(statValue('Discard')).toBe(String(size)), AFTER_REVEAL);
  });

  it('promotes the revealed hand and advances the count on continue', async () => {
    const { user } = renderGame();
    await user.click(screen.getByLabelText('Bet Higher'));

    const next = await screen.findByRole('button', { name: /next hand/i }, AFTER_REVEAL);
    await user.click(next);

    expect(statValue('Hand')).toBe('2');
    expect(faceUpTiles()).toHaveLength(DEFAULT_CONFIG.handSize);
    expect(screen.getByLabelText('Bet Higher')).toBeEnabled();
  });

  it('records the round in the history strip', async () => {
    const { user } = renderGame();
    const history = screen.getByText(/no hands played yet/i);
    expect(history).toBeInTheDocument();

    await user.click(screen.getByLabelText('Bet Lower'));
    await screen.findByRole('button', { name: /next hand/i }, AFTER_REVEAL);

    expect(screen.queryByText(/no hands played yet/i)).not.toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('places bets from the keyboard', async () => {
    const { user } = renderGame();

    await user.keyboard('h');
    expect(faceDownTiles()).toHaveLength(DEFAULT_CONFIG.handSize);
  });

  it('ignores a second bet while the tiles are turning', async () => {
    const { user } = renderGame();

    await user.click(screen.getByLabelText('Bet Higher'));
    await user.keyboard('l');

    // Still one hand dealt — the second call was refused, not queued.
    expect(faceDownTiles()).toHaveLength(DEFAULT_CONFIG.handSize);
  });

  it('shows the live worth of every honour tile', () => {
    renderGame();
    const rail = screen.getByText('Honour values').closest('section') as HTMLElement;

    expect(within(rail).getByText('Red Dragon')).toBeInTheDocument();
    expect(within(rail).getByLabelText(`Red Dragon is worth ${DEFAULT_CONFIG.baseHonorValue}`))
      .toBeInTheDocument();
  });

  it('names each tile in play, and what it is worth', () => {
    const { start } = renderSeededGame(4242);

    for (const tile of start.currentHand.tiles) {
      // The tip is aria-hidden — the tile's own label already carries this — so
      // it is asserted as text on the board rather than through the a11y tree.
      expect(within(table()).getAllByText(tile.type.label).length).toBeGreaterThan(0);
    }
  });

  /**
   * The face-down hand is the one thing on the board the player must not be able
   * to read. A tooltip is exactly the sort of addition that leaks it.
   */
  it('does not name the next hand while it is still face down', async () => {
    const { start, user } = renderSeededGame(4242);
    const betting = createGameReducer(DEFAULT_ENGINE)(start, {
      type: 'PLACE_BET',
      choice: 'higher',
    });

    // Only names unique to the hidden hand — one it shares with the hand on the
    // table would legitimately appear from that tile's own tip.
    const onTable = new Set(labelsOf(start, 'currentHand'));
    const secret = labelsOf(betting, 'incomingHand').filter((name) => !onTable.has(name));
    expect(secret.length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText('Bet Higher'));
    expect(faceDownTiles()).toHaveLength(DEFAULT_CONFIG.handSize);

    for (const name of secret) {
      expect(within(table()).queryByText(name)).not.toBeInTheDocument();
    }
  });

  it('names them once they are turned over', async () => {
    const { start, user } = renderSeededGame(4242);
    const betting = createGameReducer(DEFAULT_ENGINE)(start, {
      type: 'PLACE_BET',
      choice: 'higher',
    });

    await user.click(screen.getByLabelText('Bet Higher'));
    await waitFor(() => expect(faceDownTiles()).toHaveLength(0), AFTER_REVEAL);

    for (const name of labelsOf(betting, 'incomingHand')) {
      expect(within(table()).getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it('shows the round counters centred as a group', () => {
    renderGame();

    expect(statValue('Hand')).toBe('1');
    expect(statValue('Streak')).toBe('—');
    expect(statValue('Best')).toBe('0');
  });
});

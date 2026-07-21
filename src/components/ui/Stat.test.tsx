/**
 * `Stat`'s count-up runs on requestAnimationFrame, which never fires in a
 * background tab. Without a fallback the score would sit frozen on a stale
 * number — so the snap path matters more than the animation does.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Stat } from './Stat';

/** Forces `shouldAnimate()` down its false branch via the reduced-motion query. */
function preferReducedMotion() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

describe('Stat', () => {
  it('renders its label and value', () => {
    render(<Stat label="Score" value={40} />);

    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('snaps straight to the new value when animation is unavailable', () => {
    preferReducedMotion();
    const { rerender } = render(<Stat label="Score" value={0} countUp />);

    rerender(<Stat label="Score" value={120} countUp />);

    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('passes non-numeric values through untouched', () => {
    render(<Stat label="Streak" value="—" countUp />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('reaches the target value when counting up', async () => {
    const { rerender } = render(<Stat label="Score" value={0} countUp />);

    rerender(<Stat label="Score" value={90} countUp />);

    expect(await screen.findByText('90')).toBeInTheDocument();
  });
});

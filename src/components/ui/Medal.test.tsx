import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Medal, type MedalPlace } from './Medal';

describe('Medal', () => {
  it('announces its place — the digit it replaces is gone', () => {
    for (const [place, label] of [
      [1, '1st place'],
      [2, '2nd place'],
      [3, '3rd place'],
    ] as [MedalPlace, string][]) {
      const { unmount } = render(<Medal place={place} />);
      expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
      unmount();
    }
  });

  it('carries a distinct tier class per place', () => {
    const classOf = (place: MedalPlace) => {
      const { container, unmount } = render(<Medal place={place} />);
      const cls = (container.firstElementChild as HTMLElement).className;
      unmount();
      return cls;
    };

    const [gold, silver, bronze] = ([1, 2, 3] as MedalPlace[]).map(classOf);
    expect(new Set([gold, silver, bronze]).size).toBe(3);
  });
});

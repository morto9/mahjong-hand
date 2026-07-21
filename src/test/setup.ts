import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { resetHandCounter } from '@/domain/hand';
import { resetInstanceCounter } from '@/domain/tiles';

beforeEach(() => {
  // Every test starts from a clean slate: no saved run, no leaderboard, and
  // deterministic tile and hand ids.
  localStorage.clear();
  resetInstanceCounter();
  resetHandCounter();
});

afterEach(cleanup);

/**
 * jsdom implements neither of these, and components legitimately use both.
 * Stubbing here keeps the mocks out of individual tests.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 16)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
}

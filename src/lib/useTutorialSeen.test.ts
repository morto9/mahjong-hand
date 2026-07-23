import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTutorialSeen } from './useTutorialSeen';

beforeEach(() => {
  localStorage.clear();
});

describe('useTutorialSeen', () => {
  it('defaults to false when nothing is stored', () => {
    const { result } = renderHook(() => useTutorialSeen());
    expect(result.current.seen).toBe(false);
  });

  it('markSeen persists to localStorage', () => {
    const { result } = renderHook(() => useTutorialSeen());
    act(() => result.current.markSeen());

    expect(result.current.seen).toBe(true);
    expect(localStorage.getItem('jade-wager.tutorial-seen')).toBe('true');
  });

  it('survives a remount', () => {
    const first = renderHook(() => useTutorialSeen());
    act(() => first.result.current.markSeen());

    const second = renderHook(() => useTutorialSeen());
    expect(second.result.current.seen).toBe(true);
  });

  it('tolerates a throwing localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useTutorialSeen());
    expect(() => act(() => result.current.markSeen())).not.toThrow();
    expect(result.current.seen).toBe(true);

    spy.mockRestore();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runStore } from '@/services/gameStorage';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('the wall collapsed');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors to the console; silence the expected noise.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom has no navigation, so reloads must be stubbed.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    });
  });

  it('renders its children when nothing goes wrong', () => {
    render(
      <ErrorBoundary>
        <p>the table is fine</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('the table is fine')).toBeInTheDocument();
  });

  it('catches a render crash and reports it', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/the table tipped over/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('surfaces the underlying message for diagnosis', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('the wall collapsed')).toBeInTheDocument();
  });

  it('offers a plain reload', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: /^reload$/i }));
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it('can discard a saved run, so a bad save cannot trap the player', async () => {
    localStorage.setItem('jade-wager.run.v1', '{"version":1,"nonsense":true}');
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: /discard saved run/i }));

    expect(runStore.has()).toBe(false);
    expect(localStorage.getItem('jade-wager.run.v1')).toBeNull();
    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});

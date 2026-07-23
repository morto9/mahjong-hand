import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { TutorialStep } from '@/lib/tutorialSteps';
import { TutorialOverlay } from './TutorialOverlay';

const manualStep: TutorialStep = {
  id: 'current-hand',
  target: 'current-hand',
  placement: 'below',
  title: 'This is the hand on the table',
  body: 'body copy',
  advance: { type: 'manual' },
  advanceLabel: 'Next',
};

const waitingStep: TutorialStep = {
  id: 'bet-controls',
  target: 'bet-controls',
  placement: 'above',
  title: 'Call it',
  body: 'body copy',
  advance: { type: 'phase-enter', phase: 'revealing' },
  waitingHint: 'Place your real bet to continue',
};

const centeredStep: TutorialStep = {
  id: 'welcome',
  target: null,
  placement: 'center',
  title: 'Welcome',
  body: 'body copy',
  advance: { type: 'manual' },
  advanceLabel: "Let's go",
};

function renderWithTarget(step: TutorialStep, targetId = 'current-hand') {
  const onAdvance = vi.fn();
  const onSkip = vi.fn();
  render(
    <div>
      <div data-tutorial-target={targetId} />
      <TutorialOverlay step={step} stepIndex={0} totalSteps={4} onAdvance={onAdvance} onSkip={onSkip} />
    </div>,
  );
  return { onAdvance, onSkip };
}

describe('TutorialOverlay', () => {
  it('positions a spotlight against the real target element', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 50,
      bottom: 140,
      right: 250,
      width: 200,
      height: 40,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    const { container } = render(
      <div>
        <div data-tutorial-target="current-hand" />
        <TutorialOverlay step={manualStep} stepIndex={0} totalSteps={4} onAdvance={vi.fn()} onSkip={vi.fn()} />
      </div>,
    );

    const spotlight = container.querySelector('[class*="spotlight"]') as HTMLElement;
    expect(spotlight).toBeTruthy();
    expect(spotlight.style.top).toBe('92px'); // 100 - 8px padding
    expect(spotlight.style.left).toBe('42px'); // 50 - 8px padding
  });

  it('renders no spotlight for a centered step with no target', () => {
    const { container } = render(
      <TutorialOverlay step={centeredStep} stepIndex={0} totalSteps={4} onAdvance={vi.fn()} onSkip={vi.fn()} />,
    );
    expect(container.querySelector('[class*="spotlight"]')).toBeNull();
  });

  it('Escape calls onSkip', async () => {
    const user = userEvent.setup();
    const { onSkip } = renderWithTarget(manualStep);

    await user.keyboard('{Escape}');

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('the Skip tutorial button calls onSkip', async () => {
    const user = userEvent.setup();
    const { onSkip } = renderWithTarget(manualStep);

    await user.click(screen.getByRole('button', { name: /skip tutorial/i }));

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('a manual step renders an advance button that calls onAdvance', async () => {
    const user = userEvent.setup();
    const { onAdvance } = renderWithTarget(manualStep);

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it('a waiting-hint step renders no advance button, only the hint', () => {
    renderWithTarget(waitingStep, 'bet-controls');

    expect(screen.getByText(/place your real bet to continue/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });
});

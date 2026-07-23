/**
 * The first-run walkthrough's on-screen half: a dimmed backdrop with a
 * spotlight cut-out around the real element being explained, plus a callout
 * bubble beside it.
 *
 * The spotlight has `pointer-events: none`, so the real element underneath —
 * the actual Higher/Lower buttons, the actual "Next hand" button — stays
 * clickable through the hole. That is what keeps this a walkthrough over the
 * player's real first hand rather than a blocking modal standing in for one.
 *
 * Positioning is measured, not assumed, mirroring `SettingsMenu`'s own
 * measure/resize pattern: find the real target by its `data-tutorial-target`,
 * read its rect, and re-measure on resize or scroll.
 */
import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';

import { Panel } from '@/components/ui/Panel';
import { cx } from '@/lib/cx';
import type { TutorialStep } from '@/lib/tutorialSteps';
import styles from './TutorialOverlay.module.css';

interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
  onSkip: () => void;
}

const MOBILE_QUERY = '(max-width: 1040px)';

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function TutorialOverlay({ step, stepIndex, totalSteps, onAdvance, onSkip }: TutorialOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(MOBILE_QUERY).matches,
  );

  useLayoutEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tutorial-target="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };

    const el = document.querySelector<HTMLElement>(`[data-tutorial-target="${step.target}"]`);
    // jsdom implements neither scrollIntoView nor its options overload.
    el?.scrollIntoView?.({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.target]);

  // A plain resize listener, not `matchMedia`'s own `change` event — the same
  // choice `SettingsMenu` makes for its own responsive logic, since `change`
  // has proven unreliable under some viewport-emulation tooling.
  useEffect(() => {
    const onResize = () => setIsMobile(matchMedia(MOBILE_QUERY).matches);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  const placement = !step.target ? 'center' : isMobile ? 'below' : step.placement;
  const calloutStyle = calloutPosition(rect, placement);

  const handleAdvance = useCallback(() => onAdvance(), [onAdvance]);

  return (
    <div className={cx(styles.overlay, !rect && styles.dimAll)}>
      {rect && (
        <div
          className={styles.spotlight}
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      )}

      <Panel raised className={cx(styles.callout, styles[placement])} style={calloutStyle}>
        <p className={cx(styles.status, 'sr-only')} role="status" aria-live="polite">
          Step {stepIndex + 1} of {totalSteps}
        </p>
        <p className={styles.title}>{step.title}</p>
        <div className={styles.body}>{step.body}</div>

        <div className={styles.footer}>
          <button type="button" className={styles.skip} onClick={onSkip}>
            Skip tutorial
          </button>

          {step.advance.type === 'manual' ? (
            <button type="button" className={styles.advance} onClick={handleAdvance} autoFocus>
              {step.advanceLabel ?? 'Next'}
            </button>
          ) : (
            <span className={styles.hint}>{step.waitingHint}</span>
          )}
        </div>
      </Panel>
    </div>
  );
}

const SPOTLIGHT_PADDING = 8;
const CALLOUT_GAP = 16;

function calloutPosition(rect: DOMRect | null, placement: TutorialStep['placement']): CSSProperties {
  if (!rect || placement === 'center') return {};

  switch (placement) {
    case 'below':
      return { top: rect.bottom + CALLOUT_GAP, left: rect.left + rect.width / 2 };
    case 'above':
      return { bottom: window.innerHeight - rect.top + CALLOUT_GAP, left: rect.left + rect.width / 2 };
    case 'left':
      return { top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + CALLOUT_GAP };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + CALLOUT_GAP };
    default:
      return {};
  }
}

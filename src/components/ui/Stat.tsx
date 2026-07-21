import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Stat.module.css';
import { cx } from '@/lib/cx';

export type StatTone = 'default' | 'accent' | 'positive' | 'negative';

interface StatProps {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  size?: 'md' | 'lg';
  /** Flashes the value whenever it changes. Off for values that tick constantly. */
  animateChange?: boolean;
  /** Counts numerically up to the new value instead of snapping. */
  countUp?: boolean;
  title?: string;
}

/** Label-over-number readout used across the HUD, deck rail and summary. */
export function Stat({
  label,
  value,
  tone = 'default',
  size = 'md',
  animateChange = false,
  countUp = false,
  title,
}: StatProps) {
  const displayed = useCountUp(value, countUp);
  const bump = useChangeFlash(animateChange ? value : null);

  return (
    <div
      className={cx(styles.stat, size === 'lg' && styles.lg, tone !== 'default' && styles[tone])}
      title={title}
    >
      <span className={styles.label}>{label}</span>
      <span key={bump} className={cx(styles.value, bump > 0 && styles.bump)}>
        {displayed}
      </span>
    </div>
  );
}

/** Frames to spend travelling to a new number. ~380ms at 60fps. */
const COUNT_UP_FRAMES = 23;

function shouldAnimate(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  return true;
}

/**
 * Eases a numeric value towards its target so a score jump reads as an award
 * rather than a substitution. Non-numeric values pass straight through.
 */
function useCountUp(value: ReactNode, enabled: boolean): ReactNode {
  const target = typeof value === 'number' ? value : null;
  const [displayed, setDisplayed] = useState(target ?? 0);
  // Mirrors `displayed` so the effect can read where the animation left off
  // without re-running every frame.
  const displayedRef = useRef(displayed);

  const commit = (next: number) => {
    displayedRef.current = next;
    setDisplayed(next);
  };

  useEffect(() => {
    if (!enabled || target === null) return;

    const from = displayedRef.current;
    if (from === target) return;

    // A hidden tab never fires rAF, and a reduced-motion preference asks for no
    // tweening at all. Both must land on the real number immediately rather than
    // leave a stale one on screen.
    if (!shouldAnimate()) {
      commit(target);
      return;
    }

    let step = 0;
    let frame = 0;
    const travel = target - from;

    const tick = () => {
      step += 1;
      if (step >= COUNT_UP_FRAMES) {
        commit(target);
        return;
      }
      const progress = step / COUNT_UP_FRAMES;
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      commit(Math.round(from + travel * eased));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    // Interrupted mid-count (a fast second win, or unmount): land on the target
    // so the number is never left stranded part-way.
    return () => {
      cancelAnimationFrame(frame);
      displayedRef.current = target;
    };
  }, [target, enabled]);

  if (!enabled || target === null) return value;
  return displayed;
}

/**
 * Returns a counter that increments whenever `value` changes, used as a React
 * key to restart the flash animation. Returns 0 while animation is disabled.
 */
function useChangeFlash(value: ReactNode | null): number {
  const [count, setCount] = useState(0);
  const previous = useRef(value);

  useEffect(() => {
    if (value === null) return;
    if (previous.current !== value) {
      previous.current = value;
      setCount((c) => c + 1);
    }
  }, [value]);

  return count;
}

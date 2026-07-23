import { useEffect, useRef } from 'react';

import type { BetChoice } from '@/domain/types';
import { cx } from '@/lib/cx';
import styles from './BetControls.module.css';

interface BetControlsProps {
  onBet: (choice: BetChoice) => void;
  disabled: boolean;
  /** The choice locked in for the hand currently being revealed. */
  chosen: BetChoice | null;
  prompt: string;
  /** Pulls keyboard focus here when the controls become live again. */
  takeFocus?: boolean;
}

const CHOICES: { choice: BetChoice; arrow: string; word: string; hint: string }[] = [
  { choice: 'lower', arrow: '↓', word: 'Lower', hint: '← or L' },
  { choice: 'higher', arrow: '↑', word: 'Higher', hint: '→ or H' },
];

/** The two primary actions, with keyboard shortcuts wired to the same handler. */
export function BetControls({ onBet, disabled, chosen, prompt, takeFocus }: BetControlsProps) {
  const firstButton = useRef<HTMLButtonElement>(null);

  // After a round is acknowledged the "Next hand" button unmounts and focus
  // falls back to <body>, stranding keyboard players mid-game. Catch it here.
  useEffect(() => {
    if (takeFocus && !disabled) firstButton.current?.focus();
  }, [takeFocus, disabled]);

  useEffect(() => {
    if (disabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const choice: BetChoice | null =
        key === 'arrowup' || key === 'arrowright' || key === 'h'
          ? 'higher'
          : key === 'arrowdown' || key === 'arrowleft' || key === 'l'
            ? 'lower'
            : null;
      if (!choice) return;
      event.preventDefault();
      onBet(choice);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, onBet]);

  return (
    <div className={styles.controls} data-tutorial-target="bet-controls">
      <p className={styles.prompt}>{prompt}</p>
      <div className={styles.buttons}>
        {CHOICES.map(({ choice, arrow, word, hint }, index) => (
          <button
            key={choice}
            ref={index === 0 ? firstButton : undefined}
            type="button"
            className={cx(styles.bet, styles[choice], chosen === choice && styles.chosen)}
            onClick={() => onBet(choice)}
            disabled={disabled}
            aria-label={`Bet ${word}`}
            aria-pressed={chosen === choice}
          >
            <span className={styles.arrow} aria-hidden="true">
              {arrow}
            </span>
            <span className={styles.word}>{word}</span>
            <span className={styles.hint}>{hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

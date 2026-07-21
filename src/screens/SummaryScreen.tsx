import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Stat } from '@/components/ui/Stat';
import { useGame } from '@/state/GameProvider';
import styles from './SummaryScreen.module.css';

interface SummaryScreenProps {
  /** True when this score would land in the visible leaderboard. */
  qualifies: boolean;
  onSubmitScore: (name: string) => void;
  onPlayAgain: () => void;
  onHome: () => void;
}

/** End-of-run report: what ended it, what it was worth, and where to go next. */
export function SummaryScreen({
  qualifies,
  onSubmitScore,
  onPlayAgain,
  onHome,
}: SummaryScreenProps) {
  const { state } = useGame();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmitScore(name);
    setSaved(true);
  };

  const wins = state.history.filter((r) => r.outcome === 'win').length;

  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <div>
          <h1 className={styles.reasonTitle}>{state.gameOverReason?.title ?? 'Run over'}</h1>
          <p className={styles.reasonDetail}>{state.gameOverReason?.detail}</p>
        </div>

        <div className={styles.scoreBlock}>
          <span className={styles.scoreLabel}>Final score</span>
          <span className={styles.scoreValue}>{state.score}</span>
        </div>

        <div className={styles.stats}>
          <Stat label="Hands played" value={state.history.length} />
          <Stat label="Calls won" value={wins} tone="positive" />
          <Stat label="Best streak" value={state.bestStreak} />
          <Stat label="Reshuffles" value={state.deck.reshuffleCount} />
        </div>

        {qualifies && !saved && (
          <div className={styles.qualify}>
            <p className={styles.qualifyTitle}>That score makes the board.</p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={16}
                aria-label="Name for the leaderboard"
                autoFocus
              />
              <Button variant="primary" type="submit">
                Save score
              </Button>
            </form>
          </div>
        )}

        {saved && <p className={styles.saved}>Saved to the leaderboard.</p>}

        <div className={styles.actions}>
          <Button variant="primary" size="lg" onClick={onPlayAgain}>
            Play again
          </Button>
          <Button size="lg" onClick={onHome}>
            Back to menu
          </Button>
        </div>
      </section>
    </main>
  );
}

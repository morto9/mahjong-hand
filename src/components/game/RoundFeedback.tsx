import { Button } from '@/components/ui/Button';
import type { BetOutcome, GameOverReason } from '@/domain/types';
import { cx } from '@/lib/cx';
import styles from './RoundFeedback.module.css';

interface RoundFeedbackProps {
  outcome: BetOutcome;
  points: number;
  streak: number;
  previousTotal: number;
  incomingTotal: number;
  onContinue: () => void;
  /** Set when this round ended the run — the hand is shown, then the reason. */
  gameOverReason?: GameOverReason | null;
}

const HEADLINE: Record<BetOutcome, string> = {
  win: 'Called it',
  loss: 'Missed',
  push: 'Push',
};

/** The result beat: what happened, what it paid, and the way onward. */
export function RoundFeedback({
  outcome,
  points,
  streak,
  previousTotal,
  incomingTotal,
  onContinue,
  gameOverReason = null,
}: RoundFeedbackProps) {
  const delta = incomingTotal - previousTotal;

  return (
    <div className={cx(styles.feedback, styles[outcome], gameOverReason && styles.final)}>
      <p className={styles.headline}>{HEADLINE[outcome]}</p>

      <p className={styles.detail}>
        {outcome === 'push'
          ? `Both hands totalled ${incomingTotal}. Nothing won, nothing lost, your streak survives.`
          : `${incomingTotal} against ${previousTotal}: ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}.`}
      </p>

      {points > 0 && (
        <p className={styles.points}>
          +{points} {streak > 1 && <span>· {streak} in a row</span>}
        </p>
      )}

      {gameOverReason && (
        <div className={styles.ending}>
          <p className={styles.endingTitle}>{gameOverReason.title}</p>
          <p className={styles.endingDetail}>{gameOverReason.detail}</p>
        </div>
      )}

      <Button variant="primary" onClick={onContinue} autoFocus>
        {gameOverReason ? 'See final score' : 'Next hand'}
      </Button>
    </div>
  );
}

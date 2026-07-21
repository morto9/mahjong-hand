import { Panel } from '@/components/ui/Panel';
import { Stat } from '@/components/ui/Stat';
import { cx } from '@/lib/cx';
import { useDeckStatus } from '@/state/useGameSelectors';
import styles from './DeckStatus.module.css';

/** Draw pile, discard pile, and how many rebuilds are left before the run ends. */
export function DeckStatus() {
  const { drawCount, discardCount, reshuffleCount, maxReshuffles, drawFraction, runningLow } =
    useDeckStatus();

  return (
    <Panel title="The wall" className={styles.deck}>
      <div className={styles.piles}>
        <Stat label="Draw" value={drawCount} animateChange tone={runningLow ? 'negative' : 'default'} />
        <Stat label="Discard" value={discardCount} animateChange />
      </div>

      <div className={cx(styles.meter, runningLow && styles.low)} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${Math.round(drawFraction * 100)}%` }} />
      </div>

      <div className={styles.reshuffles}>
        <span className={styles.pips} aria-hidden="true">
          {Array.from({ length: maxReshuffles }, (_, i) => (
            <span key={i} className={cx(styles.pip, i < reshuffleCount && styles.pipUsed)} />
          ))}
        </span>
        <span className={styles.note}>
          {reshuffleCount} of {maxReshuffles} reshuffles used
        </span>
      </div>

      <p className={cx(styles.note, runningLow && styles.warning)}>
        {runningLow
          ? 'The draw pile is nearly out — the next deal may trigger a reshuffle.'
          : 'When the draw pile empties, a fresh deck joins the discards and is reshuffled in.'}
      </p>
    </Panel>
  );
}

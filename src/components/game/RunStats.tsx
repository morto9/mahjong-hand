import { Panel } from '@/components/ui/Panel';
import { Stat } from '@/components/ui/Stat';
import { useGame } from '@/state/GameProvider';
import styles from './RunStats.module.css';

/**
 * How the run is going: the score, and the three counters beneath it.
 *
 * Reads from context like the other rail panels, so the board itself does not
 * have to thread state through.
 */
export function RunStats() {
  const { state } = useGame();

  return (
    <Panel title="This run" className={styles.stats}>
      <div className={styles.score}>
        <Stat label="Score" value={state.score} size="lg" tone="accent" countUp align='center'/>
      </div>

      <div className={styles.counters}>
        <Stat label="Hand" value={state.round} align="center" />
        <Stat
          label="Streak"
          value={state.streak > 0 ? `${state.streak}×` : '—'}
          tone={state.streak > 0 ? 'positive' : 'default'}
          align="center"
          animateChange
        />
        <Stat label="Best" value={state.bestStreak} align="center" />
      </div>
    </Panel>
  );
}

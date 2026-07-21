import type { RoundRecord, TileValueTable } from '@/domain/types';
import { cx } from '@/lib/cx';
import { Tile } from './Tile';
import styles from './HistoryStrip.module.css';

interface HistoryStripProps {
  rounds: readonly RoundRecord[];
  values: TileValueTable;
}

const OUTCOME_LABEL = { win: 'Won', loss: 'Lost', push: 'Push' } as const;

/**
 * Past hands, newest first: miniature tiles plus what the hand beat or missed.
 *
 * Note the tiles are rendered with the *live* value table while the totals come
 * from the record — the tile pips show what a tile is worth now, the totals show
 * what the hand was worth then.
 */
export function HistoryStrip({ rounds, values }: HistoryStripProps) {
  if (rounds.length === 0) {
    return <p className={styles.empty}>No hands played yet — your first call starts the record.</p>;
  }

  return (
    <ol className={styles.strip}>
      {rounds.map((record) => (
        <li key={record.round} className={cx(styles.entry, styles[record.outcome])}>
          <div className={styles.head}>
            <span className={styles.round}>#{record.round}</span>
            <span className={styles.outcome}>{OUTCOME_LABEL[record.outcome]}</span>
          </div>

          <div className={styles.tiles}>
            {record.hand.tiles.map((tile) => (
              <Tile key={tile.instanceId} tile={tile} values={values} size="sm" />
            ))}
          </div>

          <div className={styles.foot}>
            <span className={styles.totals}>
              {record.previousTotal}
              <span className={styles.arrow}>{record.choice === 'higher' ? '↑' : '↓'}</span>
              {record.hand.total}
            </span>
            {record.pointsAwarded > 0 && (
              <span className={styles.points}>+{record.pointsAwarded}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

import { Panel } from '@/components/ui/Panel';
import { cx } from '@/lib/cx';
import { useHonorValues } from '@/state/useGameSelectors';
import styles from './TileValueRail.module.css';

/**
 * Live worth of every dragon and wind.
 *
 * This is the board the player actually plays against — the numbered tiles are
 * fixed, so all the drift, and both loss conditions tied to it, live here.
 */
export function TileValueRail() {
  const honors = useHonorValues();

  return (
    <Panel title="Honour values" fill data-tutorial-target="honour-values">
      <ul className={styles.rail}>
        {honors.map(({ type, value, drift, atRisk, lastMove }) => (
          <li
            key={type.id}
            className={cx(styles.row, atRisk && styles.atRisk, lastMove !== 0 && styles.moved)}
          >
            <span className={cx(styles.glyph, styles[type.family])} aria-hidden="true">
              {type.glyph}
            </span>
            <span className={styles.name}>{type.label}</span>
            <span
              className={cx(
                styles.drift,
                drift > 0 ? styles.up : drift < 0 ? styles.down : styles.flat,
              )}
            >
              {drift > 0 ? `+${drift}` : drift < 0 ? drift : '—'}
            </span>
            <span className={styles.value} aria-label={`${type.label} is worth ${value}`}>
              {value}
              {/* Floats off the number when this tile moves, so the drift is
                  something you watch happen rather than notice later. */}
              {lastMove !== 0 && (
                <span
                  key={`${type.id}-${value}`}
                  className={cx(styles.float, lastMove > 0 ? styles.floatUp : styles.floatDown)}
                  aria-hidden="true"
                >
                  {lastMove > 0 ? '+1' : '−1'}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {/* <p className={styles.legend}>
        Honours start at {config.baseHonorValue}, gain 1 in a winning hand and lose 1 in a losing
        one. Reaching {config.valueFloor} or {config.valueCeiling} ends the run.
      </p> */}
    </Panel>
  );
}

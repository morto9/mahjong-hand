import type { BetOutcome, Hand, TileTypeId, TileValueTable } from '@/domain/types';
import { cx } from '@/lib/cx';
import { Tile, TileBack, type TileSize } from './Tile';
import styles from './HandDisplay.module.css';

/**
 * How the hand arrives.
 * - `deal`   — dealt fresh from the wall (drop and settle)
 * - `slide`  — promoted from the next-hand slot after a round resolved
 * - `none`   — already in place
 */
export type HandEntrance = 'deal' | 'slide' | 'none';

interface HandDisplayProps {
  /** `null` renders a face-down placeholder, holding the slot open. */
  hand: Hand | null;
  values: TileValueTable;
  label: string;
  size?: TileSize;
  /** Number of blanks to show while `hand` is null. */
  tileCount?: number;
  /** Face-down until the reveal lands. */
  hidden?: boolean;
  /** Tints the total once the round has resolved. */
  outcome?: BetOutcome | null;
  baseValue?: number;
  entrance?: HandEntrance;
  /** Honour types one step from ending the run; ringed on the tile face. */
  atRiskTypes?: ReadonlySet<TileTypeId>;
  /**
   * Flips the hand vertically — total, then label, then tiles.
   *
   * Used for the lower of the two hands so the pair mirrors across the `vs`
   * between them, the way two players face each other across a table, instead
   * of repeating the same top-down order twice.
   */
  mirrored?: boolean;
}

/** A hand on the table: its tiles plus the total they were worth when dealt. */
export function HandDisplay({
  hand,
  values,
  label,
  size = 'lg',
  tileCount = 3,
  hidden = false,
  outcome = null,
  baseValue,
  entrance = 'none',
  atRiskTypes,
  mirrored = false,
}: HandDisplayProps) {
  const resolved = !hidden && outcome;

  return (
    <div
      className={cx(
        styles.hand,
        hidden && styles.hidden,
        !hand && styles.awaiting,
        resolved && styles.revealed,
        resolved && styles[outcome],
        entrance === 'slide' && styles.slideIn,
        mirrored && styles.mirrored,
      )}
    >
      <div className={styles.tiles}>
        {hand
          ? hand.tiles.map((tile, index) => (
              <Tile
                key={tile.instanceId}
                tile={tile}
                values={values}
                size={size}
                faceDown={hidden}
                dealt={entrance === 'deal'}
                index={index}
                baseValue={baseValue}
                atRisk={atRiskTypes?.has(tile.type.id) ?? false}
                hoverable={!hidden}
                // Opens toward the middle of the table, whichever way this
                // hand is facing.
                tip={mirrored ? 'above' : 'below'}
              />
            ))
          : Array.from({ length: tileCount }, (_, index) => (
              <TileBack key={index} size={size} index={index} />
            ))}
      </div>

      <div className={styles.caption}>
        <span className={styles.label}>{label}</span>
        <span className={styles.total}>{hand && !hidden ? hand.total : '??'}</span>
      </div>
    </div>
  );
}

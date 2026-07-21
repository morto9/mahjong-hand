import { memo } from 'react';

import type { Tile as TileModel, TileValueTable } from '@/domain/types';
import { valueOf } from '@/domain/values';
import { cx } from '@/lib/cx';
import styles from './Tile.module.css';

export type TileSize = 'sm' | 'md' | 'lg';

interface TileProps {
  tile: TileModel;
  values: TileValueTable;
  size?: TileSize;
  /** Renders the jade back instead of the face. */
  faceDown?: boolean;
  /** Plays the deal-in animation on mount. */
  dealt?: boolean;
  /** Stagger index for the deal animation. */
  index?: number;
  /** Base value used to colour the drift pip; omit to leave it neutral. */
  baseValue?: number;
  /** Ringed in red — this honour is one step from ending the run. */
  atRisk?: boolean;
  /** Lifts on hover. Only the live hands opt in; history minis do not. */
  hoverable?: boolean;
}

/**
 * A blank face-down tile.
 *
 * Holds the next-hand slot open before a bet is placed so the board never
 * reflows when the real hand is dealt into it. Shares markup and sizing with
 * {@link Tile}, so the two occupy identical space.
 */
export function TileBack({ size = 'md', index = 0 }: { size?: TileSize; index?: number }) {
  return (
    <div className={styles.scene}>
      <div
        className={cx(styles.tile, styles[size], styles.faceDown, styles.placeholder)}
        style={{ transitionDelay: `${index * 60}ms` }}
        aria-hidden="true"
      >
        <div className={styles.face} />
        <div className={styles.back} />
      </div>
    </div>
  );
}

/**
 * A single mahjong tile.
 *
 * Every size in the app (hand, history, landing fan) renders this same
 * component — there is no separate "small tile" implementation to keep in sync.
 */
export const Tile = memo(function Tile({
  tile,
  values,
  size = 'md',
  faceDown = false,
  dealt = false,
  index = 0,
  baseValue,
  atRisk = false,
  hoverable = false,
}: TileProps) {
  const value = valueOf(tile, values);
  const suitClass = tile.type.kind === 'number' ? tile.type.suit : tile.type.family;
  const drift = baseValue === undefined || tile.type.kind === 'number' ? 0 : value - baseValue;

  return (
    <div
      className={cx(styles.scene, dealt && styles.dealt, hoverable && styles.hoverable)}
      style={dealt ? { animationDelay: `${index * 70}ms` } : undefined}
    >
      <div
        className={cx(
          styles.tile,
          styles[size],
          faceDown && styles.faceDown,
          atRisk && !faceDown && styles.atRisk,
        )}
        // The flip is staggered so the hand turns over as a wave, not a block.
        style={{ transitionDelay: `${index * 80}ms` }}
        role="img"
        aria-label={faceDown ? 'Face-down tile' : `${tile.type.label}, worth ${value}`}
      >
        <div className={styles.face}>
          <span className={cx(styles.glyph, styles[suitClass])} aria-hidden="true">
            {tile.type.glyph}
          </span>
          <span
            className={cx(styles.value, drift > 0 && styles.valueUp, drift < 0 && styles.valueDown)}
            aria-hidden="true"
          >
            {value}
          </span>
        </div>
        <div className={styles.back} />
      </div>
    </div>
  );
});

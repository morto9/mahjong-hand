import { cx } from '@/lib/cx';
import styles from './Medal.module.css';

export type MedalPlace = 1 | 2 | 3;

/** Metal and label per place, keyed so no arithmetic index can slip past the type. */
const MEDALS: Record<MedalPlace, { tier: keyof typeof styles; ordinal: string }> = {
  1: { tier: 'gold', ordinal: '1st' },
  2: { tier: 'silver', ordinal: '2nd' },
  3: { tier: 'bronze', ordinal: '3rd' },
};

interface MedalProps {
  place: MedalPlace;
  className?: string;
}

/**
 * A small metallic medallion for the top three finishers.
 *
 * Drawn in CSS from the `--medal-*` tokens rather than an emoji: 🥇🥈🥉 render
 * as full-colour glyphs that vary by platform and clash with the game's
 * monochrome, text-presentation tile art. This adapts to the theme and stays
 * crisp at the small size it sits at.
 *
 * The place is announced (`aria-label`), since the visible digit it replaces is
 * gone; the star is decoration and drawn with a pseudo-element so it never lands
 * in the list item's text.
 */
export function Medal({ place, className }: MedalProps) {
  const { tier, ordinal } = MEDALS[place];
  return (
    <span
      className={cx(styles.medal, styles[tier], className)}
      role="img"
      aria-label={`${ordinal} place`}
    />
  );
}

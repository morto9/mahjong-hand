import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { useSound } from '@/lib/useSound';
import { useTheme, type ThemePreference } from '@/lib/useTheme';
import { cx } from '@/lib/cx';
import { Button, type ButtonSize } from './Button';
import styles from './SettingsMenu.module.css';

interface SettingsMenuProps {
  /** Only supplied while a run is on the table. */
  onExitGame?: () => void;
  /** Matches the trigger to the buttons it sits with. Corner placement stays small. */
  size?: ButtonSize;
  /**
   * Which way the menu would rather open. Honoured only where it fits — the
   * measurement below still has the final say, so this cannot push it off screen.
   */
  placement?: 'above' | 'below';
  className?: string;
}

const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

const THEME_ICON: Record<ThemePreference, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
};

/**
 * One control for everything that is not the game itself.
 *
 * Opens on hover, but hover alone would strand keyboard and touch users, so it
 * also opens on click and on focus entering the group, and closes on Escape or
 * a click elsewhere.
 */
export function SettingsMenu({
  onExitGame,
  size = 'sm',
  placement = 'below',
  className,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  /** True when the menu is opening upward — see the measurement below. */
  const [dropUp, setDropUp] = useState(placement === 'above');
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const { preference, cycleTheme } = useTheme();
  const { muted, toggleMuted } = useSound();

  const close = useCallback(() => setOpen(false), []);

  /**
   * Closes only if the pointer or focus really left the whole control.
   *
   * The trap both `mouseleave` and `blur` share: travelling from the trigger
   * into the panel below it must not count as leaving. The panel is a
   * descendant, so browsers report it as `relatedTarget` and the check is
   * trivial — but Safari does not focus buttons on click, and jsdom omits
   * `relatedTarget` altogether. When it is missing, defer a tick and ask where
   * things actually ended up rather than assuming the worst.
   */
  const closeIfLeft = useCallback(
    (event: ReactFocusEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => {
      const movedTo = event.relatedTarget as Node | null;
      if (movedTo) {
        if (!event.currentTarget.contains(movedTo)) close();
        return;
      }
      const wrapperEl = event.currentTarget;
      window.setTimeout(() => {
        if (!wrapperEl.contains(document.activeElement)) close();
      }, 0);
    },
    [close],
  );

  /**
   * Decides which way to open: the caller's preference where it fits, measured
   * rather than assumed.
   *
   * The control is placed differently per screen — tucked into a panel's top
   * corner on the board, in a row of buttons on the landing page, pinned to the
   * bottom corner once the columns stack. A caller can say which way it would
   * rather open, but never gets to force the menu off the screen: the preferred
   * side is used only if the menu actually fits there, otherwise the other side,
   * and if neither fits, whichever has more room.
   */
  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const trigger = wrapper.current;
      const menu = panel.current;
      if (!trigger || !menu) return;

      const { top, bottom } = trigger.getBoundingClientRect();
      const needed = menu.offsetHeight;
      const roomAbove = top;
      const roomBelow = window.innerHeight - bottom;
      const fitsAbove = needed <= roomAbove;
      const fitsBelow = needed <= roomBelow;

      setDropUp(
        placement === 'above'
          ? fitsAbove || (!fitsBelow && roomAbove > roomBelow)
          : !fitsBelow && (fitsAbove || roomAbove > roomBelow),
      );
    };

    measure();
    // The control moves corners at a breakpoint, so a resize while the menu is
    // open can invert the answer. Without this it keeps the direction it opened
    // with and can end up hanging off the top of the window.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, onExitGame, placement]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      // Send focus back to the trigger rather than dropping it on the body.
      wrapper.current?.querySelector('button')?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) close();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return (
    <div
      ref={wrapper}
      className={cx(styles.wrapper, className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={closeIfLeft}
      // Focus moving anywhere inside opens it; leaving the group entirely closes it.
      onFocus={() => setOpen(true)}
      onBlur={closeIfLeft}
    >
      <Button
        variant="ghost"
        size={size}
        className={styles.trigger}
        // Opens rather than toggles: hover and focus have usually opened it
        // already, so a toggle here would read as "clicking closes the menu".
        // Escape, moving away, or a click outside are the ways out.
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Settings"
      >
        <span className={styles.gear} aria-hidden="true">
          ⚙
        </span>
        Settings
      </Button>

      {open && (
        <div ref={panel} className={cx(styles.panel, dropUp && styles.dropUp)}>
          <div className={styles.items} role="group" aria-label="Settings">
            <button type="button" className={styles.item} onClick={toggleMuted} aria-pressed={!muted}>
              <span className={styles.icon} aria-hidden="true">
                {muted ? '🔇' : '🔊'}
              </span>
              Sound
              <span className={styles.state}>{muted ? 'Off' : 'On'}</span>
            </button>

            <button type="button" className={styles.item} onClick={cycleTheme}>
              <span className={styles.icon} aria-hidden="true">
                {THEME_ICON[preference]}
              </span>
              Mode
              <span className={styles.state}>{THEME_LABEL[preference]}</span>
            </button>

            {onExitGame && (
              <>
                <span className={styles.separator} role="presentation" />
                <button
                  type="button"
                  className={cx(styles.item, styles.exit)}
                  onClick={() => {
                    close();
                    onExitGame();
                  }}
                >
                  <span className={styles.icon} aria-hidden="true">
                    ←
                  </span>
                  Exit game
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

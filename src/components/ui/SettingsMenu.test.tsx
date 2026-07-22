/**
 * The settings menu opens on hover, which on its own would strand anyone not
 * using a mouse. These cover the other ways in, and the ways out.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SettingsMenu } from './SettingsMenu';

const trigger = () => screen.getByRole('button', { name: /settings/i });
const isOpen = () => screen.queryByRole('group', { name: /settings/i }) !== null;

describe('SettingsMenu', () => {
  it('starts closed, showing only the trigger', () => {
    render(<SettingsMenu />);

    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(isOpen()).toBe(false);
  });

  it('opens on hover', async () => {
    const user = userEvent.setup();
    render(<SettingsMenu />);

    await user.hover(trigger());

    expect(isOpen()).toBe(true);
    expect(screen.getByRole('button', { name: /sound/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mode/i })).toBeInTheDocument();
  });

  /**
   * Read from the modifier class, not computed style: stylesheets are not loaded
   * in this environment, so every position resolves to `auto` regardless.
   */
  const opensUpward = () => {
    const panel = screen.getByRole('group', { name: /settings/i }).parentElement!;
    return /dropUp/.test(panel.className);
  };

  describe('which way it opens', () => {
    it('drops below by default', async () => {
      const user = userEvent.setup();
      render(<SettingsMenu />);

      await user.hover(trigger());

      expect(opensUpward()).toBe(false);
    });

    it('opens upward when asked to, given the room', async () => {
      const user = userEvent.setup();
      render(<SettingsMenu placement="above" />);

      await user.hover(trigger());

      expect(opensUpward()).toBe(true);
    });

    /**
     * The preference must not be able to push the menu off the top of the
     * window: at the very top of the page there is no room above it at all.
     */
    it('ignores the preference when there is no room for it', async () => {
      const user = userEvent.setup();
      // jsdom lays nothing out, so the menu measures as zero-height and would
      // "fit" anywhere. Give it a real one for the comparison to mean something.
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(180);
      render(<SettingsMenu placement="above" />);
      const wrapper = trigger().parentElement!;
      // Pin the trigger to the top edge, leaving nothing above it.
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 40,
        left: 0,
        right: 100,
        width: 100,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      await user.hover(trigger());

      expect(opensUpward()).toBe(false);
    });
  });

  it('opens on click, for touch and keyboard', async () => {
    const user = userEvent.setup();
    render(<SettingsMenu />);

    await user.click(trigger());

    expect(isOpen()).toBe(true);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SettingsMenu />);

    await user.click(trigger());
    await user.keyboard('{Escape}');

    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveFocus();
  });

  it('toggles the sound preference and reports its state', async () => {
    const user = userEvent.setup();
    render(<SettingsMenu />);
    await user.click(trigger());

    const sound = screen.getByRole('button', { name: /sound/i });
    expect(sound).toHaveTextContent(/on/i);

    await user.click(sound);

    expect(screen.getByRole('button', { name: /sound/i })).toHaveTextContent(/off/i);
    expect(localStorage.getItem('jade-wager.muted')).toBe('true');
  });

  it('cycles the theme through auto, light and dark', async () => {
    const user = userEvent.setup();
    render(<SettingsMenu />);
    await user.click(trigger());

    const theme = () => screen.getByRole('button', { name: /mode/i });
    expect(theme()).toHaveTextContent(/auto/i);

    await user.click(theme());
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.click(theme());
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.click(theme());
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('offers no way out when there is no run to leave', async () => {
    const user = userEvent.setup();
    render(<SettingsMenu />);
    await user.click(trigger());

    expect(screen.queryByRole('button', { name: /exit game/i })).not.toBeInTheDocument();
  });

  it('exits the run and closes itself', async () => {
    const onExitGame = vi.fn();
    const user = userEvent.setup();
    render(<SettingsMenu onExitGame={onExitGame} />);
    await user.click(trigger());

    await user.click(screen.getByRole('button', { name: /exit game/i }));

    expect(onExitGame).toHaveBeenCalledOnce();
    expect(isOpen()).toBe(false);
  });
});

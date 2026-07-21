import { screen, within } from '@testing-library/react';

/**
 * Reads the number out of a `<Stat>` by its label.
 *
 * `Stat` renders the label and value as sibling spans, so the value is whatever
 * is left of the pair's text once the label is removed.
 */
export function statValue(label: string): string {
  const labelNode = screen.getByText(label);
  const text = labelNode.parentElement?.textContent ?? '';
  return text.slice(label.length).trim();
}

/**
 * The board region — the two hands and the action area.
 *
 * Tile queries must be scoped to it: the history strip renders the same `Tile`
 * component, so an unscoped search counts past hands too.
 */
export function table(): HTMLElement {
  return screen.getByRole('region', { name: /table/i });
}

/** Tiles dealt but not yet turned over. Placeholders are aria-hidden, so excluded. */
export function faceDownTiles(scope: HTMLElement = table()): HTMLElement[] {
  return within(scope).queryAllByLabelText('Face-down tile');
}

/** Tiles currently showing their face, by accessible name. */
export function faceUpTiles(scope: HTMLElement = table()): HTMLElement[] {
  return within(scope).queryAllByLabelText(/, worth \d+$/);
}

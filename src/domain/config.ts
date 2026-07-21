/**
 * Single source of truth for every tunable rule.
 *
 * Nothing in the domain hardcodes a number that lives here. A future "difficulty
 * select" or "daily challenge" mode is a matter of passing a different config
 * object through — no rule code has to change.
 */
export interface GameConfig {
  /** Tiles dealt per hand. */
  readonly handSize: number;
  /** Starting value of every dragon and wind. */
  readonly baseHonorValue: number;
  /** Reaching this low value ends the run. */
  readonly valueFloor: number;
  /** Reaching this high value ends the run. */
  readonly valueCeiling: number;
  /** Ending the run once the draw pile has been rebuilt this many times. */
  readonly maxReshuffles: number;
  /** Points for a correct call before the streak multiplier. */
  readonly scoreBase: number;
  /** Streak multiplier stops growing here. */
  readonly streakCap: number;
  /** How many entries the leaderboard keeps. */
  readonly leaderboardSize: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  handSize: 3,
  baseHonorValue: 5,
  valueFloor: 0,
  valueCeiling: 10,
  maxReshuffles: 3,
  scoreBase: 10,
  streakCap: 5,
  leaderboardSize: 5,
};

/**
 * Dev-only config overrides via query string, e.g. `?maxReshuffles=1`.
 *
 * Game-over conditions are otherwise slow to reach by hand, so this exists to
 * make them reachable in a browser. Ignored in production builds.
 */
export function configFromSearchParams(search: string, base: GameConfig = DEFAULT_CONFIG): GameConfig {
  if (!import.meta.env.DEV) return base;

  const params = new URLSearchParams(search);
  const numeric = (key: keyof GameConfig): number | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const overrides: Record<string, number> = {};
  for (const key of Object.keys(base) as (keyof GameConfig)[]) {
    const value = numeric(key);
    if (value !== undefined) overrides[key] = value;
  }
  return { ...base, ...overrides };
}

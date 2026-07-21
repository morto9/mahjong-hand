/**
 * Core domain vocabulary.
 *
 * Everything in `src/domain` is pure: no React, no DOM, no I/O. That keeps the
 * rules of the game testable in isolation and makes the UI a thin projection of
 * this state. When adding a feature, start here.
 */

// ── TILES ─────────────────────────────────────────────────────────────────────

/** The three numbered mahjong suits. Their tiles are worth their face rank. */
export type NumberSuit = 'bamboo' | 'character' | 'dot';

/** Honour families. Their tiles carry a *dynamic* value that drifts as you play. */
export type HonorFamily = 'dragon' | 'wind';

/**
 * Stable identity of a tile *kind* (e.g. `dragon-red`, `bamboo-7`).
 *
 * All four physical copies of a tile share one `typeId`. Dynamic values are keyed
 * by `typeId`, so "the Red Dragon's value" means one number, not four.
 */
export type TileTypeId = string;

/** Identity of a single physical tile in the wall. Unique per copy. */
export type TileInstanceId = string;

interface TileTypeBase {
  readonly id: TileTypeId;
  /** Short human label, e.g. "Red Dragon", "7 Bamboo". */
  readonly label: string;
  /** Unicode mahjong glyph used by the tile face. */
  readonly glyph: string;
  /** How many copies of this tile exist in one deck. */
  readonly copies: number;
}

export interface NumberTileType extends TileTypeBase {
  readonly kind: 'number';
  readonly suit: NumberSuit;
  readonly rank: number;
}

export interface HonorTileType extends TileTypeBase {
  readonly kind: 'honor';
  readonly family: HonorFamily;
}

export type TileType = NumberTileType | HonorTileType;

/** A physical tile in the wall: a type plus a unique instance identity. */
export interface Tile {
  readonly instanceId: TileInstanceId;
  readonly type: TileType;
}

/**
 * Current dynamic value of every honour tile type, keyed by `typeId`.
 * Number tiles are absent — their value is their rank and never changes.
 */
export type TileValueTable = Readonly<Record<TileTypeId, number>>;

// ── HANDS ─────────────────────────────────────────────────────────────────────

/**
 * A dealt hand, frozen at the moment it was scored.
 *
 * `total` is snapshotted rather than recomputed on read: honour values drift, and
 * the history must show what each hand was actually worth when it was played.
 */
export interface Hand {
  readonly id: string;
  readonly tiles: readonly Tile[];
  readonly total: number;
}

// ── BETTING ───────────────────────────────────────────────────────────────────

export type BetChoice = 'higher' | 'lower';

/** `push` is a tie: no score, no value drift, streak preserved. */
export type BetOutcome = 'win' | 'loss' | 'push';

/** One completed round, kept for the history strip and the end-of-game summary. */
export interface RoundRecord {
  readonly round: number;
  readonly hand: Hand;
  readonly choice: BetChoice;
  readonly outcome: BetOutcome;
  /** Total of the hand this one was compared against. */
  readonly previousTotal: number;
  readonly pointsAwarded: number;
}

// ── DECK ──────────────────────────────────────────────────────────────────────

export interface DeckState {
  readonly drawPile: readonly Tile[];
  readonly discardPile: readonly Tile[];
  /** How many times the draw pile has been rebuilt. Drives a game-over rule. */
  readonly reshuffleCount: number;
}

// ── GAME ──────────────────────────────────────────────────────────────────────

/**
 * Where the game is in the round loop. The reveal is a real state rather than a
 * `setTimeout` in a component, so animations render against the store.
 */
export type GamePhase =
  /** Hand on the table, waiting for the player to call higher or lower. */
  | 'awaiting-bet'
  /** Bet locked, next hand drawn and being revealed. */
  | 'revealing'
  /** Outcome shown, waiting for the player to continue. */
  | 'round-result'
  /** Run finished — a game-over rule fired. */
  | 'game-over';

export interface GameOverReason {
  readonly rule: string;
  readonly title: string;
  readonly detail: string;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly deck: DeckState;
  readonly values: TileValueTable;
  /** The hand currently on the table — the one being bet against. */
  readonly currentHand: Hand;
  /** During `revealing`/`round-result`, the freshly drawn hand. */
  readonly incomingHand: Hand | null;
  /** The bet locked in for the incoming hand. */
  readonly pendingChoice: BetChoice | null;
  readonly lastOutcome: BetOutcome | null;
  readonly lastPointsAwarded: number;
  readonly history: readonly RoundRecord[];
  readonly round: number;
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly gameOverReason: GameOverReason | null;
  /** Seed the run was dealt from; lets a run be replayed or shared later. */
  readonly seed: number;
  /** Serialised RNG position, carried in state so the reducer stays pure. */
  readonly rngState: number;
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────

/**
 * Discriminated union consumed by `gameReducer`. Adding a feature usually means
 * adding a member here and one `case` in the reducer — the compiler then points
 * at every place that needs to handle it.
 */
export type GameAction =
  | { type: 'START_GAME'; seed?: number }
  | { type: 'PLACE_BET'; choice: BetChoice }
  | { type: 'REVEAL' }
  | { type: 'CONTINUE' };

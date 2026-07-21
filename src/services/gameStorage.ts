/**
 * Saving and restoring a run in progress.
 *
 * Two things make this more than `JSON.stringify(state)`:
 *
 * 1. **Size.** Every `Tile` carries its full `TileType` object. Serialising both
 *    piles naively is ~50KB per save, written on every action. Tiles go out as
 *    `typeId#ordinal` strings instead and are rehydrated through the tile
 *    registry, which also restores referential identity with `TILE_TYPES`.
 * 2. **Module counters.** `tiles.ts` and `hand.ts` mint ids from module-level
 *    counters that reset to zero on page load. Restoring without advancing them
 *    would mint ids colliding with the restored tiles at the next reshuffle.
 */
import { advanceHandCounter } from '@/domain/hand';
import { advanceInstanceCounter, getTileType, highestInstanceOrdinal } from '@/domain/tiles';
import type {
  BetChoice,
  BetOutcome,
  GameOverReason,
  GamePhase,
  GameState,
  Hand,
  RoundRecord,
  Tile,
  TileValueTable,
} from '@/domain/types';

/** Bumped whenever the shape below changes; older saves are then discarded. */
const SAVE_VERSION = 1;
const STORAGE_KEY = 'jade-wager.run.v1';

// ── Wire format ───────────────────────────────────────────────────────────────

/** `dragon-red#42` — the type to look up, and the unique copy it was. */
type WireTile = string;

interface WireHand {
  id: string;
  tiles: WireTile[];
  total: number;
}

interface WireRound {
  round: number;
  hand: WireHand;
  choice: BetChoice;
  outcome: BetOutcome;
  previousTotal: number;
  pointsAwarded: number;
}

interface WireSave {
  version: number;
  savedAt: number;
  phase: GamePhase;
  drawPile: WireTile[];
  discardPile: WireTile[];
  reshuffleCount: number;
  values: TileValueTable;
  currentHand: WireHand;
  incomingHand: WireHand | null;
  pendingChoice: BetChoice | null;
  lastOutcome: BetOutcome | null;
  lastPointsAwarded: number;
  history: WireRound[];
  round: number;
  score: number;
  streak: number;
  bestStreak: number;
  gameOverReason: GameOverReason | null;
  seed: number;
  rngState: number;
}

// ── Encoding ──────────────────────────────────────────────────────────────────

const encodeTile = (tile: Tile): WireTile => tile.instanceId;
const encodeTiles = (tiles: readonly Tile[]): WireTile[] => tiles.map(encodeTile);

const encodeHand = (hand: Hand): WireHand => ({
  id: hand.id,
  tiles: encodeTiles(hand.tiles),
  total: hand.total,
});

/**
 * `instanceId` is already `${typeId}#${ordinal}`, so it doubles as the wire
 * format — the type is recoverable by splitting on the separator.
 */
function decodeTile(wire: WireTile): Tile {
  const separator = wire.lastIndexOf('#');
  if (separator < 1) throw new Error(`Malformed tile: ${wire}`);
  return { instanceId: wire, type: getTileType(wire.slice(0, separator)) };
}

const decodeTiles = (wire: readonly WireTile[]): Tile[] => wire.map(decodeTile);

const decodeHand = (wire: WireHand): Hand => ({
  id: wire.id,
  tiles: decodeTiles(wire.tiles),
  total: wire.total,
});

export function encodeState(state: GameState): WireSave {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    phase: state.phase,
    drawPile: encodeTiles(state.deck.drawPile),
    discardPile: encodeTiles(state.deck.discardPile),
    reshuffleCount: state.deck.reshuffleCount,
    values: state.values,
    currentHand: encodeHand(state.currentHand),
    incomingHand: state.incomingHand ? encodeHand(state.incomingHand) : null,
    pendingChoice: state.pendingChoice,
    lastOutcome: state.lastOutcome,
    lastPointsAwarded: state.lastPointsAwarded,
    history: state.history.map((record) => ({ ...record, hand: encodeHand(record.hand) })),
    round: state.round,
    score: state.score,
    streak: state.streak,
    bestStreak: state.bestStreak,
    gameOverReason: state.gameOverReason,
    seed: state.seed,
    rngState: state.rngState,
  };
}

export function decodeState(wire: WireSave): GameState {
  const drawPile = decodeTiles(wire.drawPile);
  const discardPile = decodeTiles(wire.discardPile);
  const currentHand = decodeHand(wire.currentHand);
  const incomingHand = wire.incomingHand ? decodeHand(wire.incomingHand) : null;
  const history: RoundRecord[] = wire.history.map((record) => ({
    ...record,
    hand: decodeHand(record.hand),
  }));

  // Push the module counters past everything we just restored.
  advanceInstanceCounter(
    Math.max(
      highestInstanceOrdinal(drawPile),
      highestInstanceOrdinal(discardPile),
      highestInstanceOrdinal(currentHand.tiles),
      incomingHand ? highestInstanceOrdinal(incomingHand.tiles) : 0,
    ),
  );
  advanceHandCounter(handOrdinal(incomingHand?.id ?? currentHand.id));

  return {
    // Every phase restores as-is, including `revealing`: the hand and the bet
    // are both in the save, and GameProvider's reveal timer re-arms on mount,
    // so an interrupted round finishes exactly as it would have.
    phase: wire.phase,
    deck: { drawPile, discardPile, reshuffleCount: wire.reshuffleCount },
    values: wire.values,
    currentHand,
    incomingHand,
    pendingChoice: wire.pendingChoice,
    lastOutcome: wire.lastOutcome,
    lastPointsAwarded: wire.lastPointsAwarded,
    history,
    round: wire.round,
    score: wire.score,
    streak: wire.streak,
    bestStreak: wire.bestStreak,
    gameOverReason: wire.gameOverReason,
    seed: wire.seed,
    rngState: wire.rngState,
  };
}

/** `hand-12` → 12. */
function handOrdinal(id: string): number {
  const parsed = Number(id.split('-')[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export interface RunStore {
  /** The saved run, or null when there is nothing resumable. */
  load(): GameState | null;
  save(state: GameState): void;
  clear(): void;
  has(): boolean;
}

export function createLocalRunStore(
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
): RunStore {
  function readRaw(): WireSave | null {
    if (!storage) return null;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isWireSave(parsed)) return null;
      // A finished run is not resumable — it belongs on the summary screen.
      if (parsed.gameOverReason) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  return {
    has() {
      return readRaw() !== null;
    },

    load() {
      const wire = readRaw();
      if (!wire) return null;
      try {
        const state = decodeState(wire);
        // A save referencing an unknown tile type decodes into a throw above;
        // anything that gets here is structurally sound.
        if (state.currentHand.tiles.length === 0) return null;
        return state;
      } catch {
        // Corrupt or written by an incompatible build — discard it rather than
        // let a bad save brick the landing page.
        this.clear();
        return null;
      }
    },

    save(state) {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(encodeState(state)));
      } catch {
        /* quota or private mode — the run is still playable, just not resumable */
      }
    },

    clear() {
      storage?.removeItem(STORAGE_KEY);
    },
  };
}

function isWireSave(value: unknown): value is WireSave {
  if (typeof value !== 'object' || value === null) return false;
  const save = value as Partial<WireSave>;
  return (
    save.version === SAVE_VERSION &&
    Array.isArray(save.drawPile) &&
    Array.isArray(save.discardPile) &&
    Array.isArray(save.history) &&
    typeof save.round === 'number' &&
    typeof save.score === 'number' &&
    typeof save.rngState === 'number' &&
    typeof save.currentHand === 'object' &&
    save.currentHand !== null
  );
}

/** App-wide singleton, mirroring the leaderboard and audio services. */
export const runStore = createLocalRunStore();

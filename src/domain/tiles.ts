/**
 * The tile registry and deck construction.
 *
 * `TILE_TYPES` is the only place a tile kind is declared. Adding flowers, seasons
 * or a bonus tile means appending entries here — deck building, rendering and
 * valuation all read from this list.
 */
import type { HonorTileType, NumberSuit, NumberTileType, Tile, TileType, TileTypeId } from './types';

/** Copies of each tile in one deck. Standard mahjong: four of everything. */
const COPIES_PER_TYPE = 4;

/**
 * Variation Selector-15, appended to every glyph.
 *
 * U+1F004 (Red Dragon) has emoji presentation by default, so without this it
 * renders as a full-colour emoji while the other 33 tiles render as monochrome
 * outlines. The CSS `font-variant-emoji: text` property is not yet honoured
 * widely enough to rely on, so the selector is baked into the data.
 */
const TEXT_PRESENTATION = '︎';

/** Base codepoint of each numbered suit's "1" glyph, per Unicode's Mahjong Tiles block. */
const SUIT_GLYPH_BASE: Record<NumberSuit, number> = {
  character: 0x1f007,
  bamboo: 0x1f010,
  dot: 0x1f019,
};

const SUIT_LABEL: Record<NumberSuit, string> = {
  character: 'Characters',
  bamboo: 'Bamboo',
  dot: 'Dots',
};

const NUMBER_SUITS: readonly NumberSuit[] = ['character', 'bamboo', 'dot'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function makeNumberType(suit: NumberSuit, rank: number): NumberTileType {
  return {
    kind: 'number',
    id: `${suit}-${rank}`,
    suit,
    rank,
    label: `${rank} ${SUIT_LABEL[suit]}`,
    glyph: String.fromCodePoint(SUIT_GLYPH_BASE[suit] + rank - 1) + TEXT_PRESENTATION,
    copies: COPIES_PER_TYPE,
  };
}

function makeHonorType(
  family: HonorTileType['family'],
  id: string,
  label: string,
  glyph: string,
): HonorTileType {
  return {
    kind: 'honor',
    id,
    family,
    label,
    glyph: glyph + TEXT_PRESENTATION,
    copies: COPIES_PER_TYPE,
  };
}

const NUMBER_TILE_TYPES: readonly NumberTileType[] = NUMBER_SUITS.flatMap((suit) =>
  RANKS.map((rank) => makeNumberType(suit, rank)),
);

const HONOR_TILE_TYPES: readonly HonorTileType[] = [
  makeHonorType('dragon', 'dragon-red', 'Red Dragon', '\u{1F004}'),
  makeHonorType('dragon', 'dragon-green', 'Green Dragon', '\u{1F005}'),
  makeHonorType('dragon', 'dragon-white', 'White Dragon', '\u{1F006}'),
  makeHonorType('wind', 'wind-east', 'East Wind', '\u{1F000}'),
  makeHonorType('wind', 'wind-south', 'South Wind', '\u{1F001}'),
  makeHonorType('wind', 'wind-west', 'West Wind', '\u{1F002}'),
  makeHonorType('wind', 'wind-north', 'North Wind', '\u{1F003}'),
];

/** Every tile kind in the game, numbers first. */
export const TILE_TYPES: readonly TileType[] = [...NUMBER_TILE_TYPES, ...HONOR_TILE_TYPES];

/** Honour tile kinds only — the ones with dynamic, drifting values. */
export const HONOR_TILE_TYPES_LIST: readonly HonorTileType[] = HONOR_TILE_TYPES;

const TILE_TYPES_BY_ID: ReadonlyMap<TileTypeId, TileType> = new Map(
  TILE_TYPES.map((type) => [type.id, type]),
);

export function getTileType(id: TileTypeId): TileType {
  const type = TILE_TYPES_BY_ID.get(id);
  if (!type) throw new Error(`Unknown tile type: ${id}`);
  return type;
}

/**
 * Monotonic counter for instance ids. Instances must stay unique across
 * reshuffles, because a reshuffle mixes a brand new deck into the discard pile
 * and React needs stable, collision-free keys.
 */
let instanceCounter = 0;

/** Builds one full deck (136 tiles with the default registry), in fixed order. */
export function createDeck(): Tile[] {
  const tiles: Tile[] = [];
  for (const type of TILE_TYPES) {
    for (let copy = 0; copy < type.copies; copy += 1) {
      instanceCounter += 1;
      tiles.push({ instanceId: `${type.id}#${instanceCounter}`, type });
    }
  }
  return tiles;
}

/** Test hook: makes instance ids deterministic across runs. */
export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

/**
 * Moves the counter past `value`.
 *
 * Needed when restoring a saved run: the counter is module state and resets to
 * zero on page load, so the next reshuffle would otherwise mint instance ids
 * that collide with the tiles already in the restored piles — duplicate React
 * keys, and tiles that vanish or duplicate on screen.
 */
export function advanceInstanceCounter(value: number): void {
  instanceCounter = Math.max(instanceCounter, value);
}

/** Highest counter value used by a set of tiles, for restoring the counter. */
export function highestInstanceOrdinal(tiles: readonly Tile[]): number {
  return tiles.reduce((max, tile) => {
    const ordinal = Number(tile.instanceId.split('#')[1]);
    return Number.isFinite(ordinal) ? Math.max(max, ordinal) : max;
  }, 0);
}

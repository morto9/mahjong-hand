# Mahjong Hands — Betting Game

A hand betting game played with mahjong tiles. Three tiles are dealt; you call whether the next
hand totals **higher** or **lower**. Numbered tiles are worth their face value, but dragons and
winds drift with every hand they touch — and a tile that drifts too far ends the night.

```bash
npm install
npm run dev        # http://localhost:5174
npm test           # domain rules + component suites (90 tests)
npm run build      # typecheck + production build
```

---

## Rules

| | |
|---|---|
| **Hand** | 3 tiles (`handSize`) |
| **Number tiles** | Worth their face rank, 1–9. Fixed. |
| **Dragons & winds** | Start at **5**. +1 when part of a winning hand, −1 when part of a losing hand. Per tile *type*, so all four Red Dragons share one value. |
| **Betting** | Call higher or lower on the next hand's total. |
| **Scoring** | `10 × streak` for a correct call, multiplier capped at 5×. A wrong call resets the streak but does not end the run. |
| **Ties** | A **push**: no score, no drift, streak preserved. |
| **Reshuffle** | When the draw pile empties, a fresh deck is added, combined with the discard pile, and shuffled into a new draw pile. |
| **Game over** | Any honour value reaches **0** or **10**, or the draw pile is rebuilt for the **3rd** time. |

The deck is the standard 136-tile wall: 3 suits × ranks 1–9 × 4 copies, plus 3 dragons and
4 winds × 4 copies. No flowers or seasons.

---

## Architecture

The core idea: **the game is a pure function, and React only draws it.**

```
src/
  domain/          Pure rules. No React, no DOM, no I/O. 41 unit tests.
  state/           React binding: reducer in context + derived selectors.
  services/        Persistence behind interfaces (leaderboard).
  components/      Presentational: ui/ primitives, tile/ tiles, game/ board pieces.
  screens/         Landing, Game, Summary.
  styles/          Design tokens, global reset, shared keyframes.
```

### The domain layer

| Module | Owns |
|---|---|
| `config.ts` | Every tunable number. Nothing else hardcodes a rule value. |
| `types.ts` | Tile, Hand, DeckState, GameState, and the `GameAction` union. |
| `tiles.ts` | The tile registry and deck construction. |
| `values.ts` | Valuation and honour drift. The only place a tile's worth is derived. |
| `deck.ts` | Draw, discard, reshuffle. |
| `betting.ts` | `resolveBet` → `win` / `loss` / `push`. |
| `scoring.ts` | `ScoringRule` strategy interface + the default streak rule. |
| `gameOver.ts` | A registry of independent lose-condition predicates. |
| `rng.ts` | Seeded Mulberry32. Deterministic deals. |
| `reducer.ts` | Flow only — every rule is delegated to the modules above. |

Services sit alongside, each behind an interface so the implementation can be swapped without
touching a component: `leaderboard.ts` (scores), `gameStorage.ts` (resumable runs), `audio.ts`
(synthesised sound).

### Testing

Two layers, because bugs have shown up in both:

- **Domain tests** (`src/domain/domain.test.ts`) prove the rules — deck exhaustion and reshuffles,
  honour drift, both game-over bounds, scoring, and the save/load round trip. Pure and fast.
- **Component tests** (`src/**/*.test.tsx`, jsdom + Testing Library) prove the React layer wires
  those rules up correctly. Every bug found in this project so far lived in that gap: an animation
  the state machine never reached, a resume button that outlived its saved run, a run that ended
  before the player could see it. Each now has a test.

`services/audio.ts` no-ops when `AudioContext` is missing, which is exactly the jsdom case, so the
component tests need no audio mocking.

### Failure handling

`ErrorBoundary` wraps the app. Its fallback is a recovery path rather than an apology: since the
likeliest cause of a render crash is a saved run this build cannot draw, it offers to discard the
run as well as to reload. A malformed save is also caught earlier and more quietly — `runStore.load`
validates and discards it, so a bad payload never reaches the UI in the first place.

The state machine:

```
awaiting-bet ──PLACE_BET──▶ revealing ──REVEAL──▶ round-result ──CONTINUE──▶ awaiting-bet
              (deals face down)      (turns over)              └─CONTINUE──▶ game-over
```

Dealing and resolving are deliberately separate steps. `PLACE_BET` draws the next hand and leaves
it face down; `REVEAL` turns it over and settles the score, drift, history and game-over check.
That split is what makes the flip animation possible — the tiles are mounted for the whole
`revealing` phase, so turning them over is a transform transition rather than a mount.

**A run always ends on `round-result` first.** When a rule fires, the reason is attached but the
phase does not jump — the player sees the hand that finished them, reads why, and dismisses it.
Only then does `CONTINUE` reach `game-over`. Ending the run and *reporting* it are separate moments
because they are separate moments for the player.

**The reducer is pure.** The RNG position travels in `state.rngState`, so replaying the same
actions against the same starting state reproduces a run exactly — which is what lets the tests
drive a game to its 3rd reshuffle deterministically.

---

## Extending it

Each of these is a local change by design.

**Add a tile kind (flowers, seasons, a joker)**
Append to `TILE_TYPES` in `domain/tiles.ts` with a `copies` count. Deck building, rendering,
valuation and the honour rail all read from that list. If it needs a dynamic value, give it
`kind: 'honor'`; if it needs a *new* valuation rule, add a branch in `values.ts:valueOf`.

**Add a scoring mode**
Implement `ScoringRule` in `domain/scoring.ts` and pass it as `engine.scoringRule`. Nothing else
sees the change.

**Add a game-over condition**
Write a `GameOverRule` (a `context => GameOverReason | null` function) and append it to
`GAME_OVER_RULES` in `domain/gameOver.ts`.

**Add a difficulty / game mode**
Build a `GameConfig` and pass it to `<GameProvider config={...}>`. Hand size, base honour value,
bounds, reshuffle limit and scoring constants are all config.

**Add a bet type (equal, range, double-or-nothing)**
Extend `BetChoice` in `types.ts` and `resolveBet` in `betting.ts`. TypeScript will flag every
switch that needs a new arm.

**Move the leaderboard to a server**
Implement `LeaderboardStore` in `services/leaderboard.ts`. Screens depend on the interface, not on
localStorage. The same applies to `RunStore` and `AudioService`.

**Add a sound**
Add a cue to `SoundCue` in `services/audio.ts` and a `case` for it in `play`. Cues are fired from
phase transitions in `GameProvider`, never from click handlers, so a sound can never disagree with
what the state machine actually did.

**Retheme**
Override the variables in `styles/tokens.css`. No component contains a literal colour.

---

## Continuity

A run in progress is saved to localStorage on every committed state change, and the landing page
offers **Resume run** when one is waiting. Two details make this work:

- Tiles serialise as `typeId#ordinal` strings and rehydrate through the tile registry. Storing the
  full `TileType` on all 136+ tiles would write ~50KB per action; the compact form is under 4KB.
- `tiles.ts` and `hand.ts` mint ids from module-level counters that reset on page load, so restoring
  advances them past everything in the save. Without that, the next reshuffle mints ids colliding
  with restored tiles — duplicate React keys, and tiles that visibly duplicate or vanish.

An interrupted `revealing` phase restores as-is: the dealt hand and the locked bet are both in the
save, and the reveal timer re-arms on mount, so the round finishes exactly as it would have.
A finished run is cleared rather than saved — it belongs on the summary screen.

## UI notes

- **Tiles** are built in CSS — an ivory gradient face with a bevelled rim, an engraved inner
  border, a jade woven back, and a 3D `rotateY` flip on reveal. No image assets. One `Tile`
  component serves every size, so the history strip can never drift from the table.
- Glyphs are the Unicode Mahjong Tiles block with **U+FE0E** (text presentation) appended in the
  registry — without it, U+1F004 (Red Dragon) renders as a colour emoji while the other 33 tiles
  render as monochrome outlines.
- **Theme** follows `prefers-color-scheme`; the toggle cycles auto → light → dark and writes
  `data-theme` on the root, which wins over the media query in both directions.
- **One settings control** holds sound, theme and exit, revealed on hover. Hover alone would strand
  keyboard and touch users, so it also opens on click and on focus, and closes on Escape, on a click
  outside, or when the pointer leaves. "Leaves" is deliberately careful: moving from the trigger into
  the panel below must not count, and Safari (which does not focus buttons on click) and jsdom both
  omit the `relatedTarget` that would say so — so when it is missing, the check defers a tick and
  looks at where focus actually landed.
- **Motion** is centralised in `styles/animations.css` and disabled wholesale under
  `prefers-reduced-motion: reduce`, which also defaults sound to off and makes the score snap
  instead of counting up.
- **The board never reflows mid-round.** The next-hand slot is always occupied — by a face-down
  placeholder before a bet, by the dealt hand after — and the action area reserves the height of
  the taller of its two states.
- **Sound** is synthesised with WebAudio (no asset files): filtered noise for the tile clack,
  intervals for win/loss/push. The `AudioContext` is created on the first gesture, as autoplay
  policy requires.
- **Keyboard**: `←`/`L` calls lower, `→`/`H` calls higher. Round outcomes are announced through an
  `aria-live` region.
- The board is one CSS grid reflowed by breakpoint — there is no separate mobile layout.

---

## Images

Everything in `public/` is generated from a single master logo — a 1254px PNG of about 2.4 MB, which
is not committed and never shipped. To regenerate after the artwork changes:

```powershell
pwsh scripts/build-logo-assets.ps1 -Source "path\to\logo no bg.png"
```

It emits the masthead image, the Apple touch icon, the link-preview card, and — the first time only
— the two favicons. Two decisions are baked into it:

- **The transparent master is the only source needed.** The badge is opaque inside its gold ring, so
  it sits correctly on the dark felt, on the light theme, and on a browser tab alike.
- **`favicon-32.png` / `favicon-16.png` are hand-picked artwork, not generated.** The script's own
  fallback cuts one from the badge's centre tile — the full badge collapses into an indistinct green
  disc at 32px, while a single tile survives the same reduction as something recognisable — but once
  a curated file exists in `public/`, the script leaves it alone rather than silently overwriting the
  choice. Drop a new one in directly to change it; delete it first if you want the script's crop back.

`System.Drawing` writes lossless PNG with no palette reduction, so `logo.png` is ~177 KB — the
heaviest thing the landing page loads. A lossy WebP would be a fraction of that if `cwebp` or
`sharp` is ever available here.

Open Graph tags in `index.html` use a `PLACEHOLDER-DOMAIN` that **must be replaced at deploy**;
absolute URLs are required and this game has no domain yet.

## Development

`?maxReshuffles=1`, `?valueCeiling=6`, `?valueFloor=4` and any other `GameConfig` key can be passed
as a query parameter **in dev builds only** (`domain/config.ts:configFromSearchParams`), to make
game-over states reachable without playing dozens of hands.

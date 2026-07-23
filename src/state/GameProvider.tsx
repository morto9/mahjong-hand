/**
 * React binding for the domain reducer.
 *
 * The provider owns two things the pure domain deliberately does not: the engine
 * configuration for this session, and the *timing* of the reveal (a bet locks,
 * the tiles flip, then the result lands). Components read state through the
 * hooks below and never touch the reducer directly.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import { DEFAULT_CONFIG, type GameConfig } from '@/domain/config';
import { createGameReducer, createInitialState, DEFAULT_ENGINE, type GameEngine } from '@/domain/reducer';
import type { BetChoice, GameState } from '@/domain/types';
import { audio } from '@/services/audio';
import { runStore } from '@/services/gameStorage';

/**
 * Reveal choreography.
 *
 * `PLACE_BET` deals the next hand face down; this is how long those tiles are
 * left sitting there — long enough to land and read as "dealt" — before the
 * reducer turns them over. Must comfortably exceed the deal-in animation
 * (`--duration-slow`, 480ms) plus its per-tile stagger.
 */
export const DEAL_SETTLE_MS = 620;

interface GameContextValue {
  readonly state: GameState;
  readonly config: GameConfig;
  readonly placeBet: (choice: BetChoice) => void;
  readonly continueRound: () => void;
  readonly startGame: (seed?: number) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
  /** Overridable so a difficulty mode or a test can supply its own rules. */
  engine?: GameEngine;
  config?: GameConfig;
  /** A run restored from storage; when absent a fresh one is dealt. */
  initialState?: GameState | null;
}

export function GameProvider({ children, engine, config, initialState }: GameProviderProps) {
  const resolvedEngine = useMemo<GameEngine>(
    () => engine ?? { ...DEFAULT_ENGINE, config: config ?? DEFAULT_CONFIG },
    [engine, config],
  );

  const reducer = useMemo(() => createGameReducer(resolvedEngine), [resolvedEngine]);
  const [state, dispatch] = useReducer(
    reducer,
    resolvedEngine,
    (e) => initialState ?? createInitialState(e),
  );

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The reveal is scheduled rather than dispatched inline so the face-down hand
  // has a real `revealing` phase to sit in, and so a re-render cannot double-fire.
  useEffect(() => {
    if (state.phase !== 'revealing') return;
    revealTimer.current = setTimeout(() => dispatch({ type: 'REVEAL' }), DEAL_SETTLE_MS);
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = null;
    };
  }, [state.phase]);

  // Sound follows phase transitions rather than being fired from click handlers,
  // so a cue can never disagree with what the state machine actually did.
  const previousPhase = useRef<GameState['phase'] | null>(null);
  useEffect(() => {
    const from = previousPhase.current;
    previousPhase.current = state.phase;
    // Never on first mount — nothing has happened yet to make a noise about.
    if (from === null || from === state.phase) return;

    if (state.phase === 'revealing') audio.play('deal');
    else if (state.phase === 'round-result') {
      audio.play('flip');
      if (state.lastOutcome) window.setTimeout(() => audio.play(state.lastOutcome!), 220);
      // The sting belongs under the explanation the player is reading, not under
      // the summary screen they land on afterwards.
      if (state.gameOverReason) window.setTimeout(() => audio.play('gameOver'), 700);
    }
  }, [state.phase, state.lastOutcome, state.gameOverReason]);

  // A dedicated effect, deliberately not folded into the one above: `phase`
  // alone can't tell a fresh run apart from an ordinary `CONTINUE` — both land
  // on `awaiting-bet`, and if the previous run happened to be sitting at
  // `awaiting-bet` too (abandoned before its first bet), the phase transition
  // effect's dependencies would not even change. `seed` is reassigned by
  // `createInitialState` on every `START_GAME` and nothing else, so it is the
  // one value that uniquely means "a new run began."
  const previousSeed = useRef<number | null>(null);
  useEffect(() => {
    const from = previousSeed.current;
    previousSeed.current = state.seed;
    if (from === null || from === state.seed) return; // never on first mount
    audio.play('newGame');
  }, [state.seed]);

  // Persist every committed state so a reload resumes rather than discards.
  // A finished run is cleared instead — it belongs on the summary screen, and
  // `runStore` refuses to resume one anyway.
  useEffect(() => {
    if (state.gameOverReason) runStore.clear();
    else runStore.save(state);
  }, [state]);

  const placeBet = useCallback((choice: BetChoice) => dispatch({ type: 'PLACE_BET', choice }), []);
  const continueRound = useCallback(() => dispatch({ type: 'CONTINUE' }), []);
  const startGame = useCallback((seed?: number) => dispatch({ type: 'START_GAME', seed }), []);

  const value = useMemo<GameContextValue>(
    () => ({ state, config: resolvedEngine.config, placeBet, continueRound, startGame }),
    [state, resolvedEngine.config, placeBet, continueRound, startGame],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside a <GameProvider>');
  return value;
}

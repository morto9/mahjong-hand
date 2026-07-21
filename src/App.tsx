/**
 * Application shell: screen routing, resume handling, and leaderboard wiring.
 *
 * Routing is a small state machine rather than a router — there are three
 * screens and no URLs to own. Swapping in react-router later means replacing
 * `screen` with routes; nothing below the screen components would change.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SoundToggle } from '@/components/ui/SoundToggle';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { configFromSearchParams } from '@/domain/config';
import type { GameState } from '@/domain/types';
import { GameProvider, useGame } from '@/state/GameProvider';
import { runStore } from '@/services/gameStorage';
import { leaderboard, type LeaderboardEntry } from '@/services/leaderboard';
import { GameScreen } from '@/screens/GameScreen';
import { LandingScreen } from '@/screens/LandingScreen';
import { SummaryScreen } from '@/screens/SummaryScreen';
import styles from './App.module.css';

type Screen = 'landing' | 'game' | 'summary';

export default function App() {
  // Dev-only overrides (e.g. `?maxReshuffles=1`) make game-over states reachable.
  const config = useMemo(
    () => configFromSearchParams(typeof window === 'undefined' ? '' : window.location.search),
    [],
  );

  // Read once, before the provider mounts: the provider saves on every state
  // change, so reading later would find the fresh run it just wrote.
  const [restored] = useState<GameState | null>(() => runStore.load());

  return (
    <GameProvider config={config} initialState={restored}>
      <AppShell hasRestoredRun={restored !== null} />
    </GameProvider>
  );
}

/**
 * The screen router. Split from `App` — which is the composition root that
 * resolves config and owns the provider — so it can be mounted against a
 * purpose-built engine.
 */
export function AppShell({ hasRestoredRun }: { hasRestoredRun: boolean }) {
  const { state, config, startGame } = useGame();
  const [screen, setScreen] = useState<Screen>('landing');
  const [canResume, setCanResume] = useState(hasRestoredRun);
  const [entries, setEntries] = useState<readonly LeaderboardEntry[]>(() =>
    leaderboard.top(config.leaderboardSize),
  );

  // `game-over` now arrives only when the player dismisses the final round, so
  // this navigates on their click rather than yanking them off the board.
  // A finished run is also no longer resumable — the provider has cleared the
  // save, so the landing page must stop offering it.
  useEffect(() => {
    if (state.phase !== 'game-over') return;
    setCanResume(false);
    if (screen === 'game') setScreen('summary');
  }, [screen, state.phase]);

  const newGame = useCallback(() => {
    startGame();
    setCanResume(false);
    setScreen('game');
  }, [startGame]);

  /** Picks up the run already loaded into the provider. */
  const resumeGame = useCallback(() => setScreen('game'), []);

  const goHome = useCallback(() => {
    setEntries(leaderboard.top(config.leaderboardSize));
    setScreen('landing');
  }, [config.leaderboardSize]);

  /** Leaves the table without finishing — the run stays resumable. */
  const exitGame = useCallback(() => {
    setCanResume(state.phase !== 'game-over');
    goHome();
  }, [goHome, state.phase]);

  const submitScore = useCallback(
    (name: string) => {
      leaderboard.submit({
        name,
        score: state.score,
        rounds: state.history.length,
        bestStreak: state.bestStreak,
      });
      setEntries(leaderboard.top(config.leaderboardSize));
    },
    [state.score, state.history.length, state.bestStreak, config.leaderboardSize],
  );

  return (
    <div className={styles.app}>
      <div className={styles.toolbar}>
        <SoundToggle />
        <ThemeToggle />
      </div>

      {/* Keyed by screen so each entrance animation replays on navigation. */}
      <div key={screen} className={styles.screen}>
        {screen === 'landing' && (
          <LandingScreen
            entries={entries}
            onNewGame={newGame}
            onResume={canResume ? resumeGame : undefined}
            resumeSummary={canResume ? { round: state.round, score: state.score } : undefined}
          />
        )}

        {screen === 'game' && <GameScreen onExit={exitGame} />}

        {screen === 'summary' && (
          <SummaryScreen
            qualifies={leaderboard.qualifies(state.score, config.leaderboardSize)}
            onSubmitScore={submitScore}
            onPlayAgain={newGame}
            onHome={goHome}
          />
        )}
      </div>
    </div>
  );
}

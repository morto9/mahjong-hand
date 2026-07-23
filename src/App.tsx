/**
 * Application shell: screen routing, resume handling, and leaderboard wiring.
 *
 * Routing is a small state machine rather than a router — there are three
 * screens and no URLs to own. Swapping in react-router later means replacing
 * `screen` with routes; nothing below the screen components would change.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SettingsMenu } from '@/components/ui/SettingsMenu';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { configFromSearchParams } from '@/domain/config';
import type { GameState } from '@/domain/types';
import { buildTutorialSteps } from '@/lib/tutorialSteps';
import { useTutorialSeen } from '@/lib/useTutorialSeen';
import { useTutorialWalkthrough } from '@/lib/useTutorialWalkthrough';
import { GameProvider, useGame } from '@/state/GameProvider';
import { runStore } from '@/services/gameStorage';
import { leaderboard, type LeaderboardEntry } from '@/services/leaderboard';
import { music } from '@/services/music';
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

  const tutorialSeen = useTutorialSeen();
  const tutorialSteps = useMemo(() => buildTutorialSteps(config), [config]);
  const tutorial = useTutorialWalkthrough({
    steps: tutorialSteps,
    phase: state.phase,
    onExit: tutorialSeen.markSeen,
  });

  // Browsers won't start audio outside a user gesture, and `AppShell` is the one
  // instance that outlives every screen, so this is the single place to catch the
  // first click/tap/keypress of a session and start the loop then — whichever
  // screen the player happened to land on.
  useEffect(() => {
    const start = () => music.play();
    const events = ['pointerdown', 'keydown'] as const;
    events.forEach((event) => window.addEventListener(event, start, { once: true }));
    return () => events.forEach((event) => window.removeEventListener(event, start));
  }, []);

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
    // Only the very first "New game" of a browser's lifetime auto-starts the
    // walkthrough — a restored run never re-triggers it via `resumeGame`, and
    // every later new run stays silent unless the player asks for it again.
    if (!tutorialSeen.seen) tutorial.start();
  }, [startGame, tutorialSeen.seen, tutorial]);

  /** Replays the walkthrough on demand from the landing page, regardless of the seen flag. */
  const startTutorialReplay = useCallback(() => {
    startGame();
    setCanResume(false);
    setScreen('game');
    tutorial.start();
  }, [startGame, tutorial]);

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
      {/*
        Corner placement for the screens that are a board — the landing page has
        a row of actions to sit in instead, and renders its own.
        Exit only appears while there is a run to leave.
      */}
      {/*
        Hidden (not disabled) while the tutorial runs: its "Exit game" would let
        a first-time player accidentally abandon the walkthrough mid-flow, and
        two floating controls competing for the same corner is one too many.
        Reappears the instant the tutorial ends.
      */}
      {screen !== 'landing' && !tutorial.active && (
        <div className={styles.settingsAnchor}>
          <SettingsMenu
            className={styles.settings}
            onExitGame={screen === 'game' ? exitGame : undefined}
          />
        </div>
      )}

      {/* Keyed by screen so each entrance animation replays on navigation. */}
      <div key={screen} className={styles.screen}>
        {screen === 'landing' && (
          <LandingScreen
            entries={entries}
            onNewGame={newGame}
            onResume={canResume ? resumeGame : undefined}
            resumeSummary={canResume ? { round: state.round, score: state.score } : undefined}
            onShowTutorial={startTutorialReplay}
          />
        )}

        {screen === 'game' && <GameScreen />}

        {screen === 'game' && tutorial.active && tutorial.step && (
          <TutorialOverlay
            step={tutorial.step}
            stepIndex={tutorial.stepIndex}
            totalSteps={tutorial.totalSteps}
            onAdvance={tutorial.advance}
            onSkip={tutorial.skip}
          />
        )}

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

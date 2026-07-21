/**
 * The game state machine.
 *
 * Pure: `(state, action) => state`. Every rule it applies is delegated to a
 * dedicated module (deck, values, betting, scoring, gameOver), so this file only
 * expresses *flow*: what may happen next, and in what order.
 *
 *   awaiting-bet ──PLACE_BET──▶ revealing ──REVEAL──▶ round-result ──CONTINUE──▶ awaiting-bet
 *                                                            └──▶ game-over (a rule fired)
 *
 * The RNG position travels in `state.rngState`, so replaying the same actions
 * against the same starting state always produces the same run.
 */
import { resolveBet } from './betting';
import { DEFAULT_CONFIG, type GameConfig } from './config';
import { createDeckState, discard } from './deck';
import { checkGameOver, type GameOverRule } from './gameOver';
import { dealHand } from './hand';
import { createRng, randomSeed } from './rng';
import { streakMultiplierRule, type ScoringRule } from './scoring';
import type { BetChoice, GameAction, GameState, Hand, RoundRecord } from './types';
import { applyOutcome, createValueTable } from './values';

/**
 * Everything the reducer needs that is not state. Passing this in (rather than
 * importing defaults directly) is what makes difficulty modes, alternative
 * scoring and custom lose conditions drop-in changes.
 */
export interface GameEngine {
  readonly config: GameConfig;
  readonly scoringRule: ScoringRule;
  readonly gameOverRules?: readonly GameOverRule[];
}

export const DEFAULT_ENGINE: GameEngine = {
  config: DEFAULT_CONFIG,
  scoringRule: streakMultiplierRule,
};

export function createInitialState(engine: GameEngine = DEFAULT_ENGINE, seed?: number): GameState {
  const resolvedSeed = seed ?? randomSeed();
  const rng = createRng(resolvedSeed);

  const values = createValueTable(engine.config);
  const { hand, deck } = dealHand(createDeckState(rng), values, engine.config, rng);

  return {
    phase: 'awaiting-bet',
    deck,
    values,
    currentHand: hand,
    incomingHand: null,
    pendingChoice: null,
    lastOutcome: null,
    lastPointsAwarded: 0,
    history: [],
    round: 1,
    score: 0,
    streak: 0,
    bestStreak: 0,
    gameOverReason: null,
    seed: resolvedSeed,
    rngState: rng.state,
  };
}

export function createGameReducer(engine: GameEngine = DEFAULT_ENGINE) {
  return function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
      case 'START_GAME':
        return createInitialState(engine, action.seed);

      case 'PLACE_BET': {
        if (state.phase !== 'awaiting-bet') return state;
        return dealIncoming(state, action.choice, engine);
      }

      case 'REVEAL': {
        if (state.phase !== 'revealing' || !state.pendingChoice || !state.incomingHand) return state;
        return resolveRound(state, state.pendingChoice, engine);
      }

      case 'CONTINUE': {
        if (state.phase !== 'round-result' || !state.incomingHand) return state;

        // A rule fired on the round just shown. The player has now seen the hand
        // that ended them and read why, so the run can close.
        if (state.gameOverReason) return { ...state, phase: 'game-over' };

        // The hand just revealed becomes the hand to bet against.
        return {
          ...state,
          phase: 'awaiting-bet',
          currentHand: state.incomingHand,
          incomingHand: null,
          pendingChoice: null,
          round: state.round + 1,
        };
      }

      default:
        return state;
    }
  };
}

/** Convenience for callers that do not need a custom engine. */
export const gameReducer = createGameReducer(DEFAULT_ENGINE);

/**
 * Locks the bet and deals the incoming hand — face down, as far as the UI is
 * concerned. Nothing is scored and no value drifts yet.
 *
 * Dealing here rather than at reveal time is what makes the flip animation
 * possible: the tiles exist in the DOM for the whole `revealing` phase, so
 * turning them over is a transform transition on elements that are already
 * mounted, not a mount.
 */
function dealIncoming(state: GameState, choice: BetChoice, engine: GameEngine): GameState {
  const rng = createRng(state.rngState);
  const { hand: incomingHand, deck } = dealHand(state.deck, state.values, engine.config, rng);

  return {
    ...state,
    phase: 'revealing',
    pendingChoice: choice,
    incomingHand,
    deck,
    rngState: rng.state,
  };
}

/**
 * Turns the dealt hand over and settles the round: outcome, score, tile-value
 * drift, discard, history, then the game-over check.
 */
function resolveRound(state: GameState, choice: BetChoice, engine: GameEngine): GameState {
  const { config, scoringRule } = engine;
  // Dealt by `dealIncoming`; the reducer guards against a null before calling.
  const incomingHand = state.incomingHand as Hand;

  const outcome = resolveBet(state.currentHand.total, incomingHand.total, choice);
  const { points, nextStreak } = scoringRule.score({
    outcome,
    streak: state.streak,
    previousTotal: state.currentHand.total,
    incomingTotal: incomingHand.total,
    config,
  });

  // Only the incoming hand drifts: it is the hand that won or lost the bet.
  const values = applyOutcome(state.values, incomingHand.tiles, outcome);
  // The hand we just bet against is spent; the revealed hand stays on the table.
  const deck = discard(state.deck, state.currentHand.tiles);

  const record: RoundRecord = {
    round: state.round,
    hand: incomingHand,
    choice,
    outcome,
    previousTotal: state.currentHand.total,
    pointsAwarded: points,
  };

  const score = state.score + points;
  const gameOverReason = checkGameOver(
    { deck, values, round: state.round, score, config },
    engine.gameOverRules,
  );

  return {
    ...state,
    // Always `round-result`, even when a rule fired. The reason travels with it
    // so the player sees the hand that ended the run resolve, and reads why,
    // before `CONTINUE` closes the game out.
    phase: 'round-result',
    deck,
    values,
    incomingHand,
    lastOutcome: outcome,
    lastPointsAwarded: points,
    history: [...state.history, record],
    score,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    gameOverReason,
  };
}

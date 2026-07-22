import { useMemo } from 'react';

import { BetControls } from '@/components/game/BetControls';
import { DeckStatus } from '@/components/game/DeckStatus';
import { RoundFeedback } from '@/components/game/RoundFeedback';
import { RunStats } from '@/components/game/RunStats';
import { TileValueRail } from '@/components/game/TileValueRail';
import { HandDisplay } from '@/components/tile/HandDisplay';
import { HistoryStrip } from '@/components/tile/HistoryStrip';
import { Panel } from '@/components/ui/Panel';
import type { TileTypeId } from '@/domain/types';
import { cx } from '@/lib/cx';
import { useGame } from '@/state/GameProvider';
import { useHonorValues, useRecentHistory } from '@/state/useGameSelectors';
import styles from './GameScreen.module.css';

export function GameScreen() {
  const { state, config, placeBet, continueRound } = useGame();
  const history = useRecentHistory();
  const honors = useHonorValues();

  const isRevealing = state.phase === 'revealing';
  const hasResult = state.phase === 'round-result';
  const outcome = hasResult ? state.lastOutcome : null;

  const atRiskTypes = useMemo<ReadonlySet<TileTypeId>>(
    () => new Set(honors.filter((h) => h.atRisk).map((h) => h.type.id)),
    [honors],
  );

  return (
    <main className={styles.screen}>
      <div className={styles.body}>
        <div className={cx(styles.rail, styles.railLeft)}>
          <DeckStatus />
          <Panel title="History">
            <HistoryStrip rounds={history} values={state.values} />
          </Panel>
        </div>

        <section className={cx(styles.table, outcome && styles[outcome])} aria-label="Table">
          <div className={styles.hands}>
            <HandDisplay
              // Keyed by hand so a promoted hand re-enters rather than mutating
              // in place — that is what makes the slide read as movement.
              key={state.currentHand.id}
              hand={state.currentHand}
              values={state.values}
              label="Hand on the table"
              baseValue={config.baseHonorValue}
              atRiskTypes={atRiskTypes}
              // Round 1's hand is dealt from the wall; every later one arrived
              // by promotion from the next-hand slot.
              entrance={state.round === 1 ? 'deal' : 'slide'}
            />

            <span className={styles.versus}>vs</span>

            <HandDisplay
              hand={state.incomingHand}
              values={state.values}
              label="Next hand"
              tileCount={config.handSize}
              hidden={isRevealing}
              outcome={outcome}
              baseValue={config.baseHonorValue}
              atRiskTypes={atRiskTypes}
              entrance="deal"
            />
          </div>

          <div className={styles.stage}>
            {hasResult && state.lastOutcome && state.incomingHand ? (
              <div className={styles.stageSwap}>
                <RoundFeedback
                  outcome={state.lastOutcome}
                  points={state.lastPointsAwarded}
                  streak={state.streak}
                  previousTotal={state.currentHand.total}
                  incomingTotal={state.incomingHand.total}
                  onContinue={continueRound}
                  gameOverReason={state.gameOverReason}
                />
              </div>
            ) : (
              <div className={styles.stageSwap}>
                <BetControls
                  onBet={placeBet}
                  disabled={state.phase !== 'awaiting-bet'}
                  chosen={state.pendingChoice}
                  takeFocus={state.round > 1}
                  prompt={
                    isRevealing
                      ? 'Turning the tiles…'
                      : `Will the next hand total more or less than ${state.currentHand.total}?`
                  }
                />
              </div>
            )}
          </div>

          {/* Announces each result for screen readers without stealing focus. */}
          <p className="sr-only" role="status" aria-live="polite">
            {hasResult && state.incomingHand
              ? `${state.lastOutcome}. Next hand totalled ${state.incomingHand.total} against ${state.currentHand.total}.` +
                (state.gameOverReason ? ` ${state.gameOverReason.title}. ${state.gameOverReason.detail}` : '')
              : ''}
          </p>
        </section>

        <div className={cx(styles.rail, styles.railRight)}>
          <RunStats />
          <TileValueRail />
        </div>
      </div>
    </main>
  );
}

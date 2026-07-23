import { useMemo } from 'react';

import { Tile } from '@/components/tile/Tile';
import { Button } from '@/components/ui/Button';
import { Medal, type MedalPlace } from '@/components/ui/Medal';
import { Panel } from '@/components/ui/Panel';
import { SettingsMenu } from '@/components/ui/SettingsMenu';
import { buildRuleCopy } from '@/domain/ruleText';
import { getTileType } from '@/domain/tiles';
import type { Tile as TileModel } from '@/domain/types';
import { createValueTable } from '@/domain/values';
import { cx } from '@/lib/cx';
import type { LeaderboardEntry } from '@/services/leaderboard';
import { useGame } from '@/state/GameProvider';
import styles from './LandingScreen.module.css';

interface LandingScreenProps {
  entries: readonly LeaderboardEntry[];
  onNewGame: () => void;
  /** Present when a run from a previous visit is waiting to be picked up. */
  onResume?: () => void;
  resumeSummary?: { round: number; score: number };
  /** Starts (or replays) the interactive first-hand walkthrough. */
  onShowTutorial: () => void;
}

/** Decorative hand shown behind the hero — a nod at what the game is played with. */
const SHOWCASE_TYPE_IDS = ['dragon-red', 'bamboo-7', 'wind-east', 'dot-3'];

/** Medal by finishing place. Beyond the podium there is no colour, by design. */
const MEDALS = ['gold', 'silver', 'bronze'] as const;

export function LandingScreen({
  entries,
  onNewGame,
  onResume,
  resumeSummary,
  onShowTutorial,
}: LandingScreenProps) {
  const { config } = useGame();
  const rules = useMemo(() => buildRuleCopy(config), [config]);

  const showcase = useMemo<TileModel[]>(
    () =>
      SHOWCASE_TYPE_IDS.map((id, index) => ({
        instanceId: `showcase-${index}`,
        type: getTileType(id),
      })),
    [],
  );
  const showcaseValues = useMemo(() => createValueTable(config), [config]);

  return (
    <main className={styles.screen}>
      <div className={styles.inner}>
        <section className={styles.hero}>
          {/*
            The logo and the pitch share a row: logo on the left, heading on the
            right. They are siblings, not nested — the logo is the page's h1 (its
            alt carries the name), the pitch is the h2, and an h1 may not live
            inside an h2.

            Intrinsic width/height on the image reserve its box before it loads,
            so a late-arriving logo cannot shove the page down on this fitted
            screen.
          */}
          <div className={styles.headingRow}>
            <h1 className={styles.gameTitle}>
              <img
                className={styles.logo}
                src="/logo.png"
                width={320}
                height={320}
                alt="Mahjong Hands"
              />
            </h1>

            <h2 className={styles.title}>
              Read the wall.
              <br />
              Call it.
              <br />
              <em>higher or lower ?</em>
            </h2>
          </div>

          <p className={styles.lede}>
            Three tiles are dealt, bet whether the next hand totals more or less. <br/>Numbers of dragons and winds shift with every hand they touch,<br/>any tile that
            drifts too far ends the night. <br/>
            <strong className={styles.ledeCta}>Can you make it to the top 5 ?</strong>
          </p>

          <div className={styles.fan} aria-hidden="true">
            {showcase.map((tile, index) => (
              <Tile
                key={tile.instanceId}
                tile={tile}
                values={showcaseValues}
                size="md"
                index={index}
                hoverable
              />
            ))}
          </div>

          <div className={styles.actions}>
            {/*
              "Play" is a trigger, not an action of its own — it does nothing
              on click, only opens the popup beneath it (the same "opens
              rather than toggles" reasoning `SettingsMenu`'s own trigger
              uses). The real choices — resume, start over, replay the
              tutorial — live in that popup, open on hover or keyboard focus.
              `:focus-within` is what keeps it reachable by keyboard: tabbing
              onto "Play" reveals it, and it stays revealed while tabbing on
              into the items themselves.
            */}
            <div className={styles.playGroup}>
              <Button variant="primary" size="lg" autoFocus>
                Play
              </Button>

              {/*
                The gap between "Play" and the card lives inside `.playPopup`
                (as padding), not between it and `.playGroup`, so there is no
                dead strip of screen the pointer has to cross without hovering
                anything — moving from the button up into the card stays
                inside this element the whole way, the same shape
                `SettingsMenu`'s own `.panel`/`.items` split uses.
              */}
              <div className={styles.playPopup}>
                <div className={styles.playPopupCard}>
                  {onResume && (
                    <button type="button" className={styles.playPopupItem} onClick={onResume}>
                      <span className={styles.playPopupIcon} aria-hidden="true">
                        ▶
                      </span>
                      Resume
                    </button>
                  )}
                  <button type="button" className={styles.playPopupItem} onClick={onNewGame}>
                    <span className={styles.playPopupIcon} aria-hidden="true">
                      ↺
                    </span>
                    New game
                  </button>
                  <span className={styles.playPopupSeparator} role="presentation" />
                  <button type="button" className={styles.playPopupItem} onClick={onShowTutorial}>
                    <span className={styles.playPopupIcon} aria-hidden="true">
                      ❓
                    </span>
                    How to play
                  </button>
                </div>
              </div>
            </div>

            {/*
              Sits with the actions rather than in a corner: this screen has a
              row to belong to, and settings is one of the things you come here
              to do. No exit — there is no run on the table to leave.
            */}
            <SettingsMenu size="lg" placement="above" />
          </div>

          {resumeSummary && (
            <p className={styles.resumeNote}>
              Hand {resumeSummary.round} · {resumeSummary.score} points on the table. Starting a new
              game discards it.
            </p>
          )}
        </section>

        <aside className={styles.side}>
          <Panel title="Top 5" raised>
            {entries.length === 0 ? (
              <p className={styles.emptyBoard}>
                No runs recorded yet.
              </p>
            ) : (
              <ol className={styles.board}>
                {entries.map((entry, index) => (
                  <li key={entry.id} className={cx(styles.entry, MEDALS[index] && styles[MEDALS[index]!])}>
                    {/* Top three wear a medal in place of the number; 4th and 5th keep it. */}
                    {index < 3 ? (
                      <Medal place={(index + 1) as MedalPlace} />
                    ) : (
                      <span className={styles.rank}>{index + 1}</span>
                    )}
                    <span className={styles.who}>
                      <span className={styles.name}>{entry.name}</span>
                      <span className={styles.meta}>
                        {entry.rounds} hands · best streak {entry.bestStreak}
                      </span>
                    </span>
                    <span className={styles.score}>{entry.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="How it plays">
            <div className={styles.rules}>
              {rules.map(({ typeId, body }) => (
                <p key={typeId} className={styles.rule}>
                  <span className={styles.ruleGlyph} aria-hidden="true">
                    {getTileType(typeId).glyph}
                  </span>
                  {body}
                </p>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

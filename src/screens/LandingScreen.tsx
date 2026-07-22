import { useMemo } from 'react';

import { Tile } from '@/components/tile/Tile';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SettingsMenu } from '@/components/ui/SettingsMenu';
import type { GameConfig } from '@/domain/config';
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
}

/** Decorative hand shown behind the hero — a nod at what the game is played with. */
const SHOWCASE_TYPE_IDS = ['dragon-red', 'bamboo-7', 'wind-east', 'dot-3'];

/** Medal by finishing place. Beyond the podium there is no colour, by design. */
const MEDALS = ['gold', 'silver', 'bronze'] as const;

/**
 * Rule bullets, generated from the live config so the copy can never drift from
 * the rules actually in force. Glyphs come from the tile registry.
 */
function buildRules(config: GameConfig): { typeId: string; body: JSX.Element }[] {
  return [
    {
      typeId: 'dot-1',
      body: (
        <span>
          <strong>Number tiles</strong> are worth their face value, 1 to 9.
        </span>
      ),
    },
    {
      typeId: 'dragon-red',
      body: (
        <span>
          <strong>Dragons and winds</strong> start at {config.baseHonorValue}, rise by 1 in a
          winning hand and fall by 1 in a losing one.
        </span>
      ),
    },
    {
      typeId: 'wind-east',
      body: (
        <span>
          <strong>The run ends</strong> if any honour hits {config.valueFloor} or{' '}
          {config.valueCeiling}, or when the wall is rebuilt for the {config.maxReshuffles}
          {ordinalSuffix(config.maxReshuffles)} time.
        </span>
      ),
    },
    {
      typeId: 'bamboo-1',
      body: (
        <span>
          <strong>Correct calls</strong> score {config.scoreBase} × your streak, up to{' '}
          {config.streakCap}×. Ties are a push.
        </span>
      ),
    },
  ];
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

// `resumeSummary` is still accepted, and still passed, but the note that
// rendered it is currently commented out below.
export function LandingScreen({ entries, onNewGame, onResume }: LandingScreenProps) {
  const { config } = useGame();
  const rules = useMemo(() => buildRules(config), [config]);

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
      <header className={styles.masthead}>
        <h1 className={styles.gameTitle}>
          Mahjong <em>Hands Betting</em>
        </h1>
      </header>

      <div className={styles.inner}>
        <section className={styles.hero}>
          {/* <span className={styles.kicker}>Mahjong · Hand betting</span> */}

          {/* The game's name is the page's h1 above; this is the pitch under it. */}
          <h2 className={styles.title}>
            Read the wall.
            <br />
            Call it.<br />
            <em>higher or lower ?</em>
          </h2>

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
            {onResume ? (
              <>
                <Button variant="primary" size="lg" onClick={onResume} autoFocus>
                  Resume
                </Button>
                <Button size="lg" onClick={onNewGame}>
                  New game
                </Button>
              </>
            ) : (
              <Button variant="primary" size="lg" onClick={onNewGame} autoFocus>
                New game
              </Button>
            )}

            {/*
              Sits with the actions rather than in a corner: this screen has a
              row to belong to, and settings is one of the things you come here
              to do. No exit — there is no run on the table to leave.
            */}
            <SettingsMenu size="lg" />
          </div>

          {/* {resumeSummary && (
            <p className={styles.resumeNote}>
              Hand {resumeSummary.round} · {resumeSummary.score} points on the table. Starting a new
              game discards it.
            </p>
          )} */}
        </section>

        <aside className={styles.side}>
          <Panel title="Top 5" raised>
            {entries.length === 0 ? (
              <p className={styles.emptyBoard}>
                No runs recorded yet. The first hand you survive sets the mark.
              </p>
            ) : (
              <ol className={styles.board}>
                {entries.map((entry, index) => (
                  <li key={entry.id} className={cx(styles.entry, MEDALS[index] && styles[MEDALS[index]!])}>
                    <span className={styles.rank}>{index + 1}</span>
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

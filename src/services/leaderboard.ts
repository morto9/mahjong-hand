/**
 * Leaderboard persistence.
 *
 * Behind an interface on purpose: today it is localStorage, tomorrow it can be a
 * fetch against an API. Screens depend on `LeaderboardStore`, never on the
 * storage mechanism, so swapping implementations touches this file only.
 */

export interface LeaderboardEntry {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly rounds: number;
  readonly bestStreak: number;
  /** Epoch millis, so entries can be sorted or aged without parsing. */
  readonly playedAt: number;
}

export interface LeaderboardStore {
  /** Highest scores first, newest first as a tie-break. */
  top(limit: number): LeaderboardEntry[];
  /** True when a score would place inside the top `limit`. */
  qualifies(score: number, limit: number): boolean;
  submit(entry: Omit<LeaderboardEntry, 'id' | 'playedAt'>): LeaderboardEntry[];
  clear(): void;
}

/** Versioned so a future schema change can migrate rather than crash. */
const STORAGE_KEY = 'jade-wager.leaderboard.v1';

function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.sort((a, b) => b.score - a.score || b.playedAt - a.playedAt);
}

/** Defensive: storage is user-writable and may hold anything. */
function isEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<LeaderboardEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.score === 'number' &&
    typeof entry.rounds === 'number' &&
    typeof entry.bestStreak === 'number' &&
    typeof entry.playedAt === 'number'
  );
}

export function createLocalLeaderboard(
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
  /** Entries kept on disk; the landing page shows fewer. */
  capacity = 25,
): LeaderboardStore {
  function read(): LeaderboardEntry[] {
    if (!storage) return [];
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return sortEntries(parsed.filter(isEntry));
    } catch {
      // Corrupt or blocked storage must never break the landing page.
      return [];
    }
  }

  function write(entries: LeaderboardEntry[]): void {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, capacity)));
    } catch {
      /* quota or private mode — the run is still playable, just not recorded */
    }
  }

  return {
    top(limit) {
      return read().slice(0, limit);
    },

    qualifies(score, limit) {
      if (score <= 0) return false;
      const entries = read();
      if (entries.length < limit) return true;
      return score > (entries[limit - 1]?.score ?? 0);
    },

    submit(entry) {
      const full: LeaderboardEntry = {
        ...entry,
        name: entry.name.trim().slice(0, 16) || 'Anonymous',
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        playedAt: Date.now(),
      };
      const entries = sortEntries([...read(), full]);
      write(entries);
      return entries;
    },

    clear() {
      storage?.removeItem(STORAGE_KEY);
    },
  };
}

/** App-wide singleton. Injected via context so tests can substitute a fake. */
export const leaderboard = createLocalLeaderboard();

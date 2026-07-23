import { useCallback, useState } from 'react';

const STORAGE_KEY = 'jade-wager.tutorial-seen';

function readStored(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Whether the first-run tutorial has ever been finished or skipped.
 *
 * One-directional by design — there is no UI to "un-see" it, only to replay it
 * on demand via the landing page's "How to play" button, which doesn't touch
 * this flag at all.
 */
export function useTutorialSeen() {
  const [seen, setSeen] = useState(readStored);

  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* storage unavailable — the flag still applies for this session */
    }
  }, []);

  return { seen, markSeen };
}

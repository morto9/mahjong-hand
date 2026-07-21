import { useCallback, useEffect, useState } from 'react';

import { audio } from '@/services/audio';

const STORAGE_KEY = 'jade-wager.muted';

function readStored(): boolean {
  if (typeof localStorage === 'undefined') return defaultMuted();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return defaultMuted();
}

/**
 * Someone who has asked the system to reduce motion is signalling a preference
 * for a calmer interface, so sound starts off for them. It stays a preference,
 * not a lock — the toggle still works.
 */
function defaultMuted(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Mute preference, persisted and pushed into the audio service. */
export function useSound() {
  const [muted, setMuted] = useState(readStored);

  useEffect(() => {
    audio.setMuted(muted);
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      /* storage unavailable — the preference still applies for this session */
    }
  }, [muted]);

  const toggleMuted = useCallback(() => setMuted((m) => !m), []);

  return { muted, setMuted, toggleMuted };
}

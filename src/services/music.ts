/**
 * Looping background music, playing under the synthesised sound effects.
 *
 * Everything in `services/audio.ts` is deliberately synthesised — that keeps
 * the *sound effects* tunable as numbers and the bundle asset-free. A five-
 * minute lounge track is a different kind of thing: nobody synthesises a
 * casino ambience with a couple of oscillators, so this is a real MP3
 * (`public/background-music.mp3`, ~9.9MB) streamed through an `<audio>`
 * element rather than decoded into memory the way a WebAudio buffer would be.
 * The two services stay separate on purpose — SFX still has zero asset weight,
 * music is the one deliberate exception, and it's not fetched at all until
 * playback actually starts.
 *
 * Behind an interface for the same reason as the leaderboard and the SFX
 * service: swapping the track, or the playback mechanism, means one new
 * implementation, not edits across the UI.
 */

const TRACK_URL = '/background-music.mp3';

/** Sits well under the SFX so a `deal` clack or a `win` chime still cuts through. */
const VOLUME = 0.16;

export interface MusicService {
  /** Starts playback if it hasn't already. Safe to call more than once. */
  play(): void;
  pause(): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
}

/** A no-op service, used when there is no DOM to attach an `<audio>` element to. */
const SILENT: MusicService = {
  play() {},
  pause() {},
  setMuted() {},
  muted: true,
};

export function createMusicService(initiallyMuted = false): MusicService {
  if (typeof Audio === 'undefined') return SILENT;

  let muted = initiallyMuted;
  let started = false;
  let element: HTMLAudioElement | null = null;

  function ensureElement(): HTMLAudioElement {
    if (element) return element;
    element = new Audio(TRACK_URL);
    element.loop = true;
    element.volume = VOLUME;
    // Nothing is fetched until `play()` actually calls `.play()` — creating the
    // element alone does not start the network request under this preload mode.
    element.preload = 'none';
    return element;
  }

  // Real browsers refuse audio outside a user gesture and return a rejecting
  // promise; `play()` is only ever called from one, so a rejection is expected
  // and harmless. jsdom's media stub doesn't return a promise at all, so this
  // tolerates both.
  function safePlay(el: HTMLAudioElement): void {
    el.play()?.catch(() => {});
  }

  return {
    get muted() {
      return muted;
    },

    setMuted(next) {
      muted = next;
      if (!element) return;
      if (next) element.pause();
      else if (started) safePlay(element);
    },

    play() {
      started = true;
      if (muted) return;
      safePlay(ensureElement());
    },

    pause() {
      element?.pause();
    },
  };
}

/** App-wide singleton, mirroring the SFX and leaderboard services. */
export const music = createMusicService();

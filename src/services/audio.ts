/**
 * Sound effects, synthesised at runtime.
 *
 * No audio files here: every cue is built from oscillators and noise buffers,
 * which keeps this half of the audio bundle asset-free and makes the sounds
 * tunable as numbers rather than as re-exported waveforms. Background music
 * is the one deliberate exception to that rule — it's a real MP3, handled
 * separately in `services/music.ts` for exactly that reason.
 *
 * Behind an interface for the same reason as the leaderboard — swapping in
 * sampled audio later means one new implementation, not edits across the UI.
 */

/** Every sound the game can make. Add a cue here, then handle it in `play`. */
export type SoundCue =
  /** A tile landing on the table. */
  | 'deal'
  /** Tiles turning face up. */
  | 'flip'
  | 'win'
  | 'loss'
  | 'push'
  /** The run ending. */
  | 'gameOver'
  /** A fresh run beginning — the wall reset, waiting on the first bet. */
  | 'newGame'
  /** This run's score just cleared the leaderboard. */
  | 'highScore';

export interface AudioService {
  play(cue: SoundCue): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
}

/** A no-op service, used when WebAudio is unavailable or blocked. */
const SILENT: AudioService = {
  play() {},
  setMuted() {},
  muted: true,
};

type Ctor = typeof AudioContext;

function audioContextCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { webkitAudioContext?: Ctor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createAudioService(initiallyMuted = false): AudioService {
  const Ctor = audioContextCtor();
  if (!Ctor) return SILENT;

  let context: AudioContext | null = null;
  let muted = initiallyMuted;

  /**
   * Browsers refuse to start an AudioContext outside a user gesture, so it is
   * created on first play — by which point the player has clicked something.
   */
  function ensureContext(): AudioContext | null {
    if (muted) return null;
    if (!context) {
      try {
        context = new Ctor!();
      } catch {
        return null;
      }
    }
    // A context created before a gesture, or backgrounded by the tab, suspends.
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  /**
   * Small random variation, so a cue played over and over — the three-tile
   * `deal` most of all — doesn't sound machine-identical every round. `amount`
   * is a fraction: 0.04 means ±4%. Multiplicative, so a value of exactly 0
   * (the first note in a phrase, almost always at `at: 0`) is left alone —
   * there's nothing to vary it against, and that's fine, only the notes after
   * it need humanizing.
   */
  function jitter(value: number, amount = 0.04): number {
    return value * (1 + (Math.random() * 2 - 1) * amount);
  }

  interface ToneOptions {
    freq: number;
    /** Delay before the note starts, in seconds. */
    at?: number;
    duration?: number;
    gain?: number;
    type?: OscillatorType;
    /** Glide to this frequency across the note. */
    sweepTo?: number;
  }

  /** A plucked tone with an exponential decay. */
  function tone(
    ctx: AudioContext,
    { freq, at = 0, duration = 0.16, gain = 0.12, type = 'triangle', sweepTo = 0 }: ToneOptions,
  ) {
    const start = ctx.currentTime + jitter(at);
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  interface ClackOptions {
    at?: number;
    gain?: number;
    /** Bandpass centre — higher reads as a lighter, harder tile. */
    cutoff?: number;
  }

  /** Filtered noise — the woody clack of a tile meeting the table. */
  function clack(ctx: AudioContext, { at = 0, gain = 0.16, cutoff = 2200 }: ClackOptions) {
    const start = ctx.currentTime + at;
    const length = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      // Decaying white noise.
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(jitter(cutoff), start);
    filter.Q.setValueAtTime(1.4, start);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, start);

    source.connect(filter).connect(amp).connect(ctx.destination);
    source.start(start);
  }

  return {
    get muted() {
      return muted;
    },

    setMuted(next) {
      muted = next;
      if (next && context) void context.suspend();
      else if (!next && context?.state === 'suspended') void context.resume();
    },

    play(cue) {
      const ctx = ensureContext();
      if (!ctx) return;

      switch (cue) {
        case 'deal':
          // Three tiles landing in quick succession.
          clack(ctx, { at: 0, cutoff: 2400 });
          clack(ctx, { at: 0.075, cutoff: 2050 });
          clack(ctx, { at: 0.15, cutoff: 2600 });
          break;

        case 'flip':
          clack(ctx, { at: 0, gain: 0.1, cutoff: 3200 });
          clack(ctx, { at: 0.06, gain: 0.1, cutoff: 2900 });
          break;

        case 'win':
          // Rising perfect fifth.
          tone(ctx, { freq: 523.25, duration: 0.14 });
          tone(ctx, { freq: 783.99, at: 0.1, duration: 0.26 });
          break;

        case 'loss':
          tone(ctx, { freq: 196, duration: 0.34, gain: 0.14, type: 'sine', sweepTo: 110 });
          break;

        case 'push':
          tone(ctx, { freq: 440, duration: 0.12, gain: 0.08, type: 'sine' });
          break;

        case 'gameOver':
          // Descending, deliberately final.
          tone(ctx, { freq: 392, duration: 0.3, type: 'sine' });
          tone(ctx, { freq: 311.13, at: 0.22, duration: 0.34, type: 'sine' });
          tone(ctx, { freq: 196, at: 0.46, duration: 0.6, gain: 0.14, type: 'sine' });
          break;

        case 'newGame':
          // A soft settle: the wall freshly built, then a calm, unhurried
          // welcome — deliberately gentler than `win`, since nothing has been
          // won yet.
          clack(ctx, { at: 0, gain: 0.08, cutoff: 1500 });
          tone(ctx, { freq: 349.23, at: 0.08, duration: 0.22, gain: 0.07, type: 'sine' });
          tone(ctx, { freq: 440, at: 0.22, duration: 0.32, gain: 0.08, type: 'sine' });
          break;

        case 'highScore':
          // A fuller flourish than a plain win — a four-note major arpeggio
          // rather than `win`'s bare fifth, in the same bright triangle timbre
          // so it still reads as part of the same family of good news.
          tone(ctx, { freq: 523.25, duration: 0.14 });
          tone(ctx, { freq: 659.25, at: 0.09, duration: 0.16 });
          tone(ctx, { freq: 783.99, at: 0.18, duration: 0.18 });
          tone(ctx, { freq: 1046.5, at: 0.28, duration: 0.36, gain: 0.1 });
          break;
      }
    },
  };
}

/** App-wide singleton, mirroring the leaderboard's shape. */
export const audio = createAudioService();

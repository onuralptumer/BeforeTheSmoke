/**
 * The four sounds, synthesised.
 *
 * There are exactly four, and none of them carries information that exists
 * nowhere else — the acceptance criteria require the game to be complete in
 * silence, which is also why there is no ambient bed and no music.
 *
 * They are generated from oscillators rather than loaded from files. Four
 * short mechanical cues do not justify shipping, licensing and maintaining
 * audio assets, and synthesis keeps them tunable in the same place they are
 * described.
 */

// Imported from the module itself rather than the package barrel. The barrel
// re-exports AudioControls, which imports react-native-reanimated
// unconditionally even though the package declares it an optional peer — so
// the public entry point cannot be bundled without pulling in the whole
// Reanimated and Worklets stack, for four beeps. `core/AudioContext` reaches
// none of that. The dependency is pinned to an exact version because this
// couples to an internal path, and `audio.test.ts` fails loudly if an upgrade
// ever moves it.
import AudioContext from 'react-native-audio-api/src/core/AudioContext';

let context: AudioContext | null = null;
let enabled = true;

function ctx(): AudioContext | null {
  if (!enabled) {
    return null;
  }
  if (!context) {
    try {
      context = new AudioContext();
    } catch {
      // A device that cannot open an audio context still plays the game.
      enabled = false;
      return null;
    }
  }
  return context;
}

/** The DOM lib is not in scope in React Native, so name the waveforms here. */
type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface ToneSpec {
  frequency: number;
  /** Slide to this frequency across the tone, for mechanical impacts. */
  glideTo?: number;
  type?: Waveform;
  duration: number;
  gain: number;
  /** Seconds after "now" to begin. */
  delay?: number;
  attack?: number;
}

function tone(audio: AudioContext, spec: ToneSpec) {
  const start = audio.currentTime + (spec.delay ?? 0);
  const end = start + spec.duration;
  const attack = spec.attack ?? 0.004;

  const osc = audio.createOscillator();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.frequency, start);
  if (spec.glideTo) {
    osc.frequency.exponentialRampToValueAtTime(spec.glideTo, end);
  }

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(spec.gain, start + attack);
  // Exponential ramps cannot reach zero, so decay to silence-in-practice.
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

function play(specs: ToneSpec[]) {
  const audio = ctx();
  if (!audio) {
    return;
  }
  try {
    specs.forEach(spec => tone(audio, spec));
  } catch {
    // Never let a sound failure interrupt play.
  }
}

export const sounds = {
  /** A precise metallic click as the signal seats into its socket. */
  signalSnap: () =>
    play([
      {frequency: 2600, type: 'square', duration: 0.045, gain: 0.16},
      {frequency: 3900, type: 'triangle', duration: 0.03, gain: 0.07},
    ]),

  /** A shorter, lower notch as it turns through a valid direction. */
  rotate: () =>
    play([{frequency: 1150, type: 'square', duration: 0.028, gain: 0.11}]),

  /** A low mechanical impact. The one sound that reports a world event. */
  doorClose: () =>
    play([
      {
        frequency: 150,
        glideTo: 62,
        type: 'triangle',
        duration: 0.24,
        gain: 0.3,
        attack: 0.002,
      },
      {frequency: 780, type: 'square', duration: 0.035, gain: 0.06},
    ]),

  /** Three notes, resolving. The only sound that is allowed to be warm. */
  everyoneOut: () =>
    play([
      {frequency: 523.25, duration: 0.34, gain: 0.14, delay: 0},
      {frequency: 659.25, duration: 0.34, gain: 0.13, delay: 0.13},
      {frequency: 783.99, duration: 0.6, gain: 0.15, delay: 0.26},
    ]),

  setEnabled(next: boolean) {
    enabled = next;
    if (!next && context) {
      context.close().catch(() => {});
      context = null;
    }
  },

  isEnabled: () => enabled,
};

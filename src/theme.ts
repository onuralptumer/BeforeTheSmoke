/**
 * Visual language.
 *
 * The game reads as a lit architectural plan on a dark ground: warm floor
 * plates inside thin dark walls, with light reserved for the three things that
 * carry meaning — teal for safety, amber for the player's one intervention,
 * red for the moment it went wrong. Everything else stays quiet.
 */

export const palette = {
  /** Behind the plan, and the chrome. */
  shell: '#15181B',
  panel: '#1B1F23',
  panelEdge: '#2A2F35',

  /** Outside the building footprint. */
  ground: '#1E2226',

  /** Floor plates. Warm, so the plan reads as lit from within. */
  floor: '#C9C0B1',
  floorAlt: '#D5CDC0',
  /** Thin structural lines. */
  wall: '#22262B',
  wallInner: '#3A4149',

  /** Fixtures and door leaves. */
  structure: '#8A9299',

  /** The player's single intervention. Used nowhere else. */
  signal: '#F2A93B',
  signalGlow: '#FFC85E',

  /** Safety: exits, rescued people, resolved routes. */
  safe: '#3FD9AE',
  safeDeep: '#1E6A57',

  /** Hazard volume. */
  smoke: '#9AA3AB',

  /** The failure and the decision that caused it. Sparing. */
  danger: '#E04B39',

  /** Observed movement. */
  routeHistory: '#D8DCE0',

  text: '#E8EBED',
  textMuted: '#7C848C',
} as const;

export const motion = {
  /** One simulation tick. The authoritative clock. */
  tickMs: 250,
  /** Visual travel within a tick. The 30 ms remainder is the decision pause. */
  stepMs: 220,
  socketPulseMs: 1600,
  panelMs: 220,
} as const;

export const layout = {
  cols: 13,
  rows: 20,
  minCell: 14,
} as const;

/** Stable digit width for the clock, without bundling a font. */
export const numeric = {
  fontVariant: ['tabular-nums'] as const,
};

/**
 * Ticks as mm:ss. The simulation counts in quarter-seconds; the interface
 * shows the wall-clock the incident would have taken.
 */
export function formatClock(tick: number): string {
  const totalSeconds = Math.round((tick * motion.tickMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The same clock to a tenth of a second.
 *
 * An incident runs for a handful of seconds, so events one tick apart round to
 * the same value at whole-second resolution — and the event strip exists
 * precisely to show the order things happened in. Anywhere that order matters
 * gets the finer format.
 */
export function formatPrecise(tick: number): string {
  const totalSeconds = (tick * motion.tickMs) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${seconds
    .toFixed(1)
    .padStart(4, '0')}`;
}

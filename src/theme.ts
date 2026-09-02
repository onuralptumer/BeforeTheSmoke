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

  /**
   * Hazard volume.
   *
   * Darkened from #9AA3AB, which measured 1.42:1 against `floor` — so close in
   * value that no amount of opacity could make a smoke cell read as a mass on
   * the plan. Four ticks in one of these incapacitates somebody, and it looked
   * like a smudge. #5F676F measures 3.19:1 on the same ground at full strength,
   * which leaves enough headroom for the mass to read as a region while still
   * being painted below full opacity.
   */
  smoke: '#5F676F',

  /** The failure and the decision that caused it. Sparing. */
  danger: '#E04B39',

  /** Observed movement. */
  routeHistory: '#D8DCE0',

  text: '#E8EBED',
  /**
   * Secondary text. Lifted from #7C848C, which measured 4.37:1 on `panel` and
   * failed AA for small text — and this is the colour every 10 and 11 px label
   * in the interface is set in, so it was failing at its worst case. #98A0A8
   * measures 6.26:1 on the same ground.
   */
  textMuted: '#98A0A8',
} as const;

export const motion = {
  /** One simulation tick. The authoritative clock. */
  tickMs: 250,
  /** Visual travel within a tick. The 30 ms remainder is the decision pause. */
  stepMs: 220,
  socketPulseMs: 1600,
  panelMs: 220,
  /** Firm magnetic placement. The one place elastic motion is allowed. */
  socketSnapMs: 140,
  /** Mechanical notch, not a spin. */
  rotateNotchMs: 120,
} as const;

/**
 * The socket pulse expressed in simulation ticks.
 *
 * While a run plays there is already a playhead re-rendering every frame, so
 * the pulse is derived from it rather than from a second timer; that means the
 * period has to be stated in the playhead's units.
 */
export const pulseTicks = motion.socketPulseMs / motion.tickMs;

export const layout = {
  cols: 13,
  rows: 20,
  minCell: 14,
} as const;

/**
 * Semantic colour roles.
 *
 * `palette` names what a colour *is*; this names what it is *for*. Components
 * should reach for these, so that changing the value of "secondary text"
 * happens once rather than at every call site — which is how `textMuted` came
 * to be failing contrast at fifteen places at once.
 */
export const semantic = {
  surface: palette.panel,
  surfaceRaised: palette.panelEdge,
  border: palette.panelEdge,
  textPrimary: palette.text,
  textSecondary: palette.textMuted,
  /** The player's one intervention. */
  accent: palette.signal,
  /** Sits on `accent`, so it is the dark shell rather than the light text. */
  onAccent: palette.shell,
  positive: palette.safe,
  negative: palette.danger,
} as const;

/**
 * Derived interaction states, so a disabled control is never hand-tuned. These
 * were 0.35 in one component and 0.3 in another for the same meaning.
 */
export const state = {
  disabledOpacity: 0.35,
  pressedOpacity: 0.7,
} as const;

/**
 * Type scale: five steps, and two tracking values for uppercase.
 *
 * Replaces nine ad-hoc font sizes (9 through 17) and nine letter-spacings.
 * design.md §9 deliberately specifies no scale — it is concerned with the
 * family, not the ramp — so this fills the gap without contradicting it.
 */
export const type = {
  /** Unit labels under a readout. */
  micro: 10,
  /** Uppercase labels and the event strip. */
  label: 11,
  /** Sentence-case body copy. */
  body: 13,
  /** Panel titles, the clock, an incident name. */
  title: 15,
  /** The safe counter, and the one word that ends a run. */
  display: 17,
} as const;

export const tracking = {
  /** Ordinary uppercase labels. */
  caps: 1.6,
  /** Large or sparse uppercase, where the extra air is the point. */
  capsWide: 2.4,
} as const;

/** 4 pt base. Nothing in the interface is spaced off this ramp. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Two radii. Small for chips and bars, medium for panels and buttons. */
export const radius = {
  sm: 4,
  md: 8,
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

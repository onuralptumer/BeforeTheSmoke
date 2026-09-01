/**
 * The palette and motion values from design.md. Single source of truth —
 * nothing in the rendering layers hard-codes a colour.
 */

export const palette = {
  background: '#F1EFE9',
  floor: '#D9D8D3',
  wall: '#252A30',
  structure: '#8E969E',
  signal: '#F2B544',
  safe: '#2F806F',
  smoke: '#66727D',
  routeHistory: '#4A5F87',
  routeFailed: '#C97367',
  text: '#191D21',
  textMuted: '#6B7076',
} as const;

export const motion = {
  /** One simulation tick. The engine's authoritative clock. */
  tickMs: 250,
  /** Visual travel time within a tick. The 30 ms remainder is the decision pause. */
  stepMs: 220,
  socketPulseMs: 1600,
  panelMs: 220,
} as const;

export const layout = {
  /** Grid dimensions every level is authored against. */
  cols: 13,
  rows: 20,
  minCell: 14,
} as const;

/** Stable digit width for the tick counter, without bundling a font. */
export const numeric = {
  fontVariant: ['tabular-nums'] as const,
};

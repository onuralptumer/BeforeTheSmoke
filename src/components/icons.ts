/**
 * Icon path registry.
 *
 * Every glyph is authored on a 24 x 24 grid with a 20 x 20 live area and a
 * 1.5 stroke, butt caps, miter joins. Paths are centrelines and are NOT
 * outlined: the stroke is applied at render time, so one definition serves
 * every size and colour.
 *
 * `fill` paths are painted solid. `stroke` paths are painted as 1.5-wide
 * centrelines and scale with the icon, so a 48 pt icon gets a 3 pt stroke.
 * Some glyphs use both.
 *
 * Generated from icons.json. Edit the source, not this file.
 */

export interface IconDefinition {
  /** Solid paths. */
  fill: string[];
  /** Centreline paths, stroked at render time. */
  stroke: string[];
}

export const ICON_GRID = 24;
export const ICON_STROKE_WIDTH = 1.5;

export const ICONS = {
  /** Optically centred: centroid at x=12, not the bounding box. This is the bug in the current View-based triangle. */
  'play': {
    fill: ['M8 4 L20 12 L8 20 Z'],
    stroke: [],
  },
  /** Bars 4 wide, 4 apart, 16 tall. */
  'pause': {
    fill: ['M6 4 H10 V20 H6 Z', 'M14 4 H18 V20 H14 Z'],
    stroke: [],
  },
  /** A real lens and pupil, replacing the bare ring currently in styles.eye. */
  'watch': {
    fill: [],
    stroke: ['M3 12 C6.5 6.5 17.5 6.5 21 12 C17.5 17.5 6.5 17.5 3 12 Z', 'M15 12 A3 3 0 1 1 9 12 A3 3 0 1 1 15 12 Z'],
  },
  'sound-on': {
    fill: [],
    stroke: ['M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z', 'M15.5 9.5 C17.2 11 17.2 13 15.5 14.5', 'M18.5 7 C21.5 10 21.5 14 18.5 17'],
  },
  /** Neutral colour, never palette.danger. Mute is a preference, not a failure. */
  'sound-off': {
    fill: [],
    stroke: ['M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z', 'M15.5 9 L21 14.5', 'M21 9 L15.5 14.5'],
  },
  'chevron-right': {
    fill: [],
    stroke: ['M9.5 5 L16.5 12 L9.5 19'],
  },
  'chevron-left': {
    fill: [],
    stroke: ['M14.5 5 L7.5 12 L14.5 19'],
  },
  /** Return to the archive. The top bar currently has no exit affordance at all. */
  'close': {
    fill: [],
    stroke: ['M6 6 L18 18', 'M18 6 L6 18'],
  },
  /** Clockwise. Arrowhead is a fill so the head stays solid at 16px. */
  'rotate': {
    fill: ['M12 1.8 L16.2 4.5 L12 7.2 Z'],
    stroke: ['M12 4.5 A7.5 7.5 0 1 1 4.5 12'],
  },
  /** Deliberately NOT a mirrored rotate arc: the two were unreadable side by side at 16px. */
  'replay': {
    fill: ['M5 4.5 H7.5 V19.5 H5 Z', 'M10 4.5 L20 12 L10 19.5 Z'],
    stroke: [],
  },
  /** Dart with a notched tail. See README: arrowPath() in SignalLayer currently emits a plain triangle because its four base points are collinear. */
  'signal-arrow': {
    fill: ['M20 12 L5.5 18.5 L9.5 12 L5.5 5.5 Z'],
    stroke: [],
  },
  'socket': {
    fill: ['M14.5 12 A2.5 2.5 0 1 1 9.5 12 A2.5 2.5 0 1 1 14.5 12 Z'],
    stroke: ['M19.5 12 A7.5 7.5 0 1 1 4.5 12 A7.5 7.5 0 1 1 19.5 12 Z'],
  },
  /** Earned. Three people, all accounted for. */
  'mark-rescue': {
    fill: ['M15 6.5 A3 3 0 1 1 9 6.5 A3 3 0 1 1 15 6.5 Z', 'M9.5 16.5 A3 3 0 1 1 3.5 16.5 A3 3 0 1 1 9.5 16.5 Z', 'M20.5 16.5 A3 3 0 1 1 14.5 16.5 A3 3 0 1 1 20.5 16.5 Z'],
    stroke: [],
  },
  /** Unearned. */
  'mark-rescue-outline': {
    fill: [],
    stroke: ['M15 6.5 A3 3 0 1 1 9 6.5 A3 3 0 1 1 15 6.5 Z', 'M9.5 16.5 A3 3 0 1 1 3.5 16.5 A3 3 0 1 1 9.5 16.5 Z', 'M20.5 16.5 A3 3 0 1 1 14.5 16.5 A3 3 0 1 1 20.5 16.5 Z'],
  },
  /** Earned. Three darts, unobstructed. */
  'mark-flow': {
    fill: ['M4 6 L9.5 12 L4 18 L6.5 12 Z', 'M10 6 L15.5 12 L10 18 L12.5 12 Z', 'M16 6 L21.5 12 L16 18 L18.5 12 Z'],
    stroke: [],
  },
  /** Unearned. */
  'mark-flow-outline': {
    fill: [],
    stroke: ['M4 6 L9.5 12 L4 18 L6.5 12 Z', 'M10 6 L15.5 12 L10 18 L12.5 12 Z', 'M16 6 L21.5 12 L16 18 L18.5 12 Z'],
  },
  /** Earned. A dial with elapsed time removed. 300 degree sector, 60 degree wedge open at 1 o'clock. */
  'mark-swift': {
    fill: ['M12 12 L18.93 8 A8 8 0 1 1 12 4 Z'],
    stroke: [],
  },
  /** Unearned. */
  'mark-swift-outline': {
    fill: [],
    stroke: ['M12 12 L18.93 8 A8 8 0 1 1 12 4 Z'],
  },
  /** Timeline strip. A leaf with its hinge. */
  'event-door': {
    fill: ['M11 12 A1.4 1.4 0 1 1 8.2 12 A1.4 1.4 0 1 1 11 12 Z'],
    stroke: ['M7 3 H17 V21 H7 Z'],
  },
  /** Timeline strip. Overlapping volumes, echoing HazardLayer. */
  'event-smoke': {
    fill: ['M13 15.5 A4.5 4.5 0 1 1 4 15.5 A4.5 4.5 0 1 1 13 15.5 Z', 'M18.5 12 A5.5 5.5 0 1 1 7.5 12 A5.5 5.5 0 1 1 18.5 12 Z', 'M21 16 A3.5 3.5 0 1 1 14 16 A3.5 3.5 0 1 1 21 16 Z'],
    stroke: [],
  },
  /** Timeline strip. record.ts emits a fourth event kind, BLOCK ('Route blocked'), alongside DOOR, SMOKE and FAILURE. */
  'event-block': {
    fill: ['M3.5 10.25 H20.5 V13.75 H3.5 Z', 'M3.5 5 H6.5 V19 H3.5 Z', 'M17.5 5 H20.5 V19 H17.5 Z'],
    stroke: [],
  },
  /** Timeline strip. Deliberately not an X, which would collide with close. */
  'event-failure': {
    fill: ['M12 4 L20.5 19.5 L3.5 19.5 Z'],
    stroke: [],
  },
  /** Archive card stamp. */
  'resolved': {
    fill: [],
    stroke: ['M4.5 12.5 L9.5 17.5 L19.5 6.5'],
  },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;

/** Marks have an earned and an unearned silhouette, never one at low opacity. */
export const markIcon = (
  mark: 'rescue' | 'flow' | 'swift',
  earned: boolean,
): IconName =>
  (earned ? `mark-${mark}` : `mark-${mark}-outline`) as IconName;

/**
 * The four kinds record.ts emits onto the timeline. The union is repeated here
 * rather than imported so this file stays free of game imports; TimelineEvent
 * in src/game/replay/record.ts is the definition it must match.
 */
export const eventIcon = (
  kind: 'DOOR' | 'SMOKE' | 'BLOCK' | 'FAILURE',
): IconName => {
  switch (kind) {
    case 'DOOR':
      return 'event-door';
    case 'SMOKE':
      return 'event-smoke';
    case 'BLOCK':
      return 'event-block';
    case 'FAILURE':
      return 'event-failure';
  }
};

/**
 * The Daily Incident.
 *
 * Everyone gets the same building on the same day, and the day's puzzle is a
 * single integer: the seed. Nothing has to be shipped, stored or downloaded —
 * `generateLevel` is deterministic, so a date names a level as completely as a
 * file would, on every device and every platform.
 *
 * The day boundary is UTC. Not for tidiness: a local boundary would let a
 * player move their clock forward to fetch tomorrow's incident and take as long
 * as they liked over it, which would make any leaderboard meaningless.
 *
 * Deriving a day's level means searching seeds until one clears the difficulty
 * targets — a candidate takes a few milliseconds to grade and about one in a
 * hundred is accepted. That is fine once a day and far too slow once a frame,
 * so the result is memoised per day.
 */

import {LevelDefinition} from './types';
import {findLevels} from './levels/generate';
import {DifficultyTargets} from './levels/difficulty';

const MS_PER_DAY = 86_400_000;

/** Whole days since the Unix epoch, in UTC. */
export function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

/**
 * The seed the day's search starts from.
 *
 * Spread deliberately: consecutive days must not begin at adjacent seeds, or
 * two days running would often land on the same accepted candidate and the
 * "daily" incident would repeat.
 */
export function dailySeed(date: Date): number {
  const day = dayNumber(date);
  // Knuth's multiplicative constant, kept in 32 bits so it behaves identically
  // everywhere. The shift is the point, not an optimisation: without it the
  // sign bit would flip and two clients could disagree about today's puzzle.
  // eslint-disable-next-line no-bitwise
  return ((Math.imul(day, 2654435761) >>> 0) % 1_000_000) + 1;
}

export interface DailyIncident {
  /** UTC day index, and the identity of the puzzle. */
  day: number;
  /** The accepted seed — the level's whole definition. */
  seed: number;
  level: LevelDefinition;
}

const cache = new Map<number, DailyIncident | null>();

/**
 * The incident for a given day, or null if the search found nothing within its
 * budget — a caller should fall back to the authored levels rather than block.
 */
export function dailyIncident(
  date: Date = new Date(),
  targets?: DifficultyTargets,
): DailyIncident | null {
  const day = dayNumber(date);
  const hit = cache.get(day);
  if (hit !== undefined) {
    return hit;
  }

  const found = findLevels(1, targets, 3000, dailySeed(date));
  const incident: DailyIncident | null =
    found.length > 0
      ? {
          day,
          seed: found[0].seed,
          level: {
            ...found[0].level,
            id: `daily-${day}`,
            title: `Daily Incident ${day}`,
            teaches: 'One building. Everybody gets the same one today.',
          },
        }
      : null;

  cache.set(day, incident);
  return incident;
}

/** Testing seam: forget memoised days. */
export function clearDailyCache() {
  cache.clear();
}

/**
 * Ranking a run.
 *
 * The game used to be pass/fail: a placement either saved everyone or it did
 * not, and every failure looked identical to every other. That is what made
 * guessing rational — a wrong answer told you nothing, so there was no reason
 * to think before the next one.
 *
 * A run is ranked instead, on four figures the engine already produces, in
 * strict priority:
 *
 *   1. how many people got out            — the only thing that is not a detail
 *   2. how long it took                    — a finished evacuation beats a slow one
 *   3. how much exposure they took         — near-misses are worse than clean runs
 *   4. how long anyone stood still         — queueing is the last tie-break
 *
 * The order matters more than the arithmetic. Saving one more person is always
 * worth more than any improvement in time, so the figures are compared in
 * sequence rather than folded into a single weighted number, where a large
 * enough time saving could otherwise outweigh somebody's life.
 */

import {RunResult} from './types';

export interface RunScore {
  savedCount: number;
  /** Null when nobody finished; ranks below any real time. */
  finishTick: number | null;
  totalExposure: number;
  totalWaitTicks: number;
}

export const scoreOf = (result: RunResult): RunScore => ({
  savedCount: result.savedCount,
  finishTick: result.finishTick,
  totalExposure: result.totalExposure,
  totalWaitTicks: result.totalWaitTicks,
});

/**
 * Negative when `a` is the better run, positive when `b` is, zero when they are
 * indistinguishable. Ordered so `runs.sort(compareRuns)` puts the best first.
 */
export function compareRuns(a: RunResult, b: RunResult): number {
  if (a.savedCount !== b.savedCount) {
    return b.savedCount - a.savedCount;
  }
  // A run nobody finished is worse than any finished one, and two unfinished
  // runs are equal on time.
  if (a.finishTick !== b.finishTick) {
    if (a.finishTick === null) {
      return 1;
    }
    if (b.finishTick === null) {
      return -1;
    }
    return a.finishTick - b.finishTick;
  }
  if (a.totalExposure !== b.totalExposure) {
    return a.totalExposure - b.totalExposure;
  }
  return a.totalWaitTicks - b.totalWaitTicks;
}

/** True when `a` is strictly better than `b`. */
export const isBetterRun = (a: RunResult, b: RunResult) => compareRuns(a, b) < 0;

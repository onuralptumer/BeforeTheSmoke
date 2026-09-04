/**
 * Measuring how good a level is, rather than whether it works.
 *
 * `validateLevel` answers a yes/no question: is this incident playable. This
 * answers the question that actually decides whether a level is worth playing,
 * and it exists because two attempts at adding depth by widening the mechanics
 * — a signal budget above one, and a settable activation tick — both measured
 * as making the existing levels *easier* rather than deeper. More ways to win
 * is not more depth. What matters is the shape of the outcome space:
 *
 *   selectivity   how rare a winning option is. A level where a third of all
 *                 placements win rewards tapping through them.
 *   decoyStrength how many losing options come within one person of winning.
 *                 Near-misses are what make a wrong answer instructive.
 *   outcomeSpread how many options produce a result that differs from doing
 *                 nothing at all. This is the metric the hand-authored levels
 *                 fail hardest: a loss that matches the baseline taught the
 *                 player nothing about their choice.
 *   winMargin     how much better the best solution is than the second best.
 *                 Zero means every way of winning is equivalent, so there is
 *                 nothing left to optimise once the level is beaten — which is
 *                 exactly why Swift and Flow currently come free.
 *
 * These are the acceptance criteria a generated level would have to clear, so
 * the same function that grades the hand-authored ten is the fitness function
 * for generating more.
 */

import {LevelDefinition, RunResult, SignalPlacement} from '../types';
import {compareRuns} from '../score';
import {enumerateSignalSets, runLevel} from './validate';

export interface DifficultyReport {
  levelId: string;
  options: number;
  waysToWin: number;
  /** waysToWin / options. Lower is more selective. */
  selectivity: number;
  /** Losing options that save within one person of everybody. */
  decoyStrength: number;
  /** Options whose outcome differs from the baseline in any observable way. */
  outcomeSpread: number;
  /**
   * Ticks by which the best solution beats the second best, or 0 when there is
   * only one way to win — in which case there is nothing to optimise.
   */
  winMargin: number;
  baselineFails: boolean;
}

/**
 * How close a losing run has to come to count as a near-miss.
 *
 * Proportional, not absolute. Losing one of four is a different experience from
 * losing one of nine, and requiring `total - 1` regardless meant every
 * candidate with a crowd larger than four was rejected — the door catches two
 * people out of eight as readily as it catches one out of four, and that is
 * still a near-miss the player can learn from.
 */
const nearMissThreshold = (r: RunResult) =>
  r.totalCount - Math.max(1, Math.floor(r.totalCount / 4));

/** Everything about a run a player could tell apart. */
const signature = (r: RunResult) =>
  [
    r.success,
    r.savedCount,
    r.finishTick,
    r.totalWaitTicks,
    r.totalExposure,
    r.failureReason,
    [...r.failedAgentIds].sort().join(','),
  ].join('/');

export function difficultyOf(level: LevelDefinition): DifficultyReport {
  const baseline = runLevel(level, null);
  const sets: SignalPlacement[][] = enumerateSignalSets(level);
  const results = sets.map(set => runLevel(level, set));

  const wins = results.filter(r => r.success).sort(compareRuns);
  const losses = results.filter(r => !r.success);
  const baseSig = signature(baseline);

  return {
    levelId: level.id,
    options: results.length,
    waysToWin: wins.length,
    selectivity: results.length === 0 ? 0 : wins.length / results.length,
    decoyStrength: losses.filter(r => r.savedCount >= nearMissThreshold(r))
      .length,
    outcomeSpread: results.filter(r => signature(r) !== baseSig).length,
    winMargin:
      wins.length > 1
        ? (wins[1].finishTick ?? 0) - (wins[0].finishTick ?? 0)
        : 0,
    baselineFails: !baseline.success,
  };
}

/**
 * Whether a level clears the bar. Thresholds are the knobs a generator would
 * search against; they are deliberately not asserted against the existing ten,
 * which do not all pass.
 */
export interface DifficultyTargets {
  maxSelectivity: number;
  minDecoyStrength: number;
  minOutcomeSpread: number;
  minWinMargin: number;
}

export const DEFAULT_TARGETS: DifficultyTargets = {
  maxSelectivity: 0.34,
  minDecoyStrength: 1,
  minOutcomeSpread: 2,
  minWinMargin: 1,
};

export function gradeLevel(
  report: DifficultyReport,
  targets: DifficultyTargets = DEFAULT_TARGETS,
): string[] {
  const failures: string[] = [];
  if (!report.baselineFails) {
    failures.push('baseline succeeds: there is no incident to diagnose');
  }
  if (report.waysToWin === 0) {
    failures.push('no option wins');
  }
  if (report.selectivity > targets.maxSelectivity) {
    failures.push(
      `selectivity ${report.selectivity.toFixed(2)} above ${targets.maxSelectivity}: too many options win`,
    );
  }
  if (report.decoyStrength < targets.minDecoyStrength) {
    failures.push(
      `decoyStrength ${report.decoyStrength} below ${targets.minDecoyStrength}: no near-miss to learn from`,
    );
  }
  if (report.outcomeSpread < targets.minOutcomeSpread) {
    failures.push(
      `outcomeSpread ${report.outcomeSpread} below ${targets.minOutcomeSpread}: most options do nothing the baseline did not`,
    );
  }
  if (report.winMargin < targets.minWinMargin) {
    failures.push(
      `winMargin ${report.winMargin} below ${targets.minWinMargin}: every way of winning is equally good`,
    );
  }
  return failures;
}

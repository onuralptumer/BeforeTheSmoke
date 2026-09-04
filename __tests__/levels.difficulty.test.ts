/**
 * What the difficulty oracle says about the ten hand-authored levels.
 *
 * Recorded, not asserted. Every level is *playable* — `levels.validation`
 * proves that, and it stays a hard gate. This measures something else: how much
 * shape the outcome space has, which is what decides whether a level rewards
 * thinking or rewards tapping.
 *
 * The results are unflattering by design. They are the baseline a generated
 * level would have to beat, and the diff that will show whether any future
 * change to the mechanics actually improved a level or merely widened it.
 */

import {LEVELS} from '../src/game/levels';
import {DEFAULT_TARGETS, difficultyOf, gradeLevel} from '../src/game/levels/difficulty';

describe('level difficulty', () => {
  it('grades every level against the targets', () => {
    const rows = LEVELS.map(level => {
      const report = difficultyOf(level);
      return {
        ...report,
        selectivity: Number(report.selectivity.toFixed(2)),
        failsTargets: gradeLevel(report),
      };
    });
    expect(rows).toMatchSnapshot();
  });

  it('every level is at least solvable and starts from a real incident', () => {
    for (const level of LEVELS) {
      const report = difficultyOf(level);
      expect(report.baselineFails).toBe(true);
      expect(report.waysToWin).toBeGreaterThan(0);
    }
  });

  it('the targets are self-consistent', () => {
    expect(DEFAULT_TARGETS.maxSelectivity).toBeGreaterThan(0);
    expect(DEFAULT_TARGETS.maxSelectivity).toBeLessThan(1);
  });
});

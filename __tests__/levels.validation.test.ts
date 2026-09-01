/**
 * Exhaustive per-level validation. For every level this asserts the three
 * properties a playable incident must have:
 *
 *   1. the baseline run fails, so there is something to diagnose;
 *   2. every documented intended solution actually succeeds;
 *   3. every documented tempting failure actually fails.
 *
 * It also fails on *undocumented* solutions, which is how an accidentally
 * trivial level gets caught.
 */

import {LEVELS} from '../src/game/levels';
import {describeReport, validateLevel} from '../src/game/levels/validate';

describe('level validation', () => {
  for (const level of LEVELS) {
    it(`${level.id} — ${level.title}`, () => {
      const report = validateLevel(level);
      if (report.problems.length > 0) {
        throw new Error(`\n${describeReport(report)}`);
      }
      expect(report.baseline.success).toBe(false);
      expect(report.solutions.length).toBeGreaterThan(0);
    });
  }
});

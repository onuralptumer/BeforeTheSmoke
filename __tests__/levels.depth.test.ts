/**
 * How much room a level leaves for playing it well.
 *
 * `levels.validation` asks whether a level works. This asks whether it is worth
 * replaying, which is a different and currently unflattering question.
 *
 * The measured position, recorded rather than asserted: every level has exactly
 * one winning placement, and `parFinishTick` was authored as that placement's
 * finish time. So Swift and Flow are handed over with the win — they cannot be
 * missed, and a mark that cannot be missed measures nothing.
 *
 * This is deliberately a snapshot and not a pass/fail. Nine of the ten levels
 * cannot satisfy the rule that would fix it — "some winning placement must miss
 * Swift" needs at least two ways to win, and they have one. Failing the build
 * over that would only mean deleting the test. The snapshot instead makes the
 * flatness visible, and turns any future level that improves it into a diff.
 */

import {LEVELS} from '../src/game/levels';
import {enumerateSignalSets, runLevel, validateLevel} from '../src/game/levels/validate';
import {compareRuns} from '../src/game/score';

describe('level depth', () => {
  it('records how many ways there are to win, and how good they are', () => {
    const rows = LEVELS.map(level => {
      const sets = enumerateSignalSets(level);
      const wins = sets
        .map(set => ({set, result: runLevel(level, set)}))
        .filter(x => x.result.success)
        .sort((a, b) => compareRuns(a.result, b.result));

      return {
        level: level.id,
        options: sets.length,
        waysToWin: wins.length,
        finishTicks: [...new Set(wins.map(w => w.result.finishTick))],
        par: level.parFinishTick,
        // The gap between the best and worst way of winning. Zero means every
        // solution is equally good and there is nothing to optimise.
        spread:
          wins.length > 1
            ? (wins[wins.length - 1].result.finishTick ?? 0) -
              (wins[0].result.finishTick ?? 0)
            : 0,
        warnings: validateLevel(level).warnings,
      };
    });

    expect(rows).toMatchSnapshot();
  });

  it('has no structural problems anywhere', () => {
    for (const level of LEVELS) {
      expect(validateLevel(level).problems).toEqual([]);
    }
  });
});

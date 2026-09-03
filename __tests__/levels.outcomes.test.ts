/**
 * Behavioural lock on all ten levels, in two tiers.
 *
 * `levels.validation.test.ts` asserts the *structural* properties an incident
 * must have — baseline fails, intended solutions succeed, traps fail. This file
 * asserts something stricter: that authoring content into a level did not
 * quietly change how it plays.
 *
 * It exists because smoke is mechanical. It costs SMOKE_COST (10) per cell in
 * route weighting and one exposure per tick to anyone standing in it, and this
 * game has no dead floor to put it on: `WorldMap` derives the tile grid from
 * the navigation graph, so every walkable cell is a cell some route uses. Any
 * smoke a player can reason about therefore perturbs the simulation.
 *
 * So the two tiers separate what must not move from what is allowed to:
 *
 *   VERDICT — baseline outcome, every placement's win/lose, the solution set,
 *   and the complete outcome of every *winning* placement (what the player is
 *   scored on). This is the game. A diff here means the smoke changed which
 *   placement wins or how well it wins, and the smoke must move — never `-u`.
 *
 *   FAILURE TEXTURE — how badly the *losing* placements lose: saved count,
 *   exposure, failure reason, who was lost. This is expected to move as smoke
 *   is authored, and moving it is the point. IMPROVEMENTS.md §A1 measured that
 *   every losing placement currently saves exactly the baseline number, so a
 *   loss carries no information; smoke that makes a bad route cost more people
 *   is the gradient that was missing. Review this diff, then update it.
 */

import {LEVELS} from '../src/game/levels';
import {validateLevel} from '../src/game/levels/validate';
import {RunResult, SignalPlacement} from '../src/game/types';

/** A signal set's identity, order-independent so a set has one name. */
const label = (set: SignalPlacement[]) =>
  set.map(p => `${p.socketId}->${p.edgeId}`).sort().join(' + ');

/** What the player is scored on. Locked for winning runs. */
const scored = (result: RunResult) => ({
  saved: `${result.savedCount}/${result.totalCount}`,
  finishTick: result.finishTick,
  totalWaitTicks: result.totalWaitTicks,
  marks: result.marks,
});

/**
 * How a loss went. `failedAgentIds` is sorted because it is an outcome, not an
 * ordering — two runs that lose the same people are the same run.
 */
const texture = (result: RunResult) => ({
  saved: `${result.savedCount}/${result.totalCount}`,
  totalExposure: result.totalExposure,
  failureReason: result.failureReason,
  failedAgentIds: [...result.failedAgentIds].sort(),
});

describe('level outcomes', () => {
  for (const level of LEVELS) {
    describe(`${level.id} — ${level.title}`, () => {
      it('verdict is unchanged', () => {
        const report = validateLevel(level);

        expect({
          baselineSucceeds: report.baseline.success,
          verdicts: Object.fromEntries(
            report.placements.map(({placement, result}) => [
              label(placement),
              result.success ? 'SAFE' : 'FAILS',
            ]),
          ),
          solutions: report.solutions.map(label),
          winningRuns: Object.fromEntries(
            report.placements
              .filter(p => p.result.success)
              .map(({placement, result}) => [label(placement), scored(result)]),
          ),
          problems: report.problems,
        }).toMatchSnapshot();
      });

      it('failure texture', () => {
        const report = validateLevel(level);

        expect({
          baseline: texture(report.baseline),
          losingRuns: Object.fromEntries(
            report.placements
              .filter(p => !p.result.success)
              .map(({placement, result}) => [label(placement), texture(result)]),
          ),
        }).toMatchSnapshot();
      });
    });
  }
});

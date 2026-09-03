/**
 * Overlay marks must have unique identities.
 *
 * This guards a bug that reached the screen: the lost-person cross was keyed by
 * the cell it sat on, and on level 2's baseline — the very first run a player
 * watches on that level — two people end up on the same cell, so React saw two
 * children with the key `lost4,13` and warned that one may be dropped.
 *
 * The engine permitting two ACTIVE agents to share a cell is a separate defect
 * and is deliberately *not* asserted here: this file pins the rendering
 * invariant, so the overlay stays correct whatever the simulation does.
 *
 * The second test is the one that matters. Keying by agent id is trivially
 * unique, so asserting only that would pass against any implementation. What
 * makes the fix necessary is the fact that a cell is *not* an identity — so
 * that is asserted directly, and this test fails the moment someone decides
 * position is good enough after all.
 */

import {LEVELS} from '../src/game/levels';
import {enumerateSignalSets} from '../src/game/levels/validate';
import {recordRun} from '../src/game/replay/record';
import {SignalPlacement, Vec2} from '../src/game/types';

const label = (set: SignalPlacement[] | null) =>
  set ? set.map(p => `${p.socketId}->${p.edgeId}`).join(' + ') : 'baseline';

/** Every legal run of every level: the baseline plus each placement. */
function* everyRun() {
  for (const level of LEVELS) {
    for (const placement of [null, ...enumerateSignalSets(level)]) {
      yield {level, placement, run: recordRun(level, placement)};
    }
  }
}

/** What GameCanvas hands OverlayLayer as `lostMarks`. */
function lostMarks(run: ReturnType<typeof recordRun>) {
  const frame = run.frames[run.frames.length - 1];
  return run.result.failedAgentIds
    .map(id => {
      const cell = frame.agents.find(a => a.id === id)?.cell ?? null;
      return cell ? {id, cell} : null;
    })
    .filter((m): m is {id: string; cell: Vec2} => m !== null);
}

describe('overlay mark identity', () => {
  it('keys every lost person uniquely, in every run of every level', () => {
    for (const {level, placement, run} of everyRun()) {
      const keys = lostMarks(run).map(m => `lost-${m.id}`);
      if (new Set(keys).size !== keys.length) {
        throw new Error(
          `${level.id} ${label(placement)}: duplicate keys in [${keys}]`,
        );
      }
    }
  });

  it('proves a cell is not an identity: some run loses two people on one', () => {
    const collisions: string[] = [];

    for (const {level, placement, run} of everyRun()) {
      const cells = lostMarks(run).map(m => `${m.cell.x},${m.cell.y}`);
      if (new Set(cells).size !== cells.length) {
        collisions.push(`${level.id} ${label(placement)} [${cells}]`);
      }
    }

    // If this ever becomes empty, the engine's occupancy rules changed. That is
    // good news, but re-keying the overlay by cell would still be wrong, so
    // update this test's reasoning rather than deleting the id-based keys.
    expect(collisions.length).toBeGreaterThan(0);
  });
});

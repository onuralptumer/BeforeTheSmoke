/**
 * Identical input must produce identical output (spec §4.2). Two independent
 * runs of every level, under every signal placement, must emit byte-identical
 * frame snapshots and decision logs.
 */

import {SimulationEngine} from '../src/game/engine/SimulationEngine';
import {LEVELS} from '../src/game/levels';
import {enumeratePlacements} from '../src/game/levels/validate';
import {LevelDefinition, SignalPlacement} from '../src/game/types';

function trace(level: LevelDefinition, signal: SignalPlacement | null): string {
  const engine = new SimulationEngine(level, signal);
  const frames = [engine.snapshot()];
  while (!engine.finished) {
    engine.step();
    frames.push(engine.snapshot());
  }
  return JSON.stringify({
    frames,
    decisions: engine.decisionLog,
    result: engine.result(),
  });
}

describe('determinism', () => {
  for (const level of LEVELS) {
    const placements: Array<SignalPlacement | null> = [
      null,
      ...enumeratePlacements(level),
    ];
    it(`${level.id} replays identically under every placement`, () => {
      for (const placement of placements) {
        expect(trace(level, placement)).toEqual(trace(level, placement));
      }
    });
  }
});

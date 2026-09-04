/**
 * The generated levels that actually ship.
 *
 * Levels 11 to 14 are kept as a seed plus an authored title, not as expanded
 * data — the generator is deterministic, so the seed is the geometry. That is
 * economical but it puts a released level at the mercy of the grammar: a tweak
 * intended to improve future search results would silently reshape a level
 * somebody has already played.
 *
 * These assertions are the guard. They pin what each shipped level *is* — its
 * size, who is in it, what par is, and the properties it was chosen for — so
 * that change fails the build and has to be made on purpose.
 */

import {LEVELS} from '../src/game/levels';
import {difficultyOf, gradeLevel} from '../src/game/levels/difficulty';
import {validateLevel} from '../src/game/levels/validate';

interface Expectation {
  id: string;
  agents: number;
  followers: number;
  slow: number;
  par: number;
  waysToWin: number;
  winMargin: number;
}

const SHIPPED: Expectation[] = [
  {id: 'level-11', agents: 4, followers: 0, slow: 1, par: 28, waysToWin: 2, winMargin: 4},
  {id: 'level-12', agents: 4, followers: 2, slow: 1, par: 28, waysToWin: 2, winMargin: 4},
  {id: 'level-13', agents: 8, followers: 0, slow: 1, par: 36, waysToWin: 2, winMargin: 4},
  {id: 'level-14', agents: 8, followers: 6, slow: 1, par: 36, waysToWin: 2, winMargin: 4},
];

describe('shipped generated levels', () => {
  for (const want of SHIPPED) {
    describe(want.id, () => {
      const level = LEVELS.find(l => l.id === want.id)!;

      it('exists and is playable', () => {
        expect(level).toBeDefined();
        expect(validateLevel(level).problems).toEqual([]);
      });

      it('has the crowd it was chosen for', () => {
        expect(level.agents).toHaveLength(want.agents);
        expect(level.agents.filter(a => a.type === 'FOLLOWER')).toHaveLength(
          want.followers,
        );
        expect(level.agents.filter(a => a.type === 'SLOW')).toHaveLength(
          want.slow,
        );
      });

      it('keeps its par and its shape', () => {
        const report = difficultyOf(level);
        expect(level.parFinishTick).toBe(want.par);
        expect(report.waysToWin).toBe(want.waysToWin);
        expect(report.winMargin).toBe(want.winMargin);
      });

      it('still clears every difficulty target', () => {
        expect(gradeLevel(difficultyOf(level))).toEqual([]);
      });

      it('has a mark that can actually be missed', () => {
        // The reason these levels exist: a player can save everybody and still
        // not earn Swift, which is impossible in any of the original ten.
        expect(difficultyOf(level).winMargin).toBeGreaterThan(0);
      });

      it('points the analysis at the decision that mattered', () => {
        const best = level.intendedSolutions[0];
        const socket = level.signalSockets.find(s => s.id === best.socketId)!;
        expect(level.criticalDecision.junctionId).toBe(socket.junctionId);
      });

      it('has an authored identity, not a generated placeholder', () => {
        expect(level.title).not.toMatch(/^Generated/);
        expect(level.teaches).not.toMatch(/^Generated/);
        expect(level.title.length).toBeGreaterThan(3);
      });
    });
  }
});

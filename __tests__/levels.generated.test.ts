/**
 * Generated incidents, and the property they have that the hand-authored ones
 * do not.
 *
 * Every one of the ten shipped levels scores `winMargin: 0` — each has exactly
 * one winning placement, so Swift and Flow are handed over with the win and
 * measure nothing. That is not a par-authoring mistake; it is a shape the
 * levels simply do not have, and no amount of retuning `parFinishTick` creates
 * it.
 *
 * Searching finds it. The generator emits candidates from a grammar and
 * `difficultyOf` grades them; only those clearing every target survive. The
 * accepted levels have two winning placements of *different* quality, so par is
 * a target a player can miss while still saving everybody.
 *
 * These tests pin the search's yield rather than a specific level, because the
 * value is the process: change the grammar or the targets and this says
 * immediately whether the result got better or worse.
 */

import {findLevels, buildCandidate, settle} from '../src/game/levels/generate';
import {difficultyOf, gradeLevel} from '../src/game/levels/difficulty';
import {validateLevel} from '../src/game/levels/validate';
import {LEVELS} from '../src/game/levels';

const SEARCH_LIMIT = 1200;

describe('generated levels', () => {
  const found = findLevels(4, undefined, SEARCH_LIMIT);

  it('finds levels that clear every difficulty target', () => {
    expect(found.length).toBeGreaterThan(0);
    for (const {level} of found) {
      expect(gradeLevel(difficultyOf(level))).toEqual([]);
    }
  });

  it('produces levels the existing validator accepts', () => {
    for (const {seed, level} of found) {
      const report = validateLevel(level);
      if (report.problems.length > 0) {
        throw new Error(`seed ${seed}:\n${report.problems.join('\n')}`);
      }
    }
  });

  it('achieves the win margin no hand-authored level has', () => {
    // The original ten, by id — LEVELS now also contains generated levels, and
    // comparing against those would compare the search with itself.
    const HAND_AUTHORED = LEVELS.filter(l => /^level-(0[1-9]|10)$/.test(l.id));
    expect(HAND_AUTHORED).toHaveLength(10);

    const authored = HAND_AUTHORED.map(l => difficultyOf(l).winMargin);
    // The measured position: every hand-authored level is flat.
    expect(Math.max(...authored)).toBe(0);

    for (const {level} of found) {
      expect(difficultyOf(level).winMargin).toBeGreaterThan(0);
    }
  });

  it('offers a losing option that comes within one person of winning', () => {
    for (const {level} of found) {
      expect(difficultyOf(level).decoyStrength).toBeGreaterThan(0);
    }
  });

  it('is deterministic: a seed always names the same level', () => {
    for (const {seed} of found) {
      const a = settle(buildCandidate(seed)!)!;
      const b = settle(buildCandidate(seed)!)!;
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    }
  });

  it('records which seeds the search accepts', () => {
    expect(found.map(f => f.seed)).toMatchSnapshot();
  });
});

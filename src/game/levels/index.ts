import {LevelDefinition} from '../types';
import {level01} from './level01';
import {level02} from './level02';
import {level03} from './level03';
import {level04} from './level04';
import {level05} from './level05';
import {level06} from './level06';
import {level07} from './level07';
import {level08} from './level08';
import {level09} from './level09';
import {level10} from './level10';
// Found by search and graded by the difficulty oracle, then given an identity.
// These are the first levels in the game with more than one way to win, so
// they are also the first where a mark can be missed. See generate.ts.
import {level11} from './level11';
import {level12} from './level12';
import {level13} from './level13';
import {level14} from './level14';

export const LEVELS: LevelDefinition[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
  level11,
  level12,
  level13,
  level14,
];

export const levelById = (id: string): LevelDefinition => {
  const level = LEVELS.find(l => l.id === id);
  if (!level) {
    throw new Error(`unknown level ${id}`);
  }
  return level;
};

export {
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
  level11,
  level12,
  level13,
  level14,
};

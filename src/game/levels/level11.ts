/**
 * Level 11 — Two Ways Out
 * Teaches: saving everybody is not the same as saving them well.
 *
 * The first level in the game with more than one right answer. Both signals get
 * all four people out; one of them takes four ticks longer, and only the faster
 * earns Swift. Every level before this hands the marks over with the win.
 *
 * Found by search rather than authored: see generate.ts.
 */

import {fromSeed} from './generate';

export const level11 = fromSeed(2948, {
  id: 'level-11',
  title: 'Two Ways Out',
  teaches: 'Both rescues work. One of them is quicker.',
});

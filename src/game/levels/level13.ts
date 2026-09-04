/**
 * Level 13 — The Long Tail
 * Teaches: a crowd does not arrive together, so a route does not close for
 * everybody at once.
 *
 * Eight people through the same closing corridor. The leaders are already out
 * when it shuts and the tail is not, which is why the failure here costs two
 * people rather than everyone — and why the fix has to be early.
 */

import {fromSeed} from './generate';

export const level13 = fromSeed(1776, {
  id: 'level-13',
  title: 'The Long Tail',
  teaches: 'The front of a crowd escapes a closing route. The back does not.',
});

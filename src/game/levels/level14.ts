/**
 * Level 14 — Six Who Follow
 * Teaches: leverage and scale together.
 *
 * A crowd of eight, six of them Followers, strung out behind one leader who is
 * walking into a corridor that shuts. One arrow moves all of them; put it in
 * the wrong place and it moves all of them there instead.
 */

import {fromSeed} from './generate';

export const level14 = fromSeed(2346, {
  id: 'level-14',
  title: 'Six Who Follow',
  teaches: 'One signal turns eight people. It had better be the right one.',
});

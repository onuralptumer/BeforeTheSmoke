/**
 * Level 12 — Someone To Follow
 * Teaches: a crowd that copies has a single point of leverage.
 *
 * The same shutting corridor, but the people behind the leader are Followers.
 * They do not read the plan, they read whoever is in front — so the signal only
 * ever needs to reach one person, and reaching them late reaches nobody.
 */

import {fromSeed} from './generate';

export const level12 = fromSeed(1708, {
  id: 'level-12',
  title: 'Someone To Follow',
  teaches: 'Followers copy the person ahead. Turn that person.',
});

/**
 * Level 9 — The Unseen Effect
 * Teaches: a signal can turn people who never see it.
 *
 * The socket at J1 is on the leader's route only. The Follower group never
 * passes it. Turning the leader east sends them walking past J2 exactly as the
 * group arrives there — the first Follower copies the leader, and each
 * Follower after that copies the one in front.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const SA = node('SA', 'SPAWN', at(1, 14));
const SB = node('SB', 'SPAWN', at(9, 18));
const J1 = node('J1', 'JUNCTION', at(4, 14));
const J2 = node('J2', 'JUNCTION', at(9, 14));
const E1 = node('E1', 'EXIT', at(9, 10));
const E2 = node('E2', 'EXIT', at(11, 17));

const eSaJ1 = edge('e_sa_j1', SA, J1); // [3]
const eSbJ2 = edge('e_sb_j2', SB, J2); // [4]
const eJ1E1 = edge('e_j1_e1', J1, E1, at(4, 10)); // [9]
// The leader's eastern route runs along y=16, two cells south of J2.
const eJ1E2 = edge('e_j1_e2', J1, E2, at(4, 16), at(11, 16)); // [10]
const eJ2E1 = edge('e_j2_e1', J2, E1); // [4]
const eJ2E2 = edge('e_j2_e2', J2, E2, at(11, 14)); // [5]

export const level09: LevelDefinition = {
  id: 'level-09',
  title: 'The Unseen Effect',
  teaches: 'One turned leader converts a group that never reads the sign.',
  width: 13,
  height: 20,
  graph: {
    nodes: [SA, SB, J1, J2, E1, E2],
    edges: [eSaJ1, eSbJ2, eJ1E1, eJ1E2, eJ2E1, eJ2E2],
  },
  doorCells: [at(9, 10)],
  agents: [
    {id: 'leader', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    // The group sets off later, so it reaches J2 while the leader is passing.
    {id: 'f1', type: 'FOLLOWER', spawnNodeId: 'SB', scheduledTick: 5},
    {id: 'f2', type: 'FOLLOWER', spawnNodeId: 'SB', scheduledTick: 5},
    {id: 'f3', type: 'FOLLOWER', spawnNodeId: 'SB', scheduledTick: 5},
    {id: 'f4', type: 'FOLLOWER', spawnNodeId: 'SB', scheduledTick: 5},
    {id: 'f5', type: 'FOLLOWER', spawnNodeId: 'SB', scheduledTick: 5},
  ],
  signalSockets: [
    {
      id: 'sock-j1',
      junctionId: 'J1',
      allowedEdgeIds: [eJ1E1.id, eJ1E2.id],
      anchorCell: at(4, 13),
    },
    {
      id: 'sock-j2',
      junctionId: 'J2',
      allowedEdgeIds: [eJ2E1.id, eJ2E2.id],
      anchorCell: at(9, 13),
    },
  ],
  events: [{tick: 12, type: 'CLOSE_DOOR', cell: at(9, 10)}],
  maxTicks: 50,
  parFinishTick: 22,
  maxWaitTicksForFlow: 4,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eJ1E2.id}],
  // Saves the group and loses the leader: the signal at J2 is read by everyone
  // except the one person it needed to reach.
  temptingFailures: [{socketId: 'sock-j2', edgeId: eJ2E2.id}],
};

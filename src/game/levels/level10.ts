/**
 * Level 10 — Before the Smoke
 * Teaches: find the cause, not the symptom.
 *
 * Nine people, two groups, one central doorway. The visible failure is smoke
 * exposure; the cause is a queue; the cause of the queue is two flows merging;
 * and the highest-leverage place to change that is J1, where turning one
 * leader takes four Followers with them and leaves the central route with
 * enough capacity for the slow person in the other group.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const SA = node('SA', 'SPAWN', at(3, 18));
const SB = node('SB', 'SPAWN', at(9, 18));
const J1 = node('J1', 'JUNCTION', at(3, 15));
const J2 = node('J2', 'JUNCTION', at(9, 15));
const J3 = node('J3', 'JUNCTION', at(6, 13));
const E1 = node('E1', 'EXIT', at(6, 9));
const E2 = node('E2', 'EXIT', at(0, 8));
const E3 = node('E3', 'EXIT', at(12, 8));
const E4 = node('E4', 'EXIT', at(0, 13));

const eSaJ1 = edge('e_sa_j1', SA, J1); // [3]
const eSbJ2 = edge('e_sb_j2', SB, J2); // [3]
const eJ1J3 = edge('e_j1_j3', J1, J3, at(3, 13)); // [5]
const eJ2J3 = edge('e_j2_j3', J2, J3, at(9, 13)); // [5]
const eJ3E1 = edge('e_j3_e1', J3, E1); // [4] through the one-tile door
const eJ3E4 = edge('e_j3_e4', J3, E4, at(6, 11), at(0, 11)); // [10]
const eJ1E2 = edge('e_j1_e2', J1, E2, at(0, 15)); // [10]
const eJ2E3 = edge('e_j2_e3', J2, E3, at(12, 15)); // [10]

export const level10: LevelDefinition = {
  id: 'level-10',
  title: 'Before the Smoke',
  teaches: 'The symptom is smoke. The cause is two flows in one doorway.',
  width: 13,
  height: 20,
  graph: {
    nodes: [SA, SB, J1, J2, J3, E1, E2, E3, E4],
    edges: [eSaJ1, eSbJ2, eJ1J3, eJ2J3, eJ3E1, eJ3E4, eJ1E2, eJ2E3],
  },
  doorCells: [at(6, 12), at(12, 13)],
  agents: [
    {id: 'leader', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 6},
    {id: 'f1', type: 'FOLLOWER', spawnNodeId: 'SA', scheduledTick: 6},
    {id: 'f2', type: 'FOLLOWER', spawnNodeId: 'SA', scheduledTick: 6},
    {id: 'f3', type: 'FOLLOWER', spawnNodeId: 'SA', scheduledTick: 6},
    {id: 'f4', type: 'FOLLOWER', spawnNodeId: 'SA', scheduledTick: 6},
    {id: 'slow', type: 'SLOW', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b1', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b2', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b3', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-j1',
      junctionId: 'J1',
      allowedEdgeIds: [eJ1J3.id, eJ1E2.id],
      anchorCell: at(2, 14),
    },
    {
      id: 'sock-j2',
      junctionId: 'J2',
      allowedEdgeIds: [eJ2J3.id, eJ2E3.id],
      anchorCell: at(10, 14),
    },
    {
      id: 'sock-j3',
      junctionId: 'J3',
      allowedEdgeIds: [eJ3E1.id, eJ3E4.id],
      anchorCell: at(7, 12),
    },
  ],
  events: [
    // The eastern route shuts before a half-speed person could finish it.
    {tick: 20, type: 'CLOSE_DOOR', cell: at(12, 13)},
    // Smoke reaches the merge while people are still queued. This is the
    // symptom the level is named for, and it is exactly three cells wide
    // because the intended solution still routes group B across it: a fourth
    // cell — the doorway at (6,12), or one more along either approach — spends
    // their last tick of EXPOSURE_LIMIT and the level stops having a solution.
    {
      tick: 18,
      type: 'ADD_SMOKE',
      cells: [at(5, 13), at(6, 13), at(7, 13)],
    },
  ],
  maxTicks: 60,
  parFinishTick: 26,
  maxWaitTicksForFlow: 20,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eJ1E2.id}],
  temptingFailures: [
    {socketId: 'sock-j3', edgeId: eJ3E4.id},
    {socketId: 'sock-j2', edgeId: eJ2E3.id},
  ],
};

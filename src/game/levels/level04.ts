/**
 * Level 4 — Safe for Now
 * Teaches: agents do not know the future; the player learns it by watching.
 *
 * Both routes are clear at the moment everyone decides. Smoke arrives off-screen
 * afterwards and fills the middle of the short corridor, ahead of whoever is
 * still in it. The late socket at J2 offers a way out that is already shutting.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const S = node('S', 'SPAWN', at(6, 18));
const J1 = node('J1', 'JUNCTION', at(6, 15));
const J2 = node('J2', 'JUNCTION', at(3, 15));
const E1 = node('E1', 'EXIT', at(2, 11));
const E2 = node('E2', 'EXIT', at(10, 10));
const E3 = node('E3', 'EXIT', at(0, 19));

const eSJ1 = edge('e_s_j1', S, J1); // [3]
const eJ1J2 = edge('e_j1_j2', J1, J2); // [3]
const eJ1E2 = edge('e_j1_e2', J1, E2, at(10, 15)); // [9]
const eJ2E1 = edge('e_j2_e1', J2, E1, at(2, 15)); // [5]
// [7] — longer than E1, so the group never takes it by default. It is only
// ever reached because the player pointed them here, and by then it is shut.
const eJ2E3 = edge('e_j2_e3', J2, E3, at(3, 19));

export const level04: LevelDefinition = {
  id: 'level-04',
  title: 'Safe for Now',
  teaches: 'Agents cannot see the hazard coming. Only the observer can.',
  width: 13,
  height: 20,
  graph: {
    nodes: [S, J1, J2, E1, E2, E3],
    edges: [eSJ1, eJ1J2, eJ1E2, eJ2E1, eJ2E3],
  },
  doorCells: [at(3, 16)],
  agents: [
    {id: 'a1', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a2', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a3', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a4', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-j1',
      junctionId: 'J1',
      allowedEdgeIds: [eJ1J2.id, eJ1E2.id],
      anchorCell: at(6, 14),
    },
    {
      id: 'sock-j2',
      junctionId: 'J2',
      allowedEdgeIds: [eJ2E1.id, eJ2E3.id],
      anchorCell: at(3, 14),
    },
  ],
  events: [
    // The escape beside the short corridor closes before the group reaches it.
    {tick: 8, type: 'CLOSE_DOOR', cell: at(3, 16)},
    // Off-screen smoke reaches the middle of the short corridor.
    {
      tick: 10,
      type: 'ADD_SMOKE',
      cells: [at(2, 15), at(2, 14), at(2, 13), at(2, 12)],
    },
  ],
  maxTicks: 45,
  parFinishTick: 18,
  maxWaitTicksForFlow: 2,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eJ1E2.id}],
  temptingFailures: [{socketId: 'sock-j2', edgeId: eJ2E3.id}],
};

/**
 * Level 3 — Too Late
 * Teaches: where you intervene matters as much as which way you point.
 *
 * There is a real escape at J2, deep in the short branch — but it shuts while
 * the group is still walking towards it. The only intervention that works is
 * the earlier one at J1, before anybody commits.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const S = node('S', 'SPAWN', at(6, 18));
const J1 = node('J1', 'JUNCTION', at(6, 16));
const J2 = node('J2', 'JUNCTION', at(6, 13));
const B1 = node('B1', 'MERGE', at(3, 13));
const E1 = node('E1', 'EXIT', at(6, 10));
const E2 = node('E2', 'EXIT', at(2, 12));

const eSJ1 = edge('e_s_j1', S, J1); // [2]
const eJ1J2 = edge('e_j1_j2', J1, J2); // [3]
const eJ1E2 = edge('e_j1_e2', J1, E2, at(2, 16)); // [8]
const eJ2E1 = edge('e_j2_e1', J2, E1); // [3]
const eJ2B1 = edge('e_j2_b1', J2, B1); // [3]  the bridge
const eB1E2 = edge('e_b1_e2', B1, E2, at(2, 13)); // [2]

export const level03: LevelDefinition = {
  id: 'level-03',
  title: 'Too Late',
  teaches: 'The intervention point matters as much as the direction.',
  width: 13,
  height: 20,
  graph: {
    nodes: [S, J1, J2, B1, E1, E2],
    // At J1 the short branch is declared first; at J2 the exit is declared
    // before the bridge. Declaration order is the fixed tie-break.
    edges: [eSJ1, eJ1J2, eJ1E2, eJ2E1, eJ2B1, eB1E2],
  },
  doorCells: [at(6, 11)],
  agents: [
    {id: 'a1', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a2', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a3', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-j1',
      junctionId: 'J1',
      allowedEdgeIds: [eJ1J2.id, eJ1E2.id],
      anchorCell: at(5, 17),
    },
    {
      id: 'sock-j2',
      junctionId: 'J2',
      allowedEdgeIds: [eJ2E1.id, eJ2B1.id],
      anchorCell: at(7, 13),
    },
  ],
  events: [
    {tick: 7, type: 'BLOCK_EDGE', edgeId: eJ2B1.id},
    {tick: 8, type: 'CLOSE_DOOR', cell: at(6, 11)},
  ],
  maxTicks: 45,
  parFinishTick: 14,
  maxWaitTicksForFlow: 2,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eJ1E2.id}],
  temptingFailures: [{socketId: 'sock-j2', edgeId: eJ2B1.id}],
};

/**
 * Level 8 — The Last Person
 * Teaches: a route is only as safe as the slowest person on it.
 *
 * A two-cell smoke zone costs a Navigator two ticks of exposure and a Slow
 * person four, because they stand on each cell twice. The same corridor is
 * survivable for four people and lethal for the fifth.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const S = node('S', 'SPAWN', at(6, 18));
const J1 = node('J1', 'JUNCTION', at(6, 16));
const J2 = node('J2', 'JUNCTION', at(3, 16));
const E1 = node('E1', 'EXIT', at(3, 13));
const E2 = node('E2', 'EXIT', at(9, 12));
const E4 = node('E4', 'EXIT', at(0, 19));

const eSJ1 = edge('e_s_j1', S, J1); // [2]
const eJ1J2 = edge('e_j1_j2', J1, J2); // [3]
const eJ1E2 = edge('e_j1_e2', J1, E2, at(9, 16)); // [7]
const eJ2E1 = edge('e_j2_e1', J2, E1); // [3]
const eJ2E4 = edge('e_j2_e4', J2, E4, at(3, 19)); // [6]

export const level08: LevelDefinition = {
  id: 'level-08',
  title: 'The Last Person',
  teaches: 'Judge the route against the slowest person, not the fastest.',
  width: 13,
  height: 20,
  graph: {
    nodes: [S, J1, J2, E1, E2, E4],
    edges: [eSJ1, eJ1J2, eJ1E2, eJ2E1, eJ2E4],
  },
  doorCells: [at(3, 17)],
  agents: [
    {id: 'a1', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a2', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a3', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'a4', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'slow', type: 'SLOW', spawnNodeId: 'S', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-j1',
      junctionId: 'J1',
      allowedEdgeIds: [eJ1J2.id, eJ1E2.id],
      anchorCell: at(6, 15),
    },
    {
      id: 'sock-j2',
      junctionId: 'J2',
      allowedEdgeIds: [eJ2E1.id, eJ2E4.id],
      anchorCell: at(2, 15),
    },
  ],
  events: [
    // The side exit at J2 shuts long before the slow person reaches it.
    {tick: 14, type: 'CLOSE_DOOR', cell: at(3, 17)},
    // Two cells of the short corridor. Survivable at full speed, not at half.
    {tick: 16, type: 'ADD_SMOKE', cells: [at(3, 15), at(3, 14)]},
  ],
  maxTicks: 50,
  parFinishTick: 26,
  maxWaitTicksForFlow: 2,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eJ1E2.id}],
  temptingFailures: [{socketId: 'sock-j2', edgeId: eJ2E4.id}],
};

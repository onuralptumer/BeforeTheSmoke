/**
 * Level 1 — Wrong Corridor
 * Teaches: placing, rotating and testing the signal.
 *
 * One person, one junction, one socket. The short branch dead-ends at a door
 * that shuts while they are already committed to the corridor, and there is no
 * junction between J1 and E1 to turn around at.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const S1 = node('S1', 'SPAWN', at(6, 17));
const J1 = node('J1', 'JUNCTION', at(6, 14));
const E1 = node('E1', 'EXIT', at(3, 12));
const E2 = node('E2', 'EXIT', at(9, 10));

const eSpawn = edge('e_s_j1', S1, J1);
const eShort = edge('e_j1_e1', J1, E1, at(3, 14)); // [5]
const eSafe = edge('e_j1_e2', J1, E2, at(9, 14)); // [7]

export const level01: LevelDefinition = {
  id: 'level-01',
  title: 'Wrong Corridor',
  teaches: 'Placing, rotating and testing the signal.',
  width: 13,
  height: 20,
  graph: {
    nodes: [S1, J1, E1, E2],
    // Declaration order at J1 is the tie-break priority: short branch first.
    edges: [eSpawn, eShort, eSafe],
  },
  doorCells: [at(3, 13)],
  agents: [
    {id: 'a1', type: 'NAVIGATOR', spawnNodeId: 'S1', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-j1',
      junctionId: 'J1',
      allowedEdgeIds: [eShort.id, eSafe.id],
      anchorCell: at(6, 13),
    },
  ],
  events: [{tick: 7, type: 'CLOSE_DOOR', cell: at(3, 13)}],
  maxTicks: 40,
  parFinishTick: 10,
  maxWaitTicksForFlow: 0,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eSafe.id}],
  temptingFailures: [],
};

/**
 * Level 5 — Turn the Leader
 * Teaches: Followers copy a visible person, so one person is worth six.
 *
 * The leader picks the short branch and six Followers copy them. Turning the
 * leader at J1 turns all seven. The late socket at J2 cannot: the spur beside
 * it has already shut by the time anyone reaches it.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const S = node('S', 'SPAWN', at(6, 18));
const J1 = node('J1', 'JUNCTION', at(6, 15));
const J2 = node('J2', 'JUNCTION', at(3, 15));
const E1 = node('E1', 'EXIT', at(2, 12));
const E2 = node('E2', 'EXIT', at(10, 11));
const E3 = node('E3', 'EXIT', at(0, 19));

const eSJ1 = edge('e_s_j1', S, J1); // [3]
const eJ1J2 = edge('e_j1_j2', J1, J2); // [3]
const eJ1E2 = edge('e_j1_e2', J1, E2, at(10, 15)); // [8]
const eJ2E1 = edge('e_j2_e1', J2, E1, at(2, 15)); // [4]
const eJ2E3 = edge('e_j2_e3', J2, E3, at(3, 19)); // [7]

export const level05: LevelDefinition = {
  id: 'level-05',
  title: 'Turn the Leader',
  teaches: 'Followers copy a visible person. Influence the right one.',
  width: 13,
  height: 20,
  graph: {
    nodes: [S, J1, J2, E1, E2, E3],
    edges: [eSJ1, eJ1J2, eJ1E2, eJ2E1, eJ2E3],
  },
  doorCells: [at(2, 13), at(3, 16)],
  agents: [
    // spawnOrder 0 leaves first and is the person everyone else watches.
    {id: 'leader', type: 'NAVIGATOR', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'f1', type: 'FOLLOWER', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'f2', type: 'FOLLOWER', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'f3', type: 'FOLLOWER', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'f4', type: 'FOLLOWER', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'f5', type: 'FOLLOWER', spawnNodeId: 'S', scheduledTick: 0},
    {id: 'f6', type: 'FOLLOWER', spawnNodeId: 'S', scheduledTick: 0},
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
    // The south-west spur, which no route in this level uses. It is the largest
    // mass in the first half of the game and it costs nothing: smoke filling a
    // part of the building the evacuation never goes near.
    {tick: 2, type: 'ADD_SMOKE', cells: [at(3, 18), at(0, 19), at(1, 19), at(2, 19), at(3, 19)]},
    {tick: 6, type: 'ADD_SMOKE', cells: [at(3, 17), at(3, 16)]},
    {tick: 6, type: 'CLOSE_DOOR', cell: at(3, 16)},
    {tick: 12, type: 'CLOSE_DOOR', cell: at(2, 13)},
  ],
  maxTicks: 45,
  parFinishTick: 23,
  maxWaitTicksForFlow: 4,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eJ1E2.id}],
  temptingFailures: [{socketId: 'sock-j2', edgeId: eJ2E3.id}],
  // The building the corridors run through. Rooms are authored to fill the
  // footprint everywhere the graph is not, so the space left between them is
  // exactly the circulation — see levels.floorplan.test.ts, which fails if a
  // room ever covers a cell somebody can walk on.
  floorPlan: {
    shell: {x: 0, y: 10, w: 12, h: 10},
    rooms: [
      {label: 'Open Plan', x: 0, y: 10, w: 10, h: 2, door: at(2, 11)},
      {label: 'Server', x: 11, y: 10, w: 1, h: 2, door: at(11, 11)},
      {label: 'Store', x: 0, y: 12, w: 2, h: 4, door: at(1, 14)},
      {label: 'Meeting', x: 3, y: 12, w: 7, h: 3, door: at(6, 14)},
      {label: 'Riser', x: 11, y: 12, w: 1, h: 4, door: at(11, 13)},
      {label: 'Archive', x: 0, y: 16, w: 3, h: 3, door: at(2, 17)},
      {label: 'WC', x: 4, y: 16, w: 2, h: 4, door: at(5, 16)},
      {label: 'Studio', x: 7, y: 16, w: 5, h: 4, door: at(7, 17)},
    ],
    props: [
      // Open plan: two banks of desks.
      {kind: 'desk', cell: at(1, 10)},
      {kind: 'desk', cell: at(3, 10)},
      {kind: 'desk', cell: at(5, 10)},
      {kind: 'desk', cell: at(7, 10)},
      {kind: 'desk', cell: at(1, 11)},
      {kind: 'desk', cell: at(3, 11)},
      {kind: 'desk', cell: at(5, 11)},
      {kind: 'plant', cell: at(8, 10)},
      // The boardroom table spans two cells.
      {kind: 'meeting', cell: at(5, 13)},
      {kind: 'chair', cell: at(4, 12)},
      {kind: 'chair', cell: at(8, 13)},
      {kind: 'plant', cell: at(9, 12)},
      {kind: 'cabinet', cell: at(3, 13)},
      // Store and archive.
      {kind: 'cabinet', cell: at(0, 12)},
      {kind: 'cabinet', cell: at(0, 13)},
      {kind: 'cabinet', cell: at(1, 12)},
      {kind: 'cabinet', cell: at(0, 16)},
      {kind: 'cabinet', cell: at(1, 16)},
      {kind: 'cabinet', cell: at(0, 17)},
      {kind: 'sofa', cell: at(1, 18)},
      // Washrooms.
      {kind: 'wc', cell: at(4, 17)},
      {kind: 'wc', cell: at(5, 17)},
      {kind: 'wc', cell: at(4, 18)},
      {kind: 'wc', cell: at(5, 18)},
      // Studio.
      {kind: 'desk', cell: at(8, 16)},
      {kind: 'desk', cell: at(10, 16)},
      {kind: 'desk', cell: at(8, 18)},
      {kind: 'desk', cell: at(10, 18)},
      {kind: 'table', cell: at(9, 17)},
      {kind: 'plant', cell: at(11, 19)},
      {kind: 'sofa', cell: at(7, 19)},
      // Risers.
      {kind: 'cabinet', cell: at(11, 10)},
      {kind: 'cabinet', cell: at(11, 14)},
    ],
  },
};

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
    // The short corridor, and the approach the group reached it by. The two
    // corridor cells are the mechanism — survivable at full speed, not at half,
    // because a Slow person stands on each of them twice. The three approach
    // cells are behind everyone by now and cost nothing; they are there so the
    // two that matter read as the near edge of something larger.
    //
    // Tick 15 is the earliest this level tolerates, established by sweeping
    // every tick against the verdict lock. Earlier and the smoke is on the
    // approach while the Slow person is still on it, which either kills them on
    // the route that is supposed to work or is perceived at J2 and reroutes
    // them; the door at tick 14 has to shut first.
    {
      tick: 15,
      type: 'ADD_SMOKE',
      cells: [at(5, 16), at(4, 16), at(3, 16), at(3, 15), at(3, 14)],
    },
  ],
  maxTicks: 50,
  parFinishTick: 26,
  maxWaitTicksForFlow: 2,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eJ1E2.id}],
  temptingFailures: [{socketId: 'sock-j2', edgeId: eJ2E4.id}],
};

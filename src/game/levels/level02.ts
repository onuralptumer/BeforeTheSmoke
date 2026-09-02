/**
 * Level 2 — One Arrow, Five People
 * Teaches: one signal moves a whole group, and a queue makes the group long.
 *
 * Two waiting areas feed one corridor. Contention at the merge strings five
 * people out over several ticks, so the group arrives at J1 as a train rather
 * than together — and the tail of that train is still in the short corridor
 * when its door shuts.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const SA = node('SA', 'SPAWN', at(4, 16));
const SB = node('SB', 'SPAWN', at(8, 16));
const M = node('M', 'MERGE', at(6, 16));
const J1 = node('J1', 'JUNCTION', at(6, 14));
const E1 = node('E1', 'EXIT', at(4, 11));
const E2 = node('E2', 'EXIT', at(10, 10));

const eSaM = edge('e_sa_m', SA, M); // [2]
const eSbM = edge('e_sb_m', SB, M); // [2]
const eMJ1 = edge('e_m_j1', M, J1); // [2]
const eShort = edge('e_j1_e1', J1, E1, at(4, 14)); // [5]
const eSafe = edge('e_j1_e2', J1, E2, at(10, 14)); // [8]

export const level02: LevelDefinition = {
  id: 'level-02',
  title: 'One Arrow, Five People',
  teaches: 'One signal moves a group; the queue behind it makes the group long.',
  width: 13,
  height: 20,
  graph: {
    nodes: [SA, SB, M, J1, E1, E2],
    edges: [eSaM, eSbM, eMJ1, eShort, eSafe],
  },
  doorCells: [at(4, 12)],
  agents: [
    {id: 'a1', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'a2', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'a3', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'b1', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b2', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-j1',
      junctionId: 'J1',
      allowedEdgeIds: [eShort.id, eSafe.id],
      anchorCell: at(6, 13),
    },
  ],
  events: [
    // Both waiting areas, filling behind the group as it strings out into the
    // corridor. Atmosphere only: every cell is behind the queue by the tick it
    // appears, and the level plays identically with it and without.
    {tick: 4, type: 'ADD_SMOKE', cells: [at(8, 16)]},
    {tick: 6, type: 'ADD_SMOKE', cells: [at(7, 16), at(5, 16), at(4, 16)]},
    {tick: 8, type: 'ADD_SMOKE', cells: [at(6, 16), at(6, 15)]},
    {tick: 11, type: 'CLOSE_DOOR', cell: at(4, 12)},
  ],
  maxTicks: 45,
  parFinishTick: 16,
  maxWaitTicksForFlow: 6,
  criticalDecision: {junctionId: 'J1'},
  intendedSolutions: [{socketId: 'sock-j1', edgeId: eSafe.id}],
  temptingFailures: [],
};

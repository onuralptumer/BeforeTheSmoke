/**
 * Level 6 — Bottleneck
 * Teaches: capacity, merge points, and more than one right answer.
 *
 * Eight people from two directions funnel into one doorway. The queue itself
 * is the hazard: smoke reaches the merge while people are still standing in
 * it. Redirecting either group works; redirecting the smaller one is faster.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const SA = node('SA', 'SPAWN', at(3, 17));
const SB = node('SB', 'SPAWN', at(9, 17));
const JA = node('JA', 'JUNCTION', at(3, 15));
const JB = node('JB', 'JUNCTION', at(9, 15));
const M1 = node('M1', 'MERGE', at(6, 13));
const E1 = node('E1', 'EXIT', at(6, 9));
const E2 = node('E2', 'EXIT', at(0, 8));
const E3 = node('E3', 'EXIT', at(12, 8));

const eSaJa = edge('e_sa_ja', SA, JA); // [2]
const eSbJb = edge('e_sb_jb', SB, JB); // [2]
const eJaM1 = edge('e_ja_m1', JA, M1, at(3, 13)); // [5]
const eJbM1 = edge('e_jb_m1', JB, M1, at(9, 13)); // [5]
const eM1E1 = edge('e_m1_e1', M1, E1); // [4] through the one-tile door
const eJaE2 = edge('e_ja_e2', JA, E2, at(0, 15)); // [10]
const eJbE3 = edge('e_jb_e3', JB, E3, at(12, 15)); // [10]

export const level06: LevelDefinition = {
  id: 'level-06',
  title: 'Bottleneck',
  teaches: 'Two flows, one doorway. Capacity is the hazard.',
  width: 13,
  height: 20,
  graph: {
    nodes: [SA, SB, JA, JB, M1, E1, E2, E3],
    edges: [eSaJa, eSbJb, eJaM1, eJbM1, eM1E1, eJaE2, eJbE3],
  },
  doorCells: [at(6, 12)],
  agents: [
    {id: 'a1', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'a2', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'a3', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'b1', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b2', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b3', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b4', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
    {id: 'b5', type: 'NAVIGATOR', spawnNodeId: 'SB', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-ja',
      junctionId: 'JA',
      allowedEdgeIds: [eJaM1.id, eJaE2.id],
      anchorCell: at(2, 14),
    },
    {
      id: 'sock-jb',
      junctionId: 'JB',
      allowedEdgeIds: [eJbM1.id, eJbE3.id],
      anchorCell: at(10, 14),
    },
  ],
  events: [
    {
      tick: 7,
      type: 'ADD_SMOKE',
      cells: [at(5, 13), at(6, 13), at(7, 13), at(6, 12)],
    },
  ],
  maxTicks: 50,
  parFinishTick: 20,
  maxWaitTicksForFlow: 10,
  criticalDecision: {junctionId: 'JA'},
  intendedSolutions: [
    {socketId: 'sock-ja', edgeId: eJaE2.id},
    {socketId: 'sock-jb', edgeId: eJbE3.id},
  ],
  temptingFailures: [],
};

/**
 * Level 7 — Opposing Flow
 * Teaches: two individually sensible decisions can lock the whole system.
 *
 * Everyone takes the near exit to the west, because for each of them
 * separately it is the shortest way out. When that exit shuts, the people who
 * have reached JX turn round and walk back into the people still coming — in a
 * corridor one tile wide, where nobody may swap. Nobody moves again.
 *
 * A note on why the level is built this way: under a nearest-exit rule two
 * groups on a symmetric map never generate head-on counterflow, because each
 * one always prefers the exit on its own side. A reverse flow after a closure
 * is what the model genuinely produces, and it teaches the same lesson.
 */

import {LevelDefinition} from '../types';
import {at, edge, node} from './builder';

const SA = node('SA', 'SPAWN', at(5, 14));
const JW = node('JW', 'JUNCTION', at(5, 11));
const JX = node('JX', 'JUNCTION', at(0, 11));
const JE = node('JE', 'MERGE', at(11, 11));
const EW = node('EW', 'EXIT', at(0, 10));
const EE = node('EE', 'EXIT', at(11, 8));

const eSaJw = edge('e_sa_jw', SA, JW); // [3]
const eJwJx = edge('e_jw_jx', JW, JX); // [5] the one-tile western stub
const eJwJe = edge('e_jw_je', JW, JE); // [6] the eastern corridor
const eJxEw = edge('e_jx_ew', JX, EW); // [1]
const eJxJw = edge('e_jx_jw', JX, JW); // [5] the same stub, walked back
const eJeEe = edge('e_je_ee', JE, EE); // [3]

export const level07: LevelDefinition = {
  id: 'level-07',
  title: 'Opposing Flow',
  teaches: 'People turning back meet people still coming. Nobody may swap.',
  width: 13,
  height: 20,
  graph: {
    nodes: [SA, JW, JX, JE, EW, EE],
    edges: [eSaJw, eJwJx, eJwJe, eJxEw, eJxJw, eJeEe],
  },
  doorCells: [at(0, 10)],
  agents: [
    {id: 'a1', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'a2', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'a3', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
    {id: 'a4', type: 'NAVIGATOR', spawnNodeId: 'SA', scheduledTick: 0},
  ],
  signalSockets: [
    {
      id: 'sock-jw',
      junctionId: 'JW',
      allowedEdgeIds: [eJwJx.id, eJwJe.id],
      anchorCell: at(5, 12),
    },
    {
      id: 'sock-jx',
      junctionId: 'JX',
      allowedEdgeIds: [eJxEw.id, eJxJw.id],
      anchorCell: at(0, 12),
    },
  ],
  // The exit tile itself is the door, so people are turned away while still
  // standing on the junction rather than stranded halfway down a corridor.
  events: [{tick: 12, type: 'CLOSE_DOOR', cell: at(0, 10)}],
  maxTicks: 50,
  parFinishTick: 18,
  maxWaitTicksForFlow: 4,
  criticalDecision: {junctionId: 'JW'},
  intendedSolutions: [{socketId: 'sock-jw', edgeId: eJwJe.id}],
  // Turning them round at JX only starts the collision sooner.
  temptingFailures: [{socketId: 'sock-jx', edgeId: eJxJw.id}],
};

/**
 * Perceived route cost (spec §5.6):
 *
 *   routeCost = remainingTravelTicks + smokeTiles * 10 + visibleQueueLength * 2
 *
 * Two clarifications the original spec left open, settled here:
 *
 * 1. Scope. The travel and smoke terms are evaluated over the *whole remaining
 *    route to an exit*, not just the next edge — otherwise an agent at a
 *    junction cannot tell a short dead-endy branch from a short good one.
 * 2. Queue. The queue term is local perception only, applied to the candidate
 *    edge alone, and counts *stalled* people on its first QUEUE_LOOKAHEAD
 *    cells — someone who was blocked last tick. A line of people walking at
 *    full speed is not congestion, and counting them made a single person
 *    ahead of you flip a route choice, which is exactly the "perfect
 *    evacuation optimiser" behaviour the spec warns against.
 *
 * Agents never see the future: smoke that has not been placed yet costs
 * nothing, which is the whole point of Level 4.
 */

import {CellKey, NavEdge} from '../types';
import {WorldMap} from '../engine/world';

export const SMOKE_COST = 10;
export const QUEUE_COST = 2;
export const QUEUE_LOOKAHEAD = 4;

export interface WorldPerception {
  isEdgeBlocked(edgeId: string): boolean;
  smokeCellCount(edgeId: string): number;
  /** Cells holding someone who was blocked on the previous tick. */
  stalledCells: Set<CellKey>;
}

/**
 * Dijkstra over the navigation graph, backwards from every exit, using
 * `length + smoke * SMOKE_COST` as the edge weight. Returns cost-to-exit per
 * node; nodes with no route are absent.
 */
export function costToExit(
  map: WorldMap,
  perception: WorldPerception,
): Map<string, number> {
  const best = new Map<string, number>();

  // Reverse adjacency: to reach `edge.to`, you may come from `edge.from`.
  const incoming = new Map<string, NavEdge[]>();
  for (const edge of map.edges.values()) {
    const list = incoming.get(edge.to);
    if (list) {
      list.push(edge);
    } else {
      incoming.set(edge.to, [edge]);
    }
  }

  const frontier: Array<{nodeId: string; cost: number}> = [];
  for (const exitId of map.exitNodeIds) {
    best.set(exitId, 0);
    frontier.push({nodeId: exitId, cost: 0});
  }

  while (frontier.length > 0) {
    // Small graphs (tens of nodes): a linear scan is cheaper than a heap and
    // keeps the ordering trivially deterministic.
    let pick = 0;
    for (let i = 1; i < frontier.length; i++) {
      const a = frontier[i];
      const b = frontier[pick];
      if (a.cost < b.cost || (a.cost === b.cost && a.nodeId < b.nodeId)) {
        pick = i;
      }
    }
    const current = frontier.splice(pick, 1)[0];
    if (current.cost > (best.get(current.nodeId) ?? Infinity)) {
      continue;
    }
    for (const edge of incoming.get(current.nodeId) ?? []) {
      if (perception.isEdgeBlocked(edge.id)) {
        continue;
      }
      const weight =
        edge.cells.length + perception.smokeCellCount(edge.id) * SMOKE_COST;
      const next = current.cost + weight;
      if (next < (best.get(edge.from) ?? Infinity)) {
        best.set(edge.from, next);
        frontier.push({nodeId: edge.from, cost: next});
      }
    }
  }

  return best;
}

export function queueLength(
  map: WorldMap,
  perception: WorldPerception,
  edgeId: string,
): number {
  const keys = map.edgeCellKeys.get(edgeId) ?? [];
  let count = 0;
  const limit = Math.min(QUEUE_LOOKAHEAD, keys.length);
  for (let i = 0; i < limit; i++) {
    if (perception.stalledCells.has(keys[i])) {
      count++;
    }
  }
  return count;
}

/**
 * Perceived cost of committing to `edge` right now. `Infinity` when the edge
 * leads nowhere an agent can still reach an exit from.
 */
export function perceivedEdgeCost(
  map: WorldMap,
  perception: WorldPerception,
  edge: NavEdge,
  costs: Map<string, number>,
): number {
  const tail = costs.get(edge.to);
  if (tail === undefined) {
    return Infinity;
  }
  return (
    tail +
    edge.cells.length +
    perception.smokeCellCount(edge.id) * SMOKE_COST +
    queueLength(map, perception, edge.id) * QUEUE_COST
  );
}

/** Can an agent standing on `cell` still reach any exit through open geometry? */
export function hasRouteToExit(
  map: WorldMap,
  perception: WorldPerception,
  fromNodeId: string,
  costs: Map<string, number>,
): boolean {
  return costs.has(fromNodeId);
}

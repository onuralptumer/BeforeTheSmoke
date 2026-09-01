/**
 * Authoring helpers. Levels are written as a graph of nodes plus orthogonal
 * corridors; the tile grid and every "[n]" travel cost are derived from the
 * geometry, so a level's documented tick counts cannot drift from its map.
 */

import {NavEdge, NavNode, NodeKind, Vec2} from '../types';

export const at = (x: number, y: number): Vec2 => ({x, y});

export const node = (id: string, kind: NodeKind, cell: Vec2): NavNode => ({
  id,
  kind,
  cell,
});

/**
 * Expands an orthogonal polyline into the cell sequence an agent occupies on
 * successive ticks. The start cell is excluded (the agent is already standing
 * on it) and every waypoint is included, so `corridor(...).length` is the
 * edge's travel cost in ticks.
 */
export function corridor(start: Vec2, ...waypoints: Vec2[]): Vec2[] {
  const cells: Vec2[] = [];
  let current = start;
  for (const waypoint of waypoints) {
    if (current.x !== waypoint.x && current.y !== waypoint.y) {
      throw new Error(
        `corridor leg from ${current.x},${current.y} to ${waypoint.x},${waypoint.y} is not orthogonal`,
      );
    }
    const dx = Math.sign(waypoint.x - current.x);
    const dy = Math.sign(waypoint.y - current.y);
    while (current.x !== waypoint.x || current.y !== waypoint.y) {
      current = {x: current.x + dx, y: current.y + dy};
      cells.push(current);
    }
  }
  return cells;
}

export function edge(
  id: string,
  from: NavNode,
  to: NavNode,
  ...waypoints: Vec2[]
): NavEdge {
  const cells = corridor(from.cell, ...waypoints, to.cell);
  return {id, from: from.id, to: to.id, cells};
}

/** Travel cost of an edge in ticks — the "[n]" in the level documents. */
export const ticks = (e: NavEdge): number => e.cells.length;

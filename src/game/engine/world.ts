/**
 * Static level geometry, derived once from a LevelDefinition.
 *
 * The tile grid is generated from the navigation graph rather than authored by
 * hand: every cell named by a node or an edge is walkable, everything else is
 * wall. This keeps one source of truth for geometry — a corridor cannot exist
 * in the grid without existing in the graph.
 */

import {
  CellKey,
  LevelDefinition,
  NavEdge,
  NavNode,
  TileType,
  Vec2,
  cellKey,
} from '../types';

export class WorldMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: TileType[][];
  readonly nodes: Map<string, NavNode>;
  readonly edges: Map<string, NavEdge>;
  readonly outgoing: Map<string, NavEdge[]>;
  readonly nodeByCell: Map<CellKey, NavNode>;
  readonly doorCells: Set<CellKey>;
  readonly exitNodeIds: string[];
  /** Cells of each edge, pre-keyed. Hot path in cost and blocking checks. */
  readonly edgeCellKeys: Map<string, CellKey[]>;
  private readonly neighbours: Map<CellKey, CellKey[]>;

  constructor(level: LevelDefinition) {
    this.width = level.width;
    this.height = level.height;
    this.nodes = new Map(level.graph.nodes.map(n => [n.id, n]));
    this.edges = new Map(level.graph.edges.map(e => [e.id, e]));
    this.doorCells = new Set(level.doorCells.map(cellKey));

    this.tiles = Array.from({length: level.height}, () =>
      Array.from({length: level.width}, () => 'WALL' as TileType),
    );

    const paint = (c: Vec2, t: TileType) => {
      if (c.y < 0 || c.y >= level.height || c.x < 0 || c.x >= level.width) {
        throw new Error(`${level.id}: cell ${cellKey(c)} is outside the map`);
      }
      // EXIT and DOOR outrank FLOOR; a cell claimed by several edges stays walkable.
      if (this.tiles[c.y][c.x] === 'WALL' || t !== 'FLOOR') {
        this.tiles[c.y][c.x] = t;
      }
    };

    for (const node of level.graph.nodes) {
      paint(node.cell, node.kind === 'EXIT' ? 'EXIT' : 'FLOOR');
    }
    for (const edge of level.graph.edges) {
      for (const c of edge.cells) {
        const node = level.graph.nodes.find(
          n => n.cell.x === c.x && n.cell.y === c.y,
        );
        paint(c, node?.kind === 'EXIT' ? 'EXIT' : 'FLOOR');
      }
    }
    for (const c of level.doorCells) {
      paint(c, 'DOOR');
    }

    this.nodeByCell = new Map(
      level.graph.nodes.map(n => [cellKey(n.cell), n] as const),
    );

    this.outgoing = new Map(level.graph.nodes.map(n => [n.id, [] as NavEdge[]]));
    for (const edge of level.graph.edges) {
      const list = this.outgoing.get(edge.from);
      if (!list) {
        throw new Error(`${level.id}: edge ${edge.id} leaves unknown node ${edge.from}`);
      }
      // Declaration order is the level-defined tie-break priority (spec §5.6):
      // never random, never sorted.
      list.push(edge);
    }

    this.exitNodeIds = level.graph.nodes
      .filter(n => n.kind === 'EXIT')
      .map(n => n.id);

    this.edgeCellKeys = new Map(
      level.graph.edges.map(e => [e.id, e.cells.map(cellKey)] as const),
    );

    this.neighbours = new Map();
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (this.tiles[y][x] === 'WALL') {
          continue;
        }
        const key = cellKey({x, y});
        const adj: CellKey[] = [];
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) {
            continue;
          }
          if (this.tiles[ny][nx] !== 'WALL') {
            adj.push(cellKey({x: nx, y: ny}));
          }
        }
        this.neighbours.set(key, adj);
      }
    }

    this.validate(level);
  }

  /**
   * Structural checks that would otherwise surface as confusing simulation
   * behaviour. Runs once per level at construction.
   */
  private validate(level: LevelDefinition) {
    for (const edge of level.graph.edges) {
      const to = this.nodes.get(edge.to);
      if (!to) {
        throw new Error(`${level.id}: edge ${edge.id} enters unknown node ${edge.to}`);
      }
      if (edge.cells.length === 0) {
        throw new Error(`${level.id}: edge ${edge.id} has no cells`);
      }
      const last = edge.cells[edge.cells.length - 1];
      if (last.x !== to.cell.x || last.y !== to.cell.y) {
        throw new Error(
          `${level.id}: edge ${edge.id} must end on node ${edge.to} (${cellKey(to.cell)}), ends at ${cellKey(last)}`,
        );
      }
      const from = this.nodes.get(edge.from)!;
      let prev = from.cell;
      for (const c of edge.cells) {
        const step = Math.abs(c.x - prev.x) + Math.abs(c.y - prev.y);
        if (step !== 1) {
          throw new Error(
            `${level.id}: edge ${edge.id} jumps from ${cellKey(prev)} to ${cellKey(c)}`,
          );
        }
        prev = c;
      }
    }
    for (const socket of level.signalSockets) {
      const junction = this.nodes.get(socket.junctionId);
      if (!junction) {
        throw new Error(`${level.id}: socket ${socket.id} names unknown junction`);
      }
      const outIds = new Set(this.outgoing.get(socket.junctionId)!.map(e => e.id));
      for (const edgeId of socket.allowedEdgeIds) {
        if (!outIds.has(edgeId)) {
          throw new Error(
            `${level.id}: socket ${socket.id} allows ${edgeId}, which does not leave ${socket.junctionId}`,
          );
        }
      }
    }
  }

  isWalkable(key: CellKey): boolean {
    return this.neighbours.has(key);
  }

  neighboursOf(key: CellKey): CellKey[] {
    return this.neighbours.get(key) ?? [];
  }

  nodeAtCell(key: CellKey): NavNode | undefined {
    return this.nodeByCell.get(key);
  }

  outgoingFrom(nodeId: string): NavEdge[] {
    return this.outgoing.get(nodeId) ?? [];
  }
}

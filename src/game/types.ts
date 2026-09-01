/**
 * Before the Smoke — core simulation types.
 *
 * Everything here is framework-independent. No React, no timers, no floats in
 * the tick path: the engine must produce bit-identical runs from identical
 * input (spec §4.2).
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type CellKey = string;

export const cellKey = (c: Vec2): CellKey => `${c.x},${c.y}`;

/**
 * Static tile classification. Smoke is deliberately NOT a tile type: it is
 * dynamic per-cell state applied by ADD_SMOKE events, and modelling it as both
 * a tile type and an event was one of the double-representation bugs in the
 * original spec. Same reasoning removed SIGN_SOCKET (sockets are their own
 * definition list) and FIRE (no level uses it).
 */
export type TileType = 'WALL' | 'FLOOR' | 'DOOR' | 'EXIT';

export type NodeKind = 'SPAWN' | 'JUNCTION' | 'MERGE' | 'EXIT';

export interface NavNode {
  id: string;
  kind: NodeKind;
  cell: Vec2;
}

/**
 * `cells` is the exact sequence an agent occupies on successive ticks after
 * leaving `from`. The last entry is always the cell of `to`, so
 * `cells.length` is the edge's travel cost in ticks — the "[n]" notation used
 * throughout the level documents.
 */
export interface NavEdge {
  id: string;
  from: string;
  to: string;
  cells: Vec2[];
}

export interface NavigationGraph {
  nodes: NavNode[];
  edges: NavEdge[];
}

export type AgentType = 'NAVIGATOR' | 'FOLLOWER' | 'SLOW';

export interface AgentSpawnDefinition {
  id: string;
  type: AgentType;
  spawnNodeId: string;
  /**
   * The tick the agent is queued to enter. If the spawn cell is occupied the
   * agent enters on the first free tick instead, preserving spawnOrder — see
   * the FIFO spawn rule. The *scheduled* tick is invariant; the resolved tick
   * is derived deterministically.
   */
  scheduledTick: number;
}

export type WorldEvent =
  | { tick: number; type: 'CLOSE_DOOR'; cell: Vec2 }
  | { tick: number; type: 'ADD_SMOKE'; cells: Vec2[] }
  | { tick: number; type: 'BLOCK_EDGE'; edgeId: string };

export interface SignalSocketDefinition {
  id: string;
  junctionId: string;
  allowedEdgeIds: string[];
  /** Grid coordinate, not a screen coordinate. Screen position is derived at layout time. */
  anchorCell: Vec2;
}

export interface SignalPlacement {
  socketId: string;
  edgeId: string;
}

export interface LevelDefinition {
  id: string;
  title: string;
  teaches: string;
  width: number;
  height: number;
  graph: NavigationGraph;
  /** Cells that are doors. All start open; CLOSE_DOOR shuts them. */
  doorCells: Vec2[];
  agents: AgentSpawnDefinition[];
  signalSockets: SignalSocketDefinition[];
  events: WorldEvent[];
  /** Hard run cap. Guarantees termination when a level deadlocks (spec §5.5, Level 7). */
  maxTicks: number;
  parFinishTick: number;
  maxWaitTicksForFlow: number;
  /** Authored, not derived: the junction whose decision the analysis view blames. */
  criticalDecision: { junctionId: string };
  /** Placements the validation harness requires to succeed. */
  intendedSolutions: SignalPlacement[];
  /** Placements the level documents describe as traps. The harness requires these to fail. */
  temptingFailures: SignalPlacement[];
}

export type AgentState = 'PENDING' | 'ACTIVE' | 'SAFE' | 'INCAPACITATED';

export type DecisionReason =
  | 'FOLLOWED_SIGNAL'
  | 'FOLLOWED_AGENT'
  | 'NEAREST_SAFE_EXIT'
  | 'REJECTED_BLOCKED_EDGE'
  | 'NO_AVAILABLE_ROUTE';

export interface DecisionLogEntry {
  tick: number;
  agentId: string;
  junctionId: string;
  chosenEdgeId?: string;
  reason: DecisionReason;
  followedAgentId?: string;
}

export interface AgentSnapshot {
  id: string;
  type: AgentType;
  state: AgentState;
  cell: Vec2 | null;
  exposure: number;
  waitTicks: number;
}

export interface FrameSnapshot {
  tick: number;
  agents: AgentSnapshot[];
  smokeCells: CellKey[];
  closedDoorCells: CellKey[];
}

export type FailureReason =
  | 'NO_AVAILABLE_ROUTE'
  | 'SMOKE_EXPOSURE'
  | 'COUNTERFLOW_DEADLOCK'
  | 'TIME_LIMIT';

export interface RunResult {
  levelId: string;
  signal: SignalPlacement | null;
  success: boolean;
  savedCount: number;
  totalCount: number;
  finishTick: number | null;
  totalWaitTicks: number;
  totalExposure: number;
  failureReason: FailureReason | null;
  failedAgentIds: string[];
  marks: { rescue: boolean; flow: boolean; swift: boolean };
}

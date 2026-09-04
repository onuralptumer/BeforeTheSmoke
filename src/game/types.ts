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
  /**
   * The tick from which the signal is lit. Defaults to 0 — set before anyone
   * moves, which is how every level has worked so far.
   *
   * A later tick is a metering decision rather than a routing one: the junction
   * behaves normally until this tick, so a group already committed to a route
   * keeps it and only the people who arrive afterwards are turned. That is what
   * lets one arrow split a crowd, which a signal lit from the start cannot do.
   */
  activateTick?: number;
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
  /**
   * How many signals the player may place. Defaults to 1.
   *
   * The budget is the level's difficulty dial: more signals means a wider
   * search space rather than a longer one, because the placements interact.
   * Two signals may never land on the same junction — two arrows on one
   * decision would have no defined winner — so the real ceiling is the number
   * of distinct junctions with sockets.
   */
  signalBudget?: number;
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
  /**
   * Other placements that legitimately win, but are not the best answer.
   *
   * `intendedSolutions` carries a stricter promise: those must also earn every
   * mark, which is what makes `parFinishTick` reachable. A level with any real
   * depth needs winning options that are *worse* than the best one — otherwise
   * Swift is handed over with the win and measures nothing — and those go here.
   * Listing them keeps the "undocumented solution" check meaningful: a winner
   * in neither list is still a level the author did not understand.
   */
  alternateSolutions?: SignalPlacement[][];
  /**
   * Room names for the drawing furniture, in tiny caps on the plan.
   *
   * Presentation only — nothing in the simulation reads these, and a level that
   * names no rooms simply has none. The label is drawn from `cell` rightwards,
   * so it needs corridor width to sit in; a one-cell-wide stair takes an
   * abbreviation, not a full name.
   */
  rooms?: Array<{label: string; cell: Vec2}>;
  /** The building this incident happens inside. Presentation only. */
  floorPlan?: FloorPlan;
}

/** A furniture item. Kinds are drawn, not simulated. */
export type PropKind =
  | 'desk'
  | 'chair'
  | 'table'
  | 'meeting'
  | 'plant'
  | 'sofa'
  | 'cabinet'
  | 'wc';

export interface OfficeRoom {
  /** Shown in tiny caps if the room is big enough to hold it. */
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Where the doorway is, as a cell on the room's own perimeter. Drawn as a gap
   * in the wall, so a room reads as enterable rather than sealed.
   */
  door?: Vec2;
}

/**
 * The drawn building, as opposed to the navigable one.
 *
 * The simulation's geometry comes from the graph and nothing here can change
 * it. What this adds is the office the corridors run through: an outer shell,
 * the rooms partitioned off it, and the furniture in them.
 *
 * The rule that keeps it honest is enforced by `levels.floorplan.test.ts`: a
 * room may never cover a walkable cell. Rooms fill the footprint everywhere the
 * graph is not, so what is left over between them *is* the circulation. That
 * way the plan can look like an office while still showing exactly where a
 * person is able to walk — which is the whole basis for the analysis phase.
 */
export interface FloorPlan {
  /** Building footprint, in cells. */
  shell: { x: number; y: number; w: number; h: number };
  rooms: OfficeRoom[];
  props: Array<{ kind: PropKind; cell: Vec2; rot?: number }>;
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
  /** Every signal that was in play. Empty for the baseline run. */
  signals: SignalPlacement[];
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

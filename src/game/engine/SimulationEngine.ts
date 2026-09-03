/**
 * The authoritative simulation.
 *
 * Mutable, framework-independent, integer-only. It imports no React and no
 * timers: the host decides when to call `step()`, so the same run is
 * reproducible in a headless test and on device (spec §5.1, §14.1).
 */

import {
  AgentSnapshot,
  AgentState,
  AgentType,
  CellKey,
  DecisionLogEntry,
  DecisionReason,
  FailureReason,
  FrameSnapshot,
  LevelDefinition,
  NavEdge,
  RunResult,
  SignalPlacement,
  Vec2,
  cellKey,
} from '../types';
import {WorldMap} from './world';
import {
  WorldPerception,
  costToExit,
  perceivedEdgeCost,
} from '../pathfinding/routing';

/**
 * Ticks on smoke before a person is incapacitated.
 *
 * The original cap of 3 made any three-cell smoke zone an instant wall, which
 * contradicted the soft `smoke * 10` route cost, and left no gap between how a
 * Navigator and a Slow person experience the same corridor. Four is the value
 * the geometry actually wants: a two-cell smoke zone costs a Navigator 2 and a
 * Slow person 4, so the same route kills only the slowest — which is Level 8's
 * entire lesson — while a four-cell zone that lands ahead of a committed agent
 * is lethal to anyone.
 */
export const EXPOSURE_LIMIT = 4;

export const SIM_TICK_MS = 250;

/** Consecutive no-movement ticks that count as a deadlock once nothing is pending. */
const DEADLOCK_TICKS = 6;

/** BFS radius, in walkable cells, within which a Follower can see a leader. */
const LEADER_VISION = 3;

interface Agent {
  id: string;
  spawnOrder: number;
  type: AgentType;
  scheduledTick: number;
  spawnNodeId: string;
  state: AgentState;
  cell: Vec2 | null;
  /** Set when standing on a node cell, null while traversing an edge. */
  atNodeId: string | null;
  edgeId: string | null;
  edgeIndex: number;
  committedNextEdgeId: string | null;
  exposure: number;
  waitTicks: number;
  moveCredit: number;
  arrivedAtCellTick: number;
  spawnedAtTick: number;
  lastLeaderId: string | null;
  /** Wanted to move on the previous tick and could not. Feeds the queue term. */
  stalled: boolean;
}

export class SimulationEngine {
  readonly level: LevelDefinition;
  readonly map: WorldMap;
  /**
   * Every signal in play. A level's `signalBudget` caps how many the player may
   * place; the engine only requires that no two land on the same junction,
   * because two arrows on one decision would have no defined winner.
   */
  readonly signals: SignalPlacement[];

  private agents: Agent[] = [];
  private smoke = new Set<CellKey>();
  private closedDoors = new Set<CellKey>();
  private blockedEdges = new Set<string>();
  private occupancy = new Map<CellKey, string>();
  private signalledEdgeByJunction = new Map<string, string>();

  tick = 0;
  finished = false;
  success = false;
  failureReason: FailureReason | null = null;
  failedAgentIds: string[] = [];
  finishTick: number | null = null;

  readonly decisionLog: DecisionLogEntry[] = [];

  constructor(
    level: LevelDefinition,
    signals: SignalPlacement[] | SignalPlacement | null = null,
  ) {
    this.level = level;
    this.map = new WorldMap(level);
    // A bare placement is still accepted; most levels only ever have one.
    this.signals = signals === null ? [] : Array.isArray(signals) ? signals : [signals];

    const budget = level.signalBudget ?? 1;
    if (this.signals.length > budget) {
      throw new Error(
        `${level.id}: ${this.signals.length} signals placed but the budget is ${budget}`,
      );
    }

    for (const signal of this.signals) {
      const socket = level.signalSockets.find(s => s.id === signal.socketId);
      if (!socket) {
        throw new Error(`${level.id}: unknown socket ${signal.socketId}`);
      }
      if (!socket.allowedEdgeIds.includes(signal.edgeId)) {
        throw new Error(
          `${level.id}: socket ${signal.socketId} cannot point along ${signal.edgeId}`,
        );
      }
      if (this.signalledEdgeByJunction.has(socket.junctionId)) {
        throw new Error(
          `${level.id}: two signals on junction ${socket.junctionId}`,
        );
      }
      this.signalledEdgeByJunction.set(socket.junctionId, signal.edgeId);
    }

    this.agents = level.agents.map((definition, index) => ({
      id: definition.id,
      spawnOrder: index,
      type: definition.type,
      scheduledTick: definition.scheduledTick,
      spawnNodeId: definition.spawnNodeId,
      state: 'PENDING' as AgentState,
      cell: null,
      atNodeId: null,
      edgeId: null,
      edgeIndex: -1,
      committedNextEdgeId: null,
      exposure: 0,
      waitTicks: 0,
      moveCredit: 0,
      arrivedAtCellTick: -1,
      spawnedAtTick: -1,
      lastLeaderId: null,
      stalled: false,
    }));

    // Tick 0 is the level's opening frame: events scheduled at t=0 have fired
    // and everyone scheduled at t=0 is standing on their spawn tile. The first
    // step() is therefore t=1, so an edge documented as [3] really does put an
    // agent on the far node at t=3.
    this.applyEvents();
    this.spawnAgents();
  }

  // ---------------------------------------------------------------- perception

  private perception(): WorldPerception {
    return {
      isEdgeBlocked: (edgeId: string) => this.isEdgeBlocked(edgeId),
      smokeCellCount: (edgeId: string) => this.smokeCellCount(edgeId),
      stalledCells: new Set(
        this.activeAgents()
          .filter(a => a.stalled)
          .map(a => cellKey(a.cell!)),
      ),
    };
  }

  private isEdgeBlocked(edgeId: string): boolean {
    if (this.blockedEdges.has(edgeId)) {
      return true;
    }
    const keys = this.map.edgeCellKeys.get(edgeId) ?? [];
    return keys.some(k => this.closedDoors.has(k));
  }

  /** Is the remainder of an edge blocked for an agent already committed to it? */
  private isEdgeBlockedAhead(edgeId: string, fromIndex: number): boolean {
    if (this.blockedEdges.has(edgeId)) {
      return true;
    }
    const keys = this.map.edgeCellKeys.get(edgeId) ?? [];
    for (let i = fromIndex + 1; i < keys.length; i++) {
      if (this.closedDoors.has(keys[i])) {
        return true;
      }
    }
    return false;
  }

  private smokeCellCount(edgeId: string): number {
    const keys = this.map.edgeCellKeys.get(edgeId) ?? [];
    let count = 0;
    for (const k of keys) {
      if (this.smoke.has(k)) {
        count++;
      }
    }
    return count;
  }

  // --------------------------------------------------------------------- tick

  step(): void {
    if (this.finished) {
      return;
    }
    this.tick += 1;

    this.applyEvents();
    this.spawnAgents();

    const eligible = this.resolveEligibility();
    this.resolveDecisions(eligible);
    this.resolveMovement(eligible);
    this.applyExposureAndExits();
    this.checkTermination();
  }

  run(): RunResult {
    while (!this.finished) {
      this.step();
    }
    return this.result();
  }

  private applyEvents(): void {
    for (const event of this.level.events) {
      if (event.tick !== this.tick) {
        continue;
      }
      switch (event.type) {
        case 'CLOSE_DOOR':
          this.closedDoors.add(cellKey(event.cell));
          break;
        case 'ADD_SMOKE':
          for (const c of event.cells) {
            this.smoke.add(cellKey(c));
          }
          break;
        case 'BLOCK_EDGE':
          this.blockedEdges.add(event.edgeId);
          break;
      }
    }
  }

  /**
   * FIFO spawn. Agents are released in spawnOrder from each spawn node; one
   * whose cell is occupied enters on the first free tick instead. Scheduled
   * ticks are invariant, resolved ticks are derived — so a level can schedule
   * several people at once without violating cell capacity.
   */
  private spawnAgents(): void {
    const byNode = new Map<string, Agent[]>();
    for (const agent of this.agents) {
      if (agent.state !== 'PENDING' || agent.scheduledTick > this.tick) {
        continue;
      }
      const list = byNode.get(agent.spawnNodeId);
      if (list) {
        list.push(agent);
      } else {
        byNode.set(agent.spawnNodeId, [agent]);
      }
    }

    for (const [nodeId, queued] of [...byNode.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : 1,
    )) {
      queued.sort((a, b) => a.spawnOrder - b.spawnOrder);
      const node = this.map.nodes.get(nodeId)!;
      const key = cellKey(node.cell);
      if (this.occupancy.has(key)) {
        continue;
      }
      const agent = queued[0];
      agent.state = 'ACTIVE';
      agent.cell = node.cell;
      agent.atNodeId = nodeId;
      agent.arrivedAtCellTick = this.tick;
      agent.spawnedAtTick = this.tick;
      this.occupancy.set(key, agent.id);
    }
  }

  /**
   * Movement credit. A Slow person banks one credit per tick and spends two to
   * move — integer arithmetic, so replays stay bit-identical.
   */
  private resolveEligibility(): Agent[] {
    const eligible: Agent[] = [];
    for (const agent of this.activeAgents()) {
      // Someone who has just stepped into the level stands on their spawn tile
      // for this tick, exactly as the people placed there at t=0 do.
      if (agent.spawnedAtTick === this.tick) {
        continue;
      }
      if (agent.type === 'SLOW') {
        agent.moveCredit = Math.min(agent.moveCredit + 1, 2);
        if (agent.moveCredit < 2) {
          continue;
        }
      }
      eligible.push(agent);
    }
    return eligible;
  }

  /**
   * Route decisions, in ascending spawnOrder. The order is fixed so that a
   * Follower can only copy a decision committed earlier this tick or before —
   * without it, leader-copying depends on iteration order and the determinism
   * guarantee is false.
   */
  private resolveDecisions(eligible: Agent[]): void {
    const perception = this.perception();
    const costs = costToExit(this.map, perception);

    for (const agent of eligible) {
      if (agent.atNodeId === null) {
        continue;
      }
      const node = this.map.nodes.get(agent.atNodeId)!;
      if (node.kind === 'EXIT') {
        continue;
      }

      const outgoing = this.map.outgoingFrom(node.id);
      const safeEdges = outgoing.filter(e => !this.isEdgeBlocked(e.id));

      if (safeEdges.length === 0) {
        agent.committedNextEdgeId = null;
        if (node.kind === 'JUNCTION') {
          this.log(agent, node.id, undefined, 'NO_AVAILABLE_ROUTE');
        }
        continue;
      }

      const decision = this.chooseEdge(agent, node.id, safeEdges, perception, costs);
      agent.committedNextEdgeId = decision.edge.id;
      if (decision.leaderId) {
        agent.lastLeaderId = decision.leaderId;
      }
      if (node.kind === 'JUNCTION') {
        this.log(agent, node.id, decision.edge.id, decision.reason, decision.leaderId);
      }
    }
  }

  private chooseEdge(
    agent: Agent,
    junctionId: string,
    safeEdges: NavEdge[],
    perception: WorldPerception,
    costs: Map<string, number>,
  ): {edge: NavEdge; reason: DecisionReason; leaderId?: string} {
    if (agent.type === 'FOLLOWER') {
      const leader = this.findEligibleLeader(agent, junctionId);
      if (leader) {
        const copied = this.matchingEdge(safeEdges, leader);
        if (copied) {
          return {edge: copied, reason: 'FOLLOWED_AGENT', leaderId: leader.id};
        }
      }
    }

    const signalledEdgeId = this.signalledEdgeByJunction.get(junctionId);
    if (signalledEdgeId !== undefined) {
      const signalled = safeEdges.find(e => e.id === signalledEdgeId);
      if (signalled) {
        return {edge: signalled, reason: 'FOLLOWED_SIGNAL'};
      }
    }

    let best = safeEdges[0];
    let bestCost = perceivedEdgeCost(this.map, perception, best, costs);
    for (let i = 1; i < safeEdges.length; i++) {
      const cost = perceivedEdgeCost(this.map, perception, safeEdges[i], costs);
      // Strict `<` keeps declaration order as the level-defined tie-break.
      if (cost < bestCost) {
        best = safeEdges[i];
        bestCost = cost;
      }
    }
    return {edge: best, reason: 'NEAREST_SAFE_EXIT'};
  }

  /**
   * People copy a *direction*, not an edge id. A Follower standing at its own
   * junction will take whichever of its own corridors heads where the visible
   * leader is heading — which is why a leader who never passes this junction
   * can still turn the group, and why one converted Follower then converts the
   * next one behind it.
   */
  private matchingEdge(safeEdges: NavEdge[], leader: Agent): NavEdge | undefined {
    const exact = safeEdges.find(e => e.id === leader.committedNextEdgeId);
    if (exact) {
      return exact;
    }
    const leaderEdge = this.map.edges.get(leader.committedNextEdgeId!)!;
    return safeEdges.find(e => e.to === leaderEdge.to);
  }

  /**
   * Leader priority (spec §6.2): the agent this Follower already copied, then
   * the nearest Navigator, then the nearest other agent, then lower spawnOrder.
   * A leader is only eligible if the Follower has a corridor of its own that
   * heads the same way — which is what lets a leader who passed by several
   * ticks ago still pull the group behind them (Level 9).
   */
  private findEligibleLeader(agent: Agent, junctionId: string): Agent | null {
    const outgoing = this.map.outgoingFrom(junctionId);
    const distances = this.visibleDistances(agent);

    const candidates = this.activeAgents().filter(
      other =>
        other.id !== agent.id &&
        other.committedNextEdgeId !== null &&
        this.matchingEdge(outgoing, other) !== undefined &&
        distances.has(cellKey(other.cell!)),
    );
    if (candidates.length === 0) {
      return null;
    }

    const distanceOf = (a: Agent) => distances.get(cellKey(a.cell!))!;

    const remembered = candidates.find(c => c.id === agent.lastLeaderId);
    if (remembered) {
      return remembered;
    }

    const rank = (a: Agent) => (a.type === 'NAVIGATOR' ? 0 : 1);
    return candidates.sort((a, b) => {
      if (rank(a) !== rank(b)) {
        return rank(a) - rank(b);
      }
      if (distanceOf(a) !== distanceOf(b)) {
        return distanceOf(a) - distanceOf(b);
      }
      return a.spawnOrder - b.spawnOrder;
    })[0];
  }

  /** BFS over walkable cells — walls occlude, so distance is not Euclidean. */
  private visibleDistances(agent: Agent): Map<CellKey, number> {
    const start = cellKey(agent.cell!);
    const seen = new Map<CellKey, number>([[start, 0]]);
    let frontier = [start];
    for (let depth = 1; depth <= LEADER_VISION; depth++) {
      const next: CellKey[] = [];
      for (const key of frontier) {
        for (const neighbour of this.map.neighboursOf(key)) {
          if (seen.has(neighbour) || this.closedDoors.has(neighbour)) {
            continue;
          }
          seen.set(neighbour, depth);
          next.push(neighbour);
        }
      }
      frontier = next;
    }
    return seen;
  }

  /**
   * Simultaneous commit. An agent may enter a cell that is being vacated this
   * tick, so grants are resolved to a fixpoint. Two agents facing each other
   * can never both be granted — each waits on the other — which produces the
   * head-on deadlock of Level 7 without any special case.
   */
  private resolveMovement(eligible: Agent[]): void {
    const movers: Array<{agent: Agent; target: CellKey; targetCell: Vec2}> = [];

    for (const agent of eligible) {
      const target = this.nextCellFor(agent);
      if (target) {
        movers.push({agent, target: cellKey(target), targetCell: target});
      } else {
        // Nowhere to go at all — a shut door ahead, or no route out of the
        // node. Still a stall, and still accumulates waiting time.
        agent.waitTicks += 1;
        agent.stalled = true;
      }
    }

    movers.sort((a, b) => this.comparePriority(a.agent, b.agent));

    const granted = new Set<string>();
    const claimed = new Set<CellKey>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const move of movers) {
        if (granted.has(move.agent.id) || claimed.has(move.target)) {
          continue;
        }
        const occupant = this.occupancy.get(move.target);
        if (occupant === undefined || granted.has(occupant)) {
          granted.add(move.agent.id);
          claimed.add(move.target);
          changed = true;
        }
      }
    }

    for (const move of movers) {
      if (!granted.has(move.agent.id)) {
        move.agent.waitTicks += 1;
        move.agent.stalled = true;
        continue;
      }
      move.agent.stalled = false;
      this.commitMove(move.agent, move.targetCell);
    }
  }

  private nextCellFor(agent: Agent): Vec2 | null {
    if (agent.atNodeId !== null) {
      if (!agent.committedNextEdgeId) {
        return null;
      }
      const edge = this.map.edges.get(agent.committedNextEdgeId)!;
      return edge.cells[0];
    }
    if (agent.edgeId === null) {
      return null;
    }
    const edge = this.map.edges.get(agent.edgeId)!;
    const next = edge.cells[agent.edgeIndex + 1];
    if (!next) {
      return null;
    }
    if (this.closedDoors.has(cellKey(next))) {
      return null;
    }
    return next;
  }

  private commitMove(agent: Agent, target: Vec2): void {
    const from = cellKey(agent.cell!);
    const to = cellKey(target);
    this.occupancy.delete(from);
    this.occupancy.set(to, agent.id);
    agent.cell = target;
    agent.arrivedAtCellTick = this.tick;
    if (agent.type === 'SLOW') {
      agent.moveCredit = 0;
    }

    if (agent.atNodeId !== null) {
      agent.edgeId = agent.committedNextEdgeId;
      agent.edgeIndex = 0;
      agent.atNodeId = null;
    } else {
      agent.edgeIndex += 1;
    }

    const edge = this.map.edges.get(agent.edgeId!)!;
    if (agent.edgeIndex === edge.cells.length - 1) {
      agent.atNodeId = edge.to;
      // committedNextEdgeId is deliberately left in place: it is what a
      // Follower reads when deciding whether to copy this person.
    }
  }

  private comparePriority(a: Agent, b: Agent): number {
    if (a.waitTicks !== b.waitTicks) {
      return b.waitTicks - a.waitTicks;
    }
    if (a.arrivedAtCellTick !== b.arrivedAtCellTick) {
      return a.arrivedAtCellTick - b.arrivedAtCellTick;
    }
    return a.spawnOrder - b.spawnOrder;
  }

  private applyExposureAndExits(): void {
    for (const agent of this.activeAgents()) {
      const key = cellKey(agent.cell!);
      if (this.smoke.has(key)) {
        agent.exposure += 1;
        if (agent.exposure >= EXPOSURE_LIMIT) {
          agent.state = 'INCAPACITATED';
          continue;
        }
      }
      const node = this.map.nodeAtCell(key);
      if (node?.kind === 'EXIT') {
        agent.state = 'SAFE';
        this.occupancy.delete(key);
      }
    }
  }

  private checkTermination(): void {
    const incapacitated = this.agents.filter(a => a.state === 'INCAPACITATED');
    if (incapacitated.length > 0) {
      return this.finish(false, 'SMOKE_EXPOSURE', incapacitated.map(a => a.id));
    }

    if (this.agents.every(a => a.state === 'SAFE')) {
      this.finishTick = this.tick;
      return this.finish(true, null, []);
    }

    // Someone still walking who can no longer reach any exit: the incident is
    // already decided, so freeze here rather than watching them stand at a
    // closed door until the time limit.
    const perception = this.perception();
    const costs = costToExit(this.map, perception);
    const stranded = this.activeAgents().filter(a => this.isStranded(a, costs));
    if (stranded.length > 0) {
      return this.finish(false, 'NO_AVAILABLE_ROUTE', stranded.map(a => a.id));
    }

    if (this.tick >= this.level.maxTicks) {
      return this.finish(
        false,
        'TIME_LIMIT',
        this.agents.filter(a => a.state !== 'SAFE').map(a => a.id),
      );
    }

    if (this.isDeadlocked()) {
      return this.finish(
        false,
        'COUNTERFLOW_DEADLOCK',
        this.activeAgents().map(a => a.id),
      );
    }
  }

  private isStranded(agent: Agent, costs: Map<string, number>): boolean {
    if (agent.atNodeId !== null) {
      return !costs.has(agent.atNodeId);
    }
    if (agent.edgeId === null) {
      return false;
    }
    if (this.isEdgeBlockedAhead(agent.edgeId, agent.edgeIndex)) {
      return true;
    }
    const edge = this.map.edges.get(agent.edgeId)!;
    return !costs.has(edge.to);
  }

  /**
   * Nobody left to arrive and nobody has moved for several ticks. Doors only
   * ever close and smoke only ever spreads, so no pending event can free a
   * standstill — waiting for one would just report the eventual smoke instead
   * of the counterflow that actually caused it.
   */
  private isDeadlocked(): boolean {
    if (this.agents.some(a => a.state === 'PENDING')) {
      return false;
    }
    const active = this.activeAgents();
    if (active.length === 0) {
      return false;
    }
    return active.every(a => this.tick - a.arrivedAtCellTick >= DEADLOCK_TICKS);
  }

  private finish(
    success: boolean,
    reason: FailureReason | null,
    failedAgentIds: string[],
  ): void {
    this.finished = true;
    this.success = success;
    this.failureReason = reason;
    this.failedAgentIds = failedAgentIds;
  }

  private activeAgents(): Agent[] {
    return this.agents.filter(a => a.state === 'ACTIVE');
  }

  private log(
    agent: Agent,
    junctionId: string,
    chosenEdgeId: string | undefined,
    reason: DecisionReason,
    followedAgentId?: string,
  ): void {
    this.decisionLog.push({
      tick: this.tick,
      agentId: agent.id,
      junctionId,
      chosenEdgeId,
      reason,
      followedAgentId,
    });
  }

  // ------------------------------------------------------------------ readout

  snapshot(): FrameSnapshot {
    const agents: AgentSnapshot[] = this.agents.map(a => ({
      id: a.id,
      type: a.type,
      state: a.state,
      cell: a.cell,
      exposure: a.exposure,
      waitTicks: a.waitTicks,
    }));
    return {
      tick: this.tick,
      agents,
      smokeCells: [...this.smoke].sort(),
      closedDoorCells: [...this.closedDoors].sort(),
    };
  }

  result(): RunResult {
    const saved = this.agents.filter(a => a.state === 'SAFE').length;
    const totalWaitTicks = this.agents.reduce((sum, a) => sum + a.waitTicks, 0);
    const totalExposure = this.agents.reduce((sum, a) => sum + a.exposure, 0);
    const rescue = this.success;
    return {
      levelId: this.level.id,
      signals: this.signals,
      success: this.success,
      savedCount: saved,
      totalCount: this.agents.length,
      finishTick: this.finishTick,
      totalWaitTicks,
      totalExposure,
      failureReason: this.failureReason,
      failedAgentIds: this.failedAgentIds,
      marks: {
        rescue,
        flow: rescue && totalWaitTicks <= this.level.maxWaitTicksForFlow,
        swift:
          rescue &&
          this.finishTick !== null &&
          this.finishTick <= this.level.parFinishTick,
      },
    };
  }
}

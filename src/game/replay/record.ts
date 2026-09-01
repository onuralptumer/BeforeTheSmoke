/**
 * A run is recorded in full before anything is drawn.
 *
 * The engine is deterministic and a level is at most sixty ticks with nine
 * people, so simulating the whole incident up front costs under a millisecond
 * and buys three things: playback becomes an array index rather than a live
 * clock, scrubbing back is free, and BEFORE/AFTER comparison is just keeping
 * two recordings. It also keeps the simulation off the animation path
 * entirely — the authoritative state is finished before the first frame draws.
 */

import {SimulationEngine} from '../engine/SimulationEngine';
import {
  DecisionLogEntry,
  FrameSnapshot,
  LevelDefinition,
  RunResult,
  SignalPlacement,
  Vec2,
} from '../types';

export interface RecordedRun {
  levelId: string;
  signal: SignalPlacement | null;
  frames: FrameSnapshot[];
  decisions: DecisionLogEntry[];
  result: RunResult;
  /** Per person, the cells they stood on in order. Drives the route trails. */
  trails: Map<string, Vec2[]>;
  /** Where people failed without moving. See `stalledFailures`. */
  stalls: Vec2[];
  lastTick: number;
}

export function recordRun(
  level: LevelDefinition,
  signal: SignalPlacement | null,
): RecordedRun {
  const engine = new SimulationEngine(level, signal);
  const frames: FrameSnapshot[] = [engine.snapshot()];
  while (!engine.finished) {
    engine.step();
    frames.push(engine.snapshot());
  }

  const trails = new Map<string, Vec2[]>();
  for (const frame of frames) {
    for (const agent of frame.agents) {
      if (!agent.cell) {
        continue;
      }
      const trail = trails.get(agent.id) ?? [];
      const last = trail[trail.length - 1];
      if (!last || last.x !== agent.cell.x || last.y !== agent.cell.y) {
        trail.push(agent.cell);
      }
      trails.set(agent.id, trail);
    }
  }

  const result = engine.result();
  const run: RecordedRun = {
    levelId: level.id,
    signal,
    frames,
    decisions: engine.decisionLog,
    result,
    trails,
    stalls: [],
    lastTick: frames[frames.length - 1].tick,
  };
  run.stalls = stalledFailures(run);
  return run;
}

export interface TimelineEvent {
  tick: number;
  kind: 'DOOR' | 'SMOKE' | 'BLOCK' | 'FAILURE';
  label: string;
}

/** The read-only event strip shown during analysis. Not a scrubber. */
export function timelineFor(
  level: LevelDefinition,
  run: RecordedRun,
): TimelineEvent[] {
  const events: TimelineEvent[] = level.events.map(event => {
    switch (event.type) {
      case 'CLOSE_DOOR':
        return {tick: event.tick, kind: 'DOOR' as const, label: 'Door closes'};
      case 'ADD_SMOKE':
        return {tick: event.tick, kind: 'SMOKE' as const, label: 'Smoke spreads'};
      case 'BLOCK_EDGE':
        return {tick: event.tick, kind: 'BLOCK' as const, label: 'Route blocked'};
    }
  });

  if (!run.result.success) {
    events.push({
      tick: run.lastTick,
      kind: 'FAILURE',
      label: 'Someone is lost',
    });
  }

  return events.sort((a, b) => a.tick - b.tick);
}

/**
 * The one line the player reads. Each maps to exactly one engine end
 * condition, so there is never a failure the interface cannot explain.
 */
export function failureLine(run: RecordedRun): string | null {
  switch (run.result.failureReason) {
    case 'NO_AVAILABLE_ROUTE':
      return 'The way out closed while they were still in the corridor.';
    case 'SMOKE_EXPOSURE':
      return 'Smoke exposure reached the limit.';
    case 'COUNTERFLOW_DEADLOCK':
      return 'Could not move against the opposing flow.';
    case 'TIME_LIMIT':
      return 'The building did not clear in time.';
    default:
      return null;
  }
}

/** Ticks of stillness that make a failure a stall rather than a journey. */
const STALL_WINDOW = 3;

/**
 * Where people failed without moving — jammed against a shut door, or locked
 * against someone coming the other way. A movement trail cannot show this: it
 * would be one cell drawn over itself, which reads as nothing.
 */
export function stalledFailures(run: RecordedRun): Vec2[] {
  const lost = new Set(run.result.failedAgentIds);
  if (lost.size === 0) {
    return [];
  }

  const window = run.frames.slice(-(STALL_WINDOW + 1));
  if (window.length <= STALL_WINDOW) {
    return [];
  }

  const cells: Vec2[] = [];
  for (const id of lost) {
    const positions = window
      .map(f => f.agents.find(a => a.id === id)?.cell ?? null)
      .filter((c): c is Vec2 => c !== null);
    if (positions.length <= STALL_WINDOW) {
      continue;
    }
    const first = positions[0];
    const still = positions.every(c => c.x === first.x && c.y === first.y);
    if (still) {
      cells.push(first);
    }
  }
  return cells;
}

/** The cell of the junction this level blames for the failure. */
export function criticalCell(level: LevelDefinition): Vec2 | null {
  const node = level.graph.nodes.find(
    n => n.id === level.criticalDecision.junctionId,
  );
  return node?.cell ?? null;
}

/** Why the person the analysis blames chose what they chose. */
export function criticalDecision(
  level: LevelDefinition,
  run: RecordedRun,
): DecisionLogEntry | null {
  const junctionId = level.criticalDecision.junctionId;
  const lost = new Set(run.result.failedAgentIds);
  return (
    run.decisions.find(d => d.junctionId === junctionId && lost.has(d.agentId)) ??
    run.decisions.find(d => d.junctionId === junctionId) ??
    null
  );
}

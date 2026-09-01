/**
 * Level validation harness.
 *
 * The configuration space of a level is tiny — every socket crossed with every
 * allowed direction, plus the empty placement — so solvability is settled by
 * exhaustive search rather than by hand arithmetic. This is what makes the
 * acceptance criterion "every level is solvable with one signal" a fact rather
 * than an intention.
 */

import {LevelDefinition, RunResult, SignalPlacement} from '../types';
import {SimulationEngine} from '../engine/SimulationEngine';

export function enumeratePlacements(level: LevelDefinition): SignalPlacement[] {
  const placements: SignalPlacement[] = [];
  for (const socket of level.signalSockets) {
    for (const edgeId of socket.allowedEdgeIds) {
      placements.push({socketId: socket.id, edgeId});
    }
  }
  return placements;
}

export function runLevel(
  level: LevelDefinition,
  signal: SignalPlacement | null,
): RunResult {
  return new SimulationEngine(level, signal).run();
}

export interface LevelReport {
  levelId: string;
  baseline: RunResult;
  placements: Array<{placement: SignalPlacement; result: RunResult}>;
  solutions: SignalPlacement[];
  problems: string[];
}

const label = (p: SignalPlacement) => `${p.socketId}->${p.edgeId}`;

export function validateLevel(level: LevelDefinition): LevelReport {
  const baseline = runLevel(level, null);
  const placements = enumeratePlacements(level).map(placement => ({
    placement,
    result: runLevel(level, placement),
  }));
  const solutions = placements
    .filter(p => p.result.success)
    .map(p => p.placement);
  const problems: string[] = [];

  if (baseline.success) {
    problems.push(
      'baseline run succeeds — there is no incident for the player to diagnose',
    );
  }
  if (solutions.length === 0) {
    problems.push('no single signal placement solves the level');
  }

  const solved = new Set(solutions.map(label));
  for (const intended of level.intendedSolutions) {
    if (!solved.has(label(intended))) {
      const found = placements.find(p => label(p.placement) === label(intended));
      problems.push(
        `intended solution ${label(intended)} fails (${found?.result.failureReason ?? 'unknown'})`,
      );
    }
  }
  for (const trap of level.temptingFailures) {
    if (solved.has(label(trap))) {
      problems.push(`tempting failure ${label(trap)} unexpectedly succeeds`);
    }
  }
  // Flow and Swift must be reachable. A par tick the best solution cannot hit
  // turns an optional mark into a permanently greyed-out one.
  for (const intended of level.intendedSolutions) {
    const found = placements.find(p => label(p.placement) === label(intended));
    if (found?.result.success && !found.result.marks.swift) {
      problems.push(
        `parFinishTick ${level.parFinishTick} is unreachable: ${label(intended)} finishes at ${found.result.finishTick}`,
      );
    }
    if (found?.result.success && !found.result.marks.flow) {
      problems.push(
        `maxWaitTicksForFlow ${level.maxWaitTicksForFlow} is unreachable: ${label(intended)} waits ${found.result.totalWaitTicks}`,
      );
    }
  }

  for (const placement of solutions) {
    if (!level.intendedSolutions.some(i => label(i) === label(placement))) {
      problems.push(
        `${label(placement)} solves the level but is not documented as a solution`,
      );
    }
  }

  return {levelId: level.id, baseline, placements, solutions, problems};
}

/** Human-readable dump, used by the levels test and the dev CLI. */
export function describeReport(report: LevelReport): string {
  const lines = [`${report.levelId}`];
  const b = report.baseline;
  lines.push(
    `  ${'baseline'.padEnd(18)} ${b.success ? 'SAFE' : 'FAILS'} ${b.savedCount}/${b.totalCount}` +
      ` reason=${b.failureReason ?? '-'} finish=${b.finishTick ?? '-'}` +
      ` wait=${b.totalWaitTicks} exposure=${b.totalExposure}` +
      (b.failedAgentIds.length > 0 ? ` lost=[${b.failedAgentIds.join(',')}]` : ''),
  );
  for (const {placement, result} of report.placements) {
    lines.push(
      `  ${label(placement).padEnd(18)} ${result.success ? 'SAFE' : 'FAILS'} ` +
        `${result.savedCount}/${result.totalCount} reason=${result.failureReason ?? '-'} ` +
        `finish=${result.finishTick ?? '-'} wait=${result.totalWaitTicks}` +
        (result.failedAgentIds.length > 0
          ? ` lost=[${result.failedAgentIds.join(',')}]`
          : ''),
    );
  }
  for (const problem of report.problems) {
    lines.push(`  !! ${problem}`);
  }
  return lines.join('\n');
}

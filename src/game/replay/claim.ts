/**
 * Claiming a score, and checking one.
 *
 * A run is completely described by which level it was and where the signals
 * went. Everything else — who got out, how long it took, who was lost — is
 * derived, because the simulation is deterministic. So a claimed result never
 * has to be trusted: re-run the inputs and see.
 *
 * That is what makes a leaderboard cheap here. The client sends about thirty
 * bytes, the server runs the same engine over them, and the score it computes
 * is the score. A forged total is not rejected by a heuristic; it simply is not
 * what the engine produces. There is nothing to trust and therefore nothing to
 * secure.
 *
 * Placements are encoded as indices into the level's own socket list rather
 * than as ids, which keeps a claim short and means a renamed socket breaks
 * verification loudly instead of silently scoring the wrong thing.
 */

import {LevelDefinition, RunResult, SignalPlacement} from '../types';
import {SimulationEngine} from '../engine/SimulationEngine';
import {RecordedRun, recordRun} from './record';

export const CLAIM_VERSION = 1;

export interface RunClaim {
  /** Identifies the level: a shipped id, a generated seed, or a daily day. */
  levelKey: string;
  placements: SignalPlacement[];
  /** What the player says happened. Never believed. */
  claimed: {savedCount: number; finishTick: number | null};
}

/** `1|<levelKey>|<socket>.<edge>.<tick>,...|<saved>|<finish>` */
export function encodeClaim(claim: RunClaim, level: LevelDefinition): string {
  const parts = claim.placements.map(p => {
    const socketIndex = level.signalSockets.findIndex(s => s.id === p.socketId);
    if (socketIndex < 0) {
      throw new Error(`unknown socket ${p.socketId} for ${level.id}`);
    }
    const edgeIndex = level.signalSockets[socketIndex].allowedEdgeIds.indexOf(
      p.edgeId,
    );
    if (edgeIndex < 0) {
      throw new Error(`socket ${p.socketId} cannot point along ${p.edgeId}`);
    }
    return `${socketIndex}.${edgeIndex}.${p.activateTick ?? 0}`;
  });

  return [
    CLAIM_VERSION,
    claim.levelKey,
    parts.join(','),
    claim.claimed.savedCount,
    claim.claimed.finishTick ?? '-',
  ].join('|');
}

export function decodeClaim(text: string, level: LevelDefinition): RunClaim {
  const [version, levelKey, placementPart, saved, finish] = text.split('|');
  if (Number(version) !== CLAIM_VERSION) {
    throw new Error(`unsupported claim version ${version}`);
  }

  const placements: SignalPlacement[] = placementPart
    ? placementPart.split(',').map(chunk => {
        const [si, ei, tick] = chunk.split('.').map(Number);
        const socket = level.signalSockets[si];
        if (!socket) {
          throw new Error(`claim names socket ${si}, which ${level.id} lacks`);
        }
        const edgeId = socket.allowedEdgeIds[ei];
        if (!edgeId) {
          throw new Error(`claim names edge ${ei} on socket ${socket.id}`);
        }
        return {socketId: socket.id, edgeId, activateTick: tick || 0};
      })
    : [];

  return {
    levelKey,
    placements,
    claimed: {
      savedCount: Number(saved),
      finishTick: finish === '-' ? null : Number(finish),
    },
  };
}

export interface Verdict {
  /** Whether the claimed figures are the ones the engine actually produces. */
  honest: boolean;
  /** The authoritative result. This is the score, whatever was claimed. */
  actual: RunResult;
  mismatches: string[];
}

/**
 * Re-run the claim's inputs and compare. The returned `actual` is what should
 * be recorded — a dishonest claim is not an error to handle, just a number that
 * does not match, and the real one is right there.
 */
export function verifyClaim(
  claim: RunClaim,
  level: LevelDefinition,
): Verdict {
  const actual = new SimulationEngine(level, claim.placements).run();
  const mismatches: string[] = [];

  if (actual.savedCount !== claim.claimed.savedCount) {
    mismatches.push(
      `claimed ${claim.claimed.savedCount} saved, engine says ${actual.savedCount}`,
    );
  }
  if (actual.finishTick !== claim.claimed.finishTick) {
    mismatches.push(
      `claimed finish ${claim.claimed.finishTick}, engine says ${actual.finishTick}`,
    );
  }

  return {honest: mismatches.length === 0, actual, mismatches};
}

/**
 * Replay somebody else's claim as a ghost.
 *
 * `RecordedRun` is what the canvas already draws, and `GameCanvas` already
 * accepts a `ghostRun` to draw underneath the live one. Because the engine is
 * deterministic, rebuilding a rival's run from thirty bytes produces frames
 * identical to the ones they saw — so a ghost needs no recording, no upload and
 * no storage. The claim *is* the replay.
 */
export function ghostFromClaim(
  claim: RunClaim,
  level: LevelDefinition,
): RecordedRun {
  return recordRun(level, claim.placements);
}

/** The claim a finished run would submit. */
export const claimFor = (
  levelKey: string,
  result: RunResult,
): RunClaim => ({
  levelKey,
  placements: result.signals,
  claimed: {savedCount: result.savedCount, finishTick: result.finishTick},
});

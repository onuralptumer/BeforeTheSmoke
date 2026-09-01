/**
 * Progress and run history.
 *
 * Deliberately boring. The persisted data is ten progress rows and a capped
 * run log, written after a run and never inside the loop, so AsyncStorage is
 * the right size of tool. MMKV v3 would pull in react-native-nitro-modules,
 * which is the native-version coupling this project set out to avoid.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {FailureReason, RunResult, SignalPlacement} from '../game/types';
import {LEVELS} from '../game/levels';

const PROGRESS_KEY = 'bts:progress:v1';
const RUNS_KEY = 'bts:runs:v1';
const RUN_LOG_LIMIT = 200;

export interface LevelProgress {
  levelId: string;
  unlocked: boolean;
  completed: boolean;
  bestFinishTick: number | null;
  bestWaitTicks: number | null;
  attemptCount: number;
  marks: {rescue: boolean; flow: boolean; swift: boolean};
  completedAt: string | null;
}

export interface RunRecord {
  levelId: string;
  attemptNo: number;
  signalSocketId: string | null;
  signalEdgeId: string | null;
  savedCount: number;
  totalCount: number;
  finishTick: number | null;
  totalWaitTicks: number;
  totalExposure: number;
  failureReason: FailureReason | null;
  createdAt: string;
}

export type ProgressMap = Record<string, LevelProgress>;

function blank(levelId: string, unlocked: boolean): LevelProgress {
  return {
    levelId,
    unlocked,
    completed: false,
    bestFinishTick: null,
    bestWaitTicks: null,
    attemptCount: 0,
    marks: {rescue: false, flow: false, swift: false},
    completedAt: null,
  };
}

export function initialProgress(): ProgressMap {
  const map: ProgressMap = {};
  LEVELS.forEach((level, index) => {
    map[level.id] = blank(level.id, index === 0);
  });
  return map;
}

export async function loadProgress(): Promise<ProgressMap> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return initialProgress();
    }
    const stored = JSON.parse(raw) as ProgressMap;
    // Merge over a fresh map so a level added later is never missing a row.
    const map = initialProgress();
    for (const level of LEVELS) {
      if (stored[level.id]) {
        map[level.id] = {...map[level.id], ...stored[level.id]};
      }
    }
    return map;
  } catch {
    return initialProgress();
  }
}

async function saveProgress(map: ProgressMap): Promise<void> {
  try {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // Progress is a convenience, not the game. A failed write must never
    // interrupt play.
  }
}

/**
 * Fold a finished run into progress. Returns the updated map, including the
 * unlock of the next level when this one earns Rescue.
 */
export async function recordResult(
  map: ProgressMap,
  result: RunResult,
  signal: SignalPlacement | null,
): Promise<ProgressMap> {
  const current = map[result.levelId] ?? blank(result.levelId, true);
  const next: ProgressMap = {...map};

  const better = (a: number | null, b: number | null) =>
    a === null ? b : b === null ? a : Math.min(a, b);

  next[result.levelId] = {
    ...current,
    attemptCount: current.attemptCount + 1,
    completed: current.completed || result.success,
    bestFinishTick: result.success
      ? better(current.bestFinishTick, result.finishTick)
      : current.bestFinishTick,
    bestWaitTicks: result.success
      ? better(current.bestWaitTicks, result.totalWaitTicks)
      : current.bestWaitTicks,
    marks: {
      rescue: current.marks.rescue || result.marks.rescue,
      flow: current.marks.flow || result.marks.flow,
      swift: current.marks.swift || result.marks.swift,
    },
    completedAt:
      current.completedAt ??
      (result.success ? new Date().toISOString() : null),
  };

  if (result.success) {
    const index = LEVELS.findIndex(l => l.id === result.levelId);
    const following = LEVELS[index + 1];
    if (following) {
      next[following.id] = {...next[following.id], unlocked: true};
    }
  }

  await saveProgress(next);
  await appendRun({
    levelId: result.levelId,
    attemptNo: next[result.levelId].attemptCount,
    signalSocketId: signal?.socketId ?? null,
    signalEdgeId: signal?.edgeId ?? null,
    savedCount: result.savedCount,
    totalCount: result.totalCount,
    finishTick: result.finishTick,
    totalWaitTicks: result.totalWaitTicks,
    totalExposure: result.totalExposure,
    failureReason: result.failureReason,
    createdAt: new Date().toISOString(),
  });

  return next;
}

async function appendRun(record: RunRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RUNS_KEY);
    const runs = raw ? (JSON.parse(raw) as RunRecord[]) : [];
    runs.push(record);
    await AsyncStorage.setItem(
      RUNS_KEY,
      JSON.stringify(runs.slice(-RUN_LOG_LIMIT)),
    );
  } catch {
    // As above.
  }
}

const MUTED_KEY = 'bts:muted:v1';

export async function loadMuted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MUTED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveMuted(muted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // A setting that fails to persist is not worth interrupting anything for.
  }
}

/** Read back during a playtest to count attempts and failure reasons. */
export async function loadRuns(): Promise<RunRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(RUNS_KEY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

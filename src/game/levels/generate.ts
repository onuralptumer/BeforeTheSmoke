/**
 * Generating incidents, and grading them before they are kept.
 *
 * The measured problem with the ten hand-authored levels is not that they are
 * badly made — it is that each has exactly one winning placement, so every mark
 * is handed over with the win and there is nothing left to optimise. Fixing
 * that by hand means authoring a graph where two different routes both save
 * everybody at *different* costs, then proving it, which is slow and easy to
 * get wrong.
 *
 * The configuration space of a level is tiny, so it is cheaper to search. This
 * emits candidates from a grammar and hands each to `difficultyOf`; only the
 * ones that clear the targets survive. The generator is not clever, and does
 * not need to be — the oracle is the part that carries the quality, and it is
 * the same oracle that grades the hand-authored levels.
 *
 * Everything is derived from a seed: the same seed always produces the same
 * level, so a generated incident can be identified by a number rather than
 * shipped as data, and a daily puzzle is one integer.
 */

import {
  LevelDefinition,
  NavEdge,
  NavNode,
  SignalPlacement,
} from '../types';
import {at, edge, node} from './builder';
import {DifficultyTargets, difficultyOf, gradeLevel} from './difficulty';
import {enumerateSignalSets, runLevel} from './validate';
import {compareRuns} from '../score';

/**
 * mulberry32. Small, fast, and — the only property that matters here —
 * identical on every platform, so a seed names the same level everywhere.
 */
/* eslint-disable no-bitwise -- mulberry32 is defined in terms of these ops;
   any "clearer" rewrite would produce different numbers and rename every
   generated level. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

const pick = <T,>(r: () => number, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)];

/**
 * The grammar: a spine rising from the spawn to a first junction, which splits
 * left and right into two further junctions, each of which chooses between two
 * exits.
 *
 * The shape is chosen so that the two halves can be given *different travel
 * costs*. That is the whole point — a level where both branches save everybody
 * but one is faster is a level where Swift means something, which is precisely
 * what none of the hand-authored ten manage.
 */
/**
 * Archetype 1 — the shutting branch.
 *
 * The crowd walks into a corridor that closes behind them. Two rescues exist
 * and one is faster, which is where the win margin comes from.
 */
function buildShuttingBranch(seed: number): LevelDefinition | null {
  const r = rng(seed);

  const spineX = 6;
  const spawnY = 18;
  const rowY = 15;

  const leftX = pick(r, [2, 3, 4]);
  const rightX = pick(r, [8, 9, 10]);
  const leftUpY = pick(r, [10, 11, 12]);
  const rightUpY = pick(r, [9, 10, 11]);
  const leftDownY = pick(r, [17, 18, 19]);
  const rightDownY = pick(r, [17, 18, 19]);

  // Costs the agents will actually perceive, in ticks.
  const costEA = rowY - leftUpY;
  const costEB = leftDownY - rowY + leftX;
  const costEC = rowY - rightUpY;
  const costED = rightDownY - rowY + (12 - rightX);
  const toJL = spineX - leftX;
  const toJR = rightX - spineX;

  // The level only works if the crowd walks into the trap unprompted, so the
  // route that shuts has to be the one they would choose anyway: left at J1,
  // then up to EA. Everything else is a rescue the player has to find.
  const leftIsCheaper = toJL + costEA < toJR + Math.min(costEC, costED);
  if (!leftIsCheaper || costEA >= costEB) {
    return null;
  }
  // And the alternatives have to be genuinely unequal, or every rescue is as
  // good as every other and Swift measures nothing — the exact flatness the
  // hand-authored levels have.
  if (costEB === toJR + Math.min(costEC, costED)) {
    return null;
  }

  const S = node('S', 'SPAWN', at(spineX, spawnY));
  const J1 = node('J1', 'JUNCTION', at(spineX, rowY));
  const JL = node('JL', 'JUNCTION', at(leftX, rowY));
  const JR = node('JR', 'JUNCTION', at(rightX, rowY));
  const EA = node('EA', 'EXIT', at(leftX, leftUpY));
  const EB = node('EB', 'EXIT', at(0, leftDownY));
  const EC = node('EC', 'EXIT', at(rightX, rightUpY));
  const ED = node('ED', 'EXIT', at(12, rightDownY));

  let edges: NavEdge[];
  try {
    edges = [
      edge('e_s_j1', S, J1),
      edge('e_j1_jl', J1, JL),
      edge('e_j1_jr', J1, JR),
      edge('e_jl_ea', JL, EA),
      edge('e_jl_eb', JL, EB, at(leftX, leftDownY)),
      edge('e_jr_ec', JR, EC),
      edge('e_jr_ed', JR, ED, at(rightX, rightDownY)),
    ];
  } catch {
    return null;
  }

  const nodes: NavNode[] = [S, J1, JL, JR, EA, EB, EC, ED];

  const crowd = pick(r, [4, 5, 6, 7, 8]);
  // At least one slow person, always. A crowd that moves at one speed either
  // all escapes or all dies, and a level whose only outcomes are 0 and
  // everybody has no near-miss for the player to learn from — which is why the
  // first 302 candidates scored zero on decoyStrength without exception.
  const slowCount = pick(r, [1, 1, 2]);
  // The slow people go at the *back*. At the front they would only meter the
  // corridor behind them; at the back they are the tail that a shutting door
  // catches, which is what turns a wipeout into losing exactly one person.
  // A crowd of Followers behaves quite differently from a crowd of Navigators
  // on the same geometry: they copy whoever they can see rather than routing
  // for themselves, so one signal at the front turns all of them. Mixing the
  // composition is what stops every generated level being the same level.
  const followerRun = r() < 0.5;
  const agents = Array.from({length: crowd}, (_, i) => ({
    id: i === 0 ? 'lead' : `a${i}`,
    type:
      i >= crowd - slowCount
        ? ('SLOW' as const)
        : followerRun && i > 0
        ? ('FOLLOWER' as const)
        : ('NAVIGATOR' as const),
    spawnNodeId: 'S',
    scheduledTick: 0,
  }));

  // The door sits deep in the chosen branch and shuts only once the crowd has
  // committed to it. Shutting earlier would be visible at JL, and they would
  // simply take the other exit — which is how 556 of the first 600 candidates
  // ended up with a baseline that succeeds and no incident to diagnose.
  const arriveJL = (spawnY - rowY) + toJL;
  const doorCell = at(leftX, leftUpY + 1);
  // When the door shuts decides whether this is a wipeout or a near-miss. Shut
  // it as the crowd is strung out along the corridor and the leaders are
  // already through while the slow one is not — one person lost instead of
  // everybody, which is the outcome a player can actually learn from. The
  // search explores the whole transit window rather than guessing.
  // Anchored to when the crowd reaches the door rather than to when it reaches
  // the junction: the lead arrives at `arriveDoor`, and each person behind
  // roughly a tick later. Shutting inside that window is what leaves the tail
  // on the wrong side while the leaders are already out.
  const arriveDoor = arriveJL + costEA - 1;
  const doorTick =
    arriveDoor + pick(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  // Smoke sits on the northern arm of the *right* branch, which is the route a
  // player reaches for first when they see the left one shut. Two cells costs a
  // Navigator two ticks of exposure and a Slow person four, and EXPOSURE_LIMIT
  // is 4 — so that redirection saves everyone except the slow one. It is a
  // near-miss rather than a failure, and it is the decoy the level needs.
  const smokeCells = [at(rightX, rowY - 1), at(rightX, rowY - 2)];

  return {
    id: `gen-${seed}`,
    title: `Generated ${seed}`,
    teaches: 'Generated incident.',
    width: 13,
    height: 20,
    graph: {nodes, edges},
    doorCells: [doorCell],
    agents,
    signalSockets: [
      {
        id: 'sock-j1',
        junctionId: 'J1',
        allowedEdgeIds: ['e_j1_jl', 'e_j1_jr'],
        anchorCell: at(spineX, rowY - 1),
      },
      {
        id: 'sock-jl',
        junctionId: 'JL',
        allowedEdgeIds: ['e_jl_ea', 'e_jl_eb'],
        anchorCell: at(leftX, rowY + 1),
      },
      {
        id: 'sock-jr',
        junctionId: 'JR',
        allowedEdgeIds: ['e_jr_ec', 'e_jr_ed'],
        anchorCell: at(rightX, rowY + 1),
      },
    ],
    events: [
      {tick: doorTick, type: 'CLOSE_DOOR', cell: doorCell},
      {tick: pick(r, [6, 8, 10]), type: 'ADD_SMOKE', cells: smokeCells},
    ],
    maxTicks: 60,
    parFinishTick: 60,
    maxWaitTicksForFlow: 40,
    criticalDecision: {junctionId: 'J1'},
    intendedSolutions: [],
    temptingFailures: [],
  };
}

/**
 * Run the candidate, then write back the facts only running it can establish:
 * par is the best finish anyone can achieve, the best runs become the intended
 * solutions, and every other winner is recorded as an alternate so the
 * "undocumented solution" check stays meaningful.
 */
function settle(level: LevelDefinition): LevelDefinition | null {
  const sets = enumerateSignalSets(level);
  const scored = sets
    .map(set => ({set, result: runLevel(level, set)}))
    .filter(x => x.result.success)
    .sort((a, b) => compareRuns(a.result, b.result));

  if (scored.length === 0) {
    return null;
  }

  const best = scored[0].result;
  if (best.finishTick === null) {
    return null;
  }

  const bestSets = scored
    .filter(x => x.result.finishTick === best.finishTick)
    .map(x => x.set);
  const rest = scored
    .filter(x => x.result.finishTick !== best.finishTick)
    .map(x => x.set);

  const losing = sets.filter(
    set => !scored.some(x => label(x.set) === label(set)),
  );

  return {
    ...level,
    parFinishTick: best.finishTick,
    maxWaitTicksForFlow: best.totalWaitTicks,
    intendedSolutions: bestSets.length === 1 ? bestSets[0] : bestSets[0],
    alternateSolutions: [...bestSets.slice(1), ...rest],
    temptingFailures: losing.length > 0 ? losing[0] : [],
  };
}

const label = (set: SignalPlacement[]) =>
  set
    .map(p => `${p.socketId}->${p.edgeId}`)
    .sort()
    .join(' + ');

/**
 * Archetype 2 — the merge.
 *
 * Two groups funnel into one doorway. Nothing shuts and nothing is unreachable;
 * the hazard is capacity, and smoke arrives at the merge while people are still
 * queued in it. Redirecting either group relieves the queue, and the two
 * redirections cost different amounts of time — but more importantly they cost
 * different amounts of *waiting*, which is the only way Flow can mean anything.
 * The shutting-branch archetype cannot produce congestion at all, so every
 * level it makes leaves Flow free.
 */
function buildMerge(seed: number): LevelDefinition | null {
  const r = rng(seed);

  const leftX = pick(r, [3, 4]);
  const rightX = pick(r, [8, 9]);
  const rowY = 15;
  const mergeY = 13;
  const mergeX = 6;
  const exitY = pick(r, [9, 10, 11]);
  // The alternate exits go in the far top corners, not beside the junctions.
  // Placed level with row 15 they cost three or four ticks against the merge's
  // nine, so both groups would simply take them and never queue — which is how
  // the first 2000 merge candidates were all rejected by their own cost guard.
  const sideLeftY = pick(r, [8, 9, 10]);
  const sideRightY = pick(r, [8, 9, 10]);

  const SA = node('SA', 'SPAWN', at(leftX, 18));
  const SB = node('SB', 'SPAWN', at(rightX, 18));
  const JA = node('JA', 'JUNCTION', at(leftX, rowY));
  const JB = node('JB', 'JUNCTION', at(rightX, rowY));
  const M = node('M', 'MERGE', at(mergeX, mergeY));
  const E1 = node('E1', 'EXIT', at(mergeX, exitY));
  const E2 = node('E2', 'EXIT', at(0, sideLeftY));
  const E3 = node('E3', 'EXIT', at(12, sideRightY));

  let edges: NavEdge[];
  try {
    edges = [
      edge('e_sa_ja', SA, JA),
      edge('e_sb_jb', SB, JB),
      edge('e_ja_m', JA, M, at(leftX, mergeY)),
      edge('e_jb_m', JB, M, at(rightX, mergeY)),
      edge('e_m_e1', M, E1),
      edge('e_ja_e2', JA, E2, at(0, rowY)),
      edge('e_jb_e3', JB, E3, at(12, rowY)),
    ];
  } catch {
    return null;
  }

  // The central route has to be the one both groups would pick unprompted, or
  // there is no queue and no incident.
  const viaMerge = rowY - mergeY + (mergeX - leftX) + (mergeY - exitY);
  const viaSideLeft = leftX + (rowY - sideLeftY);
  const viaSideRight = 12 - rightX + (rowY - sideRightY);
  // Both groups must prefer the middle, or there is no queue and no incident.
  // The margin has to be real: a tie would leave the choice to declaration
  // order rather than to the geometry the player can see.
  if (viaMerge >= viaSideLeft - 1 || viaMerge >= viaSideRight - 1) {
    return null;
  }

  // Big enough groups that a one-cell doorway actually backs up. At three a
  // side they arrive staggered enough to walk straight through, and the level
  // has no hazard at all: measured wait was 0-2 ticks across the whole crowd.
  const perSide = pick(r, [4, 5, 6]);
  const agents = [
    ...Array.from({length: perSide}, (_, i) => ({
      id: `a${i}`,
      type: (i === perSide - 1 ? 'SLOW' : 'NAVIGATOR') as 'SLOW' | 'NAVIGATOR',
      spawnNodeId: 'SA',
      scheduledTick: 0,
    })),
    ...Array.from({length: perSide}, (_, i) => ({
      id: `b${i}`,
      type: 'NAVIGATOR' as const,
      spawnNodeId: 'SB',
      scheduledTick: 0,
    })),
  ];

  // Smoke lands on the merge itself, where the queue is standing.
  const smokeTick = pick(r, [5, 6, 7, 8]);

  return {
    id: `gen-${seed}`,
    title: `Generated ${seed}`,
    teaches: 'Generated incident.',
    width: 13,
    height: 20,
    graph: {nodes: [SA, SB, JA, JB, M, E1, E2, E3], edges},
    doorCells: [at(mergeX, mergeY - 1)],
    agents,
    signalSockets: [
      {
        id: 'sock-ja',
        junctionId: 'JA',
        allowedEdgeIds: ['e_ja_m', 'e_ja_e2'],
        anchorCell: at(leftX, rowY + 1),
      },
      {
        id: 'sock-jb',
        junctionId: 'JB',
        allowedEdgeIds: ['e_jb_m', 'e_jb_e3'],
        anchorCell: at(rightX, rowY + 1),
      },
    ],
    events: [
      {
        tick: smokeTick,
        type: 'ADD_SMOKE',
        // Across the merge and one cell back down each approach, so the queue
        // standing behind the doorway is in it too, not just the person at the
        // front.
        cells: [
          at(mergeX - 1, mergeY),
          at(mergeX, mergeY),
          at(mergeX + 1, mergeY),
        ],
      },
    ],
    maxTicks: 60,
    parFinishTick: 60,
    maxWaitTicksForFlow: 40,
    criticalDecision: {junctionId: 'JA'},
    intendedSolutions: [],
    temptingFailures: [],
  };
}

/** The grammars, tried in turn so a search covers all of them. */
const ARCHETYPES = [buildShuttingBranch, buildMerge];

export function buildCandidate(seed: number): LevelDefinition | null {
  const archetype = ARCHETYPES[seed % ARCHETYPES.length];
  return archetype(Math.floor(seed / ARCHETYPES.length) + 1);
}

export interface GeneratedLevel {
  seed: number;
  level: LevelDefinition;
}

/**
 * Search seeds for levels that clear the targets. Returns at most `count`,
 * scanning at most `limit` seeds so a caller can never hang.
 */
export function findLevels(
  count: number,
  targets?: DifficultyTargets,
  limit = 4000,
  startSeed = 1,
): GeneratedLevel[] {
  const found: GeneratedLevel[] = [];
  for (let seed = startSeed; seed < startSeed + limit && found.length < count; seed++) {
    const candidate = buildCandidate(seed);
    if (!candidate) {
      continue;
    }
    let settled: LevelDefinition | null = null;
    try {
      settled = settle(candidate);
    } catch {
      continue;
    }
    if (!settled) {
      continue;
    }
    let report;
    try {
      report = difficultyOf(settled);
    } catch {
      continue;
    }
    if (gradeLevel(report, targets).length === 0) {
      found.push({seed, level: settled});
    }
  }
  return found;
}

/**
 * Turn an accepted seed into a shipped level.
 *
 * The levels built this way are kept as a seed plus an authored identity rather
 * than as expanded data. The generator is deterministic and covered by tests,
 * so the seed *is* the geometry — writing it out would only be a second copy
 * that could drift from the first. What a seed cannot supply is what the level
 * is called and what it is for, and those are authored.
 *
 * `levels.authored.test.ts` pins the properties each shipped level relies on,
 * so a change to the grammar that would quietly reshape a released level fails
 * the build instead.
 */
export function fromSeed(
  seed: number,
  identity: Pick<LevelDefinition, 'id' | 'title' | 'teaches'>,
): LevelDefinition {
  const candidate = buildCandidate(seed);
  if (!candidate) {
    throw new Error(`seed ${seed} does not build a level`);
  }
  const settled = settle(candidate);
  if (!settled) {
    throw new Error(`seed ${seed} builds nothing solvable`);
  }
  // The best solution's junction is the decision that mattered most, which is
  // what the analysis view should point at — not, as the grammar assumes,
  // whichever junction happens to come first.
  const best = settled.intendedSolutions[0];
  const socket = settled.signalSockets.find(x => x.id === best?.socketId);

  return {
    ...settled,
    ...identity,
    criticalDecision: {
      junctionId: socket?.junctionId ?? settled.criticalDecision.junctionId,
    },
  };
}

export {settle};

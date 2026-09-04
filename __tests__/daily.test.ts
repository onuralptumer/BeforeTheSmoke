/**
 * The Daily Incident, and why a claimed score never has to be trusted.
 *
 * Both halves rest on the same property: the simulation is deterministic. A
 * date names a level completely, and a level plus its placements names a result
 * completely. Nothing has to be shipped and nothing has to be believed.
 */

import {
  clearDailyCache,
  dailyIncident,
  dailySeed,
  dayNumber,
} from '../src/game/daily';
import {
  claimFor,
  decodeClaim,
  encodeClaim,
  ghostFromClaim,
  verifyClaim,
} from '../src/game/replay/claim';
import {recordRun} from '../src/game/replay/record';
import {enumerateSignalSets, runLevel} from '../src/game/levels/validate';
import {difficultyOf, gradeLevel} from '../src/game/levels/difficulty';
import {LEVELS} from '../src/game/levels';

const AT = (iso: string) => new Date(iso);

describe('daily incident', () => {
  beforeEach(clearDailyCache);

  it('is the same for everyone on the same UTC day', () => {
    // Two moments 20 hours apart but inside one UTC day: same incident.
    const morning = dailyIncident(AT('2026-03-14T02:00:00Z'))!;
    clearDailyCache();
    const evening = dailyIncident(AT('2026-03-14T22:00:00Z'))!;
    expect(evening.seed).toBe(morning.seed);
    expect(evening.day).toBe(morning.day);
  });

  it('changes at the UTC boundary, not a local one', () => {
    const before = dayNumber(AT('2026-03-14T23:59:59Z'));
    const after = dayNumber(AT('2026-03-15T00:00:01Z'));
    expect(after).toBe(before + 1);
  });

  it('does not repeat itself on consecutive days', () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const d = new Date(Date.UTC(2026, 2, 14 + i));
      seeds.add(dailySeed(d));
    }
    // Ten different starting points, so ten different searches.
    expect(seeds.size).toBe(10);
  });

  it('produces a level that clears the difficulty targets', () => {
    const incident = dailyIncident(AT('2026-03-14T02:00:00Z'))!;
    expect(incident).not.toBeNull();
    expect(gradeLevel(difficultyOf(incident.level))).toEqual([]);
  });

  it('is reproducible from the seed alone', () => {
    const a = dailyIncident(AT('2026-05-01T09:00:00Z'))!;
    clearDailyCache();
    const b = dailyIncident(AT('2026-05-01T09:00:00Z'))!;
    expect(JSON.stringify(b.level)).toEqual(JSON.stringify(a.level));
  });
});

describe('score claims', () => {
  const level = LEVELS[9];
  const winning = enumerateSignalSets(level).find(
    set => runLevel(level, set).success,
  )!;
  const result = runLevel(level, winning);

  it('round-trips through the wire format', () => {
    const claim = claimFor('level-10', result);
    const text = encodeClaim(claim, level);
    const back = decodeClaim(text, level);
    expect(back.placements).toEqual(
      claim.placements.map(p => ({...p, activateTick: p.activateTick ?? 0})),
    );
    expect(back.claimed).toEqual(claim.claimed);
  });

  it('stays small enough to be a URL', () => {
    const text = encodeClaim(claimFor('level-10', result), level);
    expect(text.length).toBeLessThan(40);
  });

  it('accepts an honest claim', () => {
    const verdict = verifyClaim(claimFor('level-10', result), level);
    expect(verdict.honest).toBe(true);
    expect(verdict.mismatches).toEqual([]);
  });

  it('rejects an inflated score, and reports the real one', () => {
    const forged = claimFor('level-10', result);
    forged.claimed.savedCount = 99;
    forged.claimed.finishTick = 1;

    const verdict = verifyClaim(forged, level);
    expect(verdict.honest).toBe(false);
    expect(verdict.mismatches).toHaveLength(2);
    // The point: the true score falls out of verification for free.
    expect(verdict.actual.savedCount).toBe(result.savedCount);
    expect(verdict.actual.finishTick).toBe(result.finishTick);
  });

  it('cannot smuggle a placement the level does not allow', () => {
    expect(() => decodeClaim('1|level-10|9.0.0|9|26', level)).toThrow(
      /socket 9/,
    );
    expect(() => decodeClaim('1|level-10|0.7.0|9|26', level)).toThrow(/edge 7/);
  });

  it('verifies a claim on a daily level the verifier never received', () => {
    // The server is given a day and a claim, and rebuilds the level itself.
    const incident = dailyIncident(AT('2026-03-14T02:00:00Z'))!;
    const set = enumerateSignalSets(incident.level).find(
      s => runLevel(incident.level, s).success,
    )!;
    const honest = runLevel(incident.level, set);
    const text = encodeClaim(
      claimFor(`daily-${incident.day}`, honest),
      incident.level,
    );

    clearDailyCache();
    const rebuilt = dailyIncident(AT('2026-03-14T18:00:00Z'))!;
    const verdict = verifyClaim(decodeClaim(text, rebuilt.level), rebuilt.level);
    expect(verdict.honest).toBe(true);
  });
});

describe('ghost replays', () => {
  const level = LEVELS[9];
  const winning = enumerateSignalSets(level).find(
    set => runLevel(level, set).success,
  )!;

  it('rebuilds a rival run frame-for-frame from its claim alone', () => {
    const mine = recordRun(level, winning);
    const text = encodeClaim(claimFor('level-10', mine.result), level);

    // All the far end ever receives is this string.
    const ghost = ghostFromClaim(decodeClaim(text, level), level);

    expect(ghost.frames.length).toBe(mine.frames.length);
    expect(JSON.stringify(ghost.frames)).toEqual(JSON.stringify(mine.frames));
    expect(ghost.result.finishTick).toBe(mine.result.finishTick);
  });
});

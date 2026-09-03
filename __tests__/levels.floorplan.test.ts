/**
 * The drawn building must never contradict the navigable one.
 *
 * A level's floor plan is presentation only — the simulation's geometry comes
 * from the graph, and nothing in `floorPlan` can change it. That freedom is
 * exactly the danger: it would be trivial to draw a room over a corridor people
 * walk down, and then the plan would be showing the player something false.
 *
 * The whole analysis phase rests on the canvas being a truthful readout of the
 * simulation, so these are the rules a floor plan has to keep:
 *
 *   1. no room may cover a walkable cell — rooms fill the footprint everywhere
 *      the graph is not, so the space left between them *is* the circulation;
 *   2. every walkable cell must be inside the shell, or people would be walking
 *      outside the building;
 *   3. rooms may not overlap each other, which would draw walls through walls;
 *   4. props sit inside a room, not in the corridor people are escaping down.
 */

import {LEVELS} from '../src/game/levels';
import {WorldMap} from '../src/game/engine/world';
import {deriveFloorPlan} from '../src/rendering/floorplan';
import {LevelDefinition, cellKey} from '../src/game/types';

const walkableCells = (level: LevelDefinition) => {
  const map = new WorldMap(level);
  const keys = new Set<string>();
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (map.tiles[y][x] !== 'WALL') {
        keys.add(cellKey({x, y}));
      }
    }
  }
  return keys;
};

const cellsOf = (r: {x: number; y: number; w: number; h: number}) => {
  const out: Array<{x: number; y: number}> = [];
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      out.push({x, y});
    }
  }
  return out;
};

describe('floor plans', () => {
  for (const level of LEVELS) {
    // Derived plans are held to exactly the same rules as authored ones — they
    // are what most levels actually draw.
    const plan = level.floorPlan ?? deriveFloorPlan(level, new WorldMap(level));
    if (!plan) {
      continue;
    }

    describe(`${level.id} — ${level.title}`, () => {
      const walkable = walkableCells(level);

      it('never draws a room over a cell people walk on', () => {
        const collisions: string[] = [];
        for (const room of plan.rooms) {
          for (const c of cellsOf(room)) {
            if (walkable.has(cellKey(c))) {
              collisions.push(`${room.label ?? 'room'} covers ${cellKey(c)}`);
            }
          }
        }
        expect(collisions).toEqual([]);
      });

      it('keeps every walkable cell inside the building', () => {
        const outside: string[] = [];
        for (const key of walkable) {
          const [x, y] = key.split(',').map(Number);
          const {shell} = plan;
          if (
            x < shell.x ||
            y < shell.y ||
            x >= shell.x + shell.w ||
            y >= shell.y + shell.h
          ) {
            outside.push(key);
          }
        }
        expect(outside).toEqual([]);
      });

      it('does not overlap rooms with each other', () => {
        const seen = new Map<string, string>();
        const overlaps: string[] = [];
        for (const room of plan.rooms) {
          for (const c of cellsOf(room)) {
            const k = cellKey(c);
            const prev = seen.get(k);
            if (prev) {
              overlaps.push(`${prev} and ${room.label ?? 'room'} share ${k}`);
            }
            seen.set(k, room.label ?? 'room');
          }
        }
        expect(overlaps).toEqual([]);
      });

      it('puts every prop inside a room', () => {
        const inRoom = new Set<string>();
        for (const room of plan.rooms) {
          for (const c of cellsOf(room)) {
            inRoom.add(cellKey(c));
          }
        }
        const stray = plan.props
          .filter(p => !inRoom.has(cellKey(p.cell)))
          .map(p => `${p.kind} at ${cellKey(p.cell)}`);
        expect(stray).toEqual([]);
      });
    });
  }
});

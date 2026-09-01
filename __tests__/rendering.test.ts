/**
 * Rendering geometry. Pure functions only — the drawing layers are thin
 * wrappers over these, so the behaviour that matters is testable without a
 * device.
 */

import {
  boundingWalls,
  cellAtPoint,
  fitViewport,
  lerpCentre,
} from '../src/rendering/geometry';
import {WorldMap} from '../src/game/engine/world';
import {LEVELS} from '../src/game/levels';

describe('viewport', () => {
  it('fits the grid and centres it', () => {
    const v = fitViewport(390, 700, 13, 20);
    expect(v.cell).toBe(30);
    expect(v.width).toBe(390);
    expect(v.height).toBe(600);
    expect(v.originX).toBe(0);
    expect(v.originY).toBe(50);
  });

  it('maps a touch back to the cell under it, and rejects the margin', () => {
    const v = fitViewport(390, 700, 13, 20);
    expect(cellAtPoint(v, 15, 65, 13, 20)).toEqual({x: 0, y: 0});
    expect(cellAtPoint(v, 389, 649, 13, 20)).toEqual({x: 12, y: 19});
    expect(cellAtPoint(v, 15, 10, 13, 20)).toBeNull();
  });

  it('interpolates between two cells', () => {
    const v = fitViewport(390, 700, 13, 20);
    const mid = lerpCentre(v, {x: 0, y: 0}, {x: 1, y: 0}, 0.5);
    expect(mid).toEqual({x: 30, y: 65});
  });
});

describe('bounding walls', () => {
  it('keeps only wall cells that touch something walkable', () => {
    // A single walkable cell in the middle of a 5x5 block: exactly the eight
    // cells around it should be painted, not the other sixteen.
    const walls = boundingWalls((x, y) => !(x === 2 && y === 2), 5, 5);
    expect(walls).toHaveLength(8);
    expect(walls).toContainEqual({x: 1, y: 1});
    expect(walls).toContainEqual({x: 3, y: 3});
    expect(walls).not.toContainEqual({x: 0, y: 0});
  });

  it('never paints the whole sheet for a real level', () => {
    for (const level of LEVELS) {
      const map = new WorldMap(level);
      const walls = boundingWalls(
        (x, y) => map.tiles[y][x] === 'WALL',
        level.width,
        level.height,
      );
      const total = level.width * level.height;
      // The regression this guards: filling every empty cell turned a sparse
      // level into a black slab.
      expect(walls.length).toBeLessThan(total * 0.6);
      expect(walls.length).toBeGreaterThan(0);
    }
  });

  it('encloses every walkable cell', () => {
    for (const level of LEVELS) {
      const map = new WorldMap(level);
      const painted = new Set(
        boundingWalls(
          (x, y) => map.tiles[y][x] === 'WALL',
          level.width,
          level.height,
        ).map(c => `${c.x},${c.y}`),
      );
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          if (map.tiles[y][x] === 'WALL') {
            continue;
          }
          // Every wall cell orthogonally touching a corridor must be drawn,
          // or the plan would leak into the background.
          for (const [dx, dy] of [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ]) {
            const nx = x + dx;
            const ny = y + dy;
            const outside =
              nx < 0 || ny < 0 || nx >= level.width || ny >= level.height;
            if (outside || map.tiles[ny][nx] !== 'WALL') {
              continue;
            }
            expect(painted.has(`${nx},${ny}`)).toBe(true);
          }
        }
      }
    }
  });
});

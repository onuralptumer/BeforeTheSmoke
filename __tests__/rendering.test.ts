/**
 * Rendering geometry. Pure functions only — the drawing layers are thin
 * wrappers over these, so the behaviour that matters is testable without a
 * device.
 */

import {
  contentBounds,
  fitViewport,
  fitViewportToContent,
  lerpCentre,
  cellAtPoint,
  cellCentre,
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
    expect(v.frameX).toBe(v.originX);
  });

  it('maps a touch back to the cell under it, and rejects the margin', () => {
    const v = fitViewport(390, 700, 13, 20);
    expect(cellAtPoint(v, 15, 65, 13, 20)).toEqual({x: 0, y: 0});
    expect(cellAtPoint(v, 389, 649, 13, 20)).toEqual({x: 12, y: 19});
    expect(cellAtPoint(v, 15, 10, 13, 20)).toBeNull();
  });

  it('interpolates between two cells', () => {
    const v = fitViewport(390, 700, 13, 20);
    expect(lerpCentre(v, {x: 0, y: 0}, {x: 1, y: 0}, 0.5)).toEqual({
      x: 30,
      y: 65,
    });
  });
});

describe('content framing', () => {
  it('finds the occupied rectangle with a margin', () => {
    // One walkable cell at (5,5) in a 13x20 grid.
    const bounds = contentBounds((x, y) => !(x === 5 && y === 5), 13, 20);
    expect(bounds).toEqual({minX: 4, minY: 4, maxX: 6, maxY: 6});
  });

  it('falls back to the whole grid when nothing is walkable', () => {
    expect(contentBounds(() => true, 13, 20)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 12,
      maxY: 19,
    });
  });

  it('keeps cell coordinates mapping through the shifted origin', () => {
    const bounds = {minX: 4, minY: 10, maxX: 8, maxY: 16};
    const v = fitViewportToContent(350, 700, bounds);
    // The first framed cell must land at the top-left of the visible frame.
    const first = cellCentre(v, {x: bounds.minX, y: bounds.minY});
    expect(first.x).toBeCloseTo(v.frameX + v.cell / 2);
    expect(first.y).toBeCloseTo(v.frameY + v.cell / 2);
  });

  it('gives every level a larger cell than fitting the whole grid would', () => {
    for (const level of LEVELS) {
      const map = new WorldMap(level);
      const bounds = contentBounds(
        (x, y) => map.tiles[y][x] === 'WALL',
        level.width,
        level.height,
      );
      const framed = fitViewportToContent(360, 640, bounds);
      const whole = fitViewport(360, 640, level.width, level.height);
      expect(framed.cell).toBeGreaterThanOrEqual(whole.cell);
      // And the framed area must still contain the whole level.
      expect(bounds.maxX - bounds.minX + 1).toBeLessThanOrEqual(level.width);
      expect(bounds.maxY - bounds.minY + 1).toBeLessThanOrEqual(level.height);
    }
  });

  it('frames every walkable cell of every level', () => {
    for (const level of LEVELS) {
      const map = new WorldMap(level);
      const b = contentBounds(
        (x, y) => map.tiles[y][x] === 'WALL',
        level.width,
        level.height,
      );
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          if (map.tiles[y][x] === 'WALL') {
            continue;
          }
          expect(x).toBeGreaterThanOrEqual(b.minX);
          expect(x).toBeLessThanOrEqual(b.maxX);
          expect(y).toBeGreaterThanOrEqual(b.minY);
          expect(y).toBeLessThanOrEqual(b.maxY);
        }
      }
    }
  });
});

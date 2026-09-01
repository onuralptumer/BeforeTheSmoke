/**
 * Grid to screen mapping.
 *
 * Level data holds grid coordinates only; pixels are derived here at layout
 * time. This is why socket anchors are authored as cells — a screen position
 * baked into content would only be correct on one device.
 */

import {Vec2} from '../game/types';
import {layout} from '../theme';

export interface Viewport {
  cell: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export function fitViewport(
  availableWidth: number,
  availableHeight: number,
  cols: number = layout.cols,
  rows: number = layout.rows,
): Viewport {
  const cell = Math.max(
    layout.minCell,
    Math.floor(Math.min(availableWidth / cols, availableHeight / rows)),
  );
  const width = cell * cols;
  const height = cell * rows;
  return {
    cell,
    originX: Math.round((availableWidth - width) / 2),
    originY: Math.round((availableHeight - height) / 2),
    width,
    height,
  };
}

/** Top-left corner of a cell, in canvas pixels. */
export const cellOrigin = (v: Viewport, c: Vec2) => ({
  x: v.originX + c.x * v.cell,
  y: v.originY + c.y * v.cell,
});

/** Centre of a cell, in canvas pixels. */
export const cellCentre = (v: Viewport, c: Vec2) => ({
  x: v.originX + c.x * v.cell + v.cell / 2,
  y: v.originY + c.y * v.cell + v.cell / 2,
});

/** Centre of a position between two cells, for sub-tick interpolation. */
export function lerpCentre(
  v: Viewport,
  from: Vec2 | null,
  to: Vec2 | null,
  alpha: number,
) {
  if (!to) {
    return null;
  }
  if (!from) {
    return cellCentre(v, to);
  }
  const a = cellCentre(v, from);
  const b = cellCentre(v, to);
  return {x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha};
}

/** Which cell a touch landed on, or null if outside the map. */
export function cellAtPoint(
  v: Viewport,
  x: number,
  y: number,
  cols: number = layout.cols,
  rows: number = layout.rows,
): Vec2 | null {
  const cx = Math.floor((x - v.originX) / v.cell);
  const cy = Math.floor((y - v.originY) / v.cell);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) {
    return null;
  }
  return {x: cx, y: cy};
}

export const distance = (
  a: {x: number; y: number},
  b: {x: number; y: number},
) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Wall cells that actually enclose something walkable.
 *
 * Levels are sparse — Level 1 uses a few dozen cells of a 13 × 20 grid — so
 * painting every empty cell graphite turns the map into a black slab. Drawing
 * only the wall cells touching a corridor gives the architectural-plan reading
 * the design asks for.
 */
export function boundingWalls(
  isWall: (x: number, y: number) => boolean,
  width: number,
  height: number,
): Vec2[] {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height;
  const walkable = (x: number, y: number) => inside(x, y) && !isWall(x, y);

  const result: Vec2[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWall(x, y)) {
        continue;
      }
      let encloses = false;
      for (let dy = -1; dy <= 1 && !encloses; dy++) {
        for (let dx = -1; dx <= 1 && !encloses; dx++) {
          if ((dx !== 0 || dy !== 0) && walkable(x + dx, y + dy)) {
            encloses = true;
          }
        }
      }
      if (encloses) {
        result.push({x, y});
      }
    }
  }
  return result;
}

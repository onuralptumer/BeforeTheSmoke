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
  /**
   * Where cell (0,0) would sit. Cell coordinates map straight through this, so
   * nothing downstream needs to know the view is cropped — but it can fall
   * outside the visible area, so it is not the rectangle to paint.
   */
  originX: number;
  originY: number;
  /** The visible content rectangle. Paint backgrounds and washes with this. */
  frameX: number;
  frameY: number;
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
  const originX = Math.round((availableWidth - width) / 2);
  const originY = Math.round((availableHeight - height) / 2);
  return {cell, originX, originY, frameX: originX, frameY: originY, width, height};
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * The rectangle a level actually occupies.
 *
 * Levels are authored on a common 13 × 20 grid but most use a fraction of it,
 * so fitting the whole grid leaves the plan small and adrift in empty ground.
 * Framing the occupied area instead lets every incident fill the screen at the
 * largest cell size it can.
 */
export function contentBounds(
  isWall: (x: number, y: number) => boolean,
  cols: number,
  rows: number,
  margin = 1,
): Bounds {
  let minX = cols;
  let minY = rows;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isWall(x, y)) {
        continue;
      }
      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return {minX: 0, minY: 0, maxX: cols - 1, maxY: rows - 1};
  }

  return {
    minX: Math.max(0, minX - margin),
    minY: Math.max(0, minY - margin),
    maxX: Math.min(cols - 1, maxX + margin),
    maxY: Math.min(rows - 1, maxY + margin),
  };
}

/** Fit and centre the occupied area of a level in the available space. */
export function fitViewportToContent(
  availableWidth: number,
  availableHeight: number,
  bounds: Bounds,
): Viewport {
  const cols = bounds.maxX - bounds.minX + 1;
  const rows = bounds.maxY - bounds.minY + 1;
  const cell = Math.max(
    layout.minCell,
    Math.floor(Math.min(availableWidth / cols, availableHeight / rows)),
  );
  const width = cell * cols;
  const height = cell * rows;
  const frameX = Math.round((availableWidth - width) / 2);
  const frameY = Math.round((availableHeight - height) / 2);
  return {
    cell,
    // Shift the origin back by the bounds, so cell coordinates still map
    // straight through and nothing else in the renderer has to know.
    originX: frameX - bounds.minX * cell,
    originY: frameY - bounds.minY * cell,
    frameX,
    frameY,
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

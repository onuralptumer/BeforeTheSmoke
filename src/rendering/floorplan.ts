/**
 * Deriving an office from a level's corridors.
 *
 * Every level's walkable geometry comes from its navigation graph, which knows
 * about routes and nothing else — so on its own a level draws as a skeleton of
 * corridors floating on dark ground. A level may author a `floorPlan` by hand
 * to say what building those corridors run through. This derives a reasonable
 * one for every level that has not.
 *
 * The method is the same rule the hand-authored plans follow: rooms are packed
 * into the space the graph does *not* use, so whatever is left between them is
 * exactly the circulation. A room can therefore never sit on a cell somebody
 * walks on — not by careful authoring, but by construction.
 *
 * Everything here is deterministic: rectangles are found in a fixed scan order
 * and furniture is chosen by a hash of the room's position, so a level draws
 * identically every time it is opened.
 */

import {
  FloorPlan,
  LevelDefinition,
  OfficeRoom,
  PropKind,
  Vec2,
} from '../game/types';
import {WorldMap} from '../game/engine/world';

/** Names are assigned by area, largest first, so the big space reads as the office. */
const NAMES_BY_SIZE = [
  'Open Plan',
  'Studio',
  'Meeting',
  'Workroom',
  'Archive',
  'Store',
  'Break',
  'Print',
  'Riser',
  'Plant',
];

const hash = (x: number, y: number) => (x * 7 + y * 13) % 8;

/**
 * The largest axis-aligned rectangle of unused free cells whose top-left is
 * (x0, y0). Grows right first, then down for as long as every row is clear,
 * which favours the wide rooms an office plan is mostly made of.
 */
function growRoom(
  free: boolean[][],
  used: boolean[][],
  x0: number,
  y0: number,
  maxX: number,
  maxY: number,
  maxW: number,
  maxH: number,
): {w: number; h: number} {
  let w = 0;
  while (x0 + w <= maxX && w < maxW && free[y0][x0 + w] && !used[y0][x0 + w]) {
    w++;
  }
  let h = 1;
  while (y0 + h <= maxY && h < maxH) {
    let rowClear = true;
    for (let x = x0; x < x0 + w; x++) {
      if (!free[y0 + h][x] || used[y0 + h][x]) {
        rowClear = false;
        break;
      }
    }
    if (!rowClear) {
      break;
    }
    h++;
  }
  return {w, h};
}

/** Furniture for a room, by its size and a hash of where it sits. */
function furnish(room: OfficeRoom): Array<{kind: PropKind; cell: Vec2}> {
  const props: Array<{kind: PropKind; cell: Vec2}> = [];
  const area = room.w * room.h;
  const seed = hash(room.x, room.y);

  // A narrow slot is a riser or a store: cabinets against the wall.
  if (room.w === 1 || room.h === 1) {
    for (let y = room.y; y < room.y + room.h; y += 2) {
      for (let x = room.x; x < room.x + room.w; x += 2) {
        props.push({kind: 'cabinet', cell: {x, y}});
      }
    }
    return props;
  }

  // A big room gets a meeting table in the middle and desks around it.
  if (area >= 12 && room.w >= 3) {
    const cx = room.x + Math.floor((room.w - 2) / 2);
    const cy = room.y + Math.floor(room.h / 2);
    props.push({kind: 'meeting', cell: {x: cx, y: cy}});
  }

  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (props.some(p => p.cell.y === y && Math.abs(p.cell.x - x) < 2)) {
        continue;
      }
      const h = hash(x, y);
      // Leave roughly a third of the floor clear so a room does not read as a
      // solid block of furniture.
      if ((h + seed) % 3 === 0) {
        continue;
      }
      if (h === 0) {
        props.push({kind: 'plant', cell: {x, y}});
      } else if (h === 3 && area >= 6) {
        props.push({kind: 'sofa', cell: {x, y}});
      } else if (h === 5) {
        props.push({kind: 'cabinet', cell: {x, y}});
      } else if (h === 6) {
        props.push({kind: 'table', cell: {x, y}});
      } else {
        props.push({kind: 'desk', cell: {x, y}});
      }
    }
  }
  return props;
}

export function deriveFloorPlan(
  level: LevelDefinition,
  map: WorldMap,
): FloorPlan | null {
  const walkable = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < level.width &&
    y < level.height &&
    map.tiles[y][x] !== 'WALL';

  // The building is the corridors' bounding box, pushed out by one cell so
  // there is somewhere for rooms to be.
  let minX = level.width;
  let minY = level.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (!walkable(x, y)) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) {
    return null;
  }

  const sx = Math.max(0, minX - 1);
  const sy = Math.max(0, minY - 1);
  const ex = Math.min(level.width - 1, maxX + 1);
  const ey = Math.min(level.height - 1, maxY + 1);

  const free: boolean[][] = [];
  const used: boolean[][] = [];
  for (let y = 0; y < level.height; y++) {
    free.push([]);
    used.push([]);
    for (let x = 0; x < level.width; x++) {
      free[y].push(
        x >= sx && x <= ex && y >= sy && y <= ey && !walkable(x, y),
      );
      used[y].push(false);
    }
  }

  const rooms: OfficeRoom[] = [];
  for (let y = sy; y <= ey; y++) {
    for (let x = sx; x <= ex; x++) {
      if (!free[y][x] || used[y][x]) {
        continue;
      }
      // Capped so one sweep cannot swallow the whole floor as a single room.
      const {w, h} = growRoom(free, used, x, y, ex, ey, 6, 4);
      if (w === 0 || h === 0) {
        continue;
      }
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          used[yy][xx] = true;
        }
      }
      rooms.push({x, y, w, h});
    }
  }

  // Name the rooms largest first, and give each a doorway onto whichever part
  // of its perimeter actually touches a corridor.
  const byArea = [...rooms].sort(
    (a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x,
  );
  byArea.forEach((room, i) => {
    if (room.w >= 2 && i < NAMES_BY_SIZE.length) {
      room.label = NAMES_BY_SIZE[i];
    }
    for (let yy = room.y; yy < room.y + room.h && !room.door; yy++) {
      for (let xx = room.x; xx < room.x + room.w && !room.door; xx++) {
        const edge =
          xx === room.x ||
          yy === room.y ||
          xx === room.x + room.w - 1 ||
          yy === room.y + room.h - 1;
        if (!edge) {
          continue;
        }
        if (
          walkable(xx - 1, yy) ||
          walkable(xx + 1, yy) ||
          walkable(xx, yy - 1) ||
          walkable(xx, yy + 1)
        ) {
          room.door = {x: xx, y: yy};
        }
      }
    }
  });

  return {
    shell: {x: sx, y: sy, w: ex - sx + 1, h: ey - sy + 1},
    rooms,
    props: rooms.flatMap(furnish),
  };
}

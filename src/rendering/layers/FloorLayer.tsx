/**
 * The building: floor plates, structural walls, doors and exits.
 *
 * Walls are drawn as the *edges* between floor and everything else, not as
 * filled cells. That is what makes the map read as an architectural plan
 * rather than a maze of blocks: a continuous thin line hugging the walkable
 * space, with no internal seams where two corridor cells meet.
 *
 * Static apart from doors, so it is memoised on the door set — this layer must
 * never redraw on an animation frame.
 */

import React, {useMemo} from 'react';
import {
  BlurMask,
  Group,
  Path,
  Rect,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';

import {CellKey, LevelDefinition, Vec2, cellKey} from '../../game/types';
import {WorldMap} from '../../game/engine/world';
import {Viewport, cellOrigin} from '../geometry';
import {palette} from '../../theme';

interface Props {
  level: LevelDefinition;
  map: WorldMap;
  viewport: Viewport;
  closedDoors: CellKey[];
}

/** Direction a door leaf spans, taken from the corridor running through it. */
function doorAxis(map: WorldMap, cell: Vec2): 'h' | 'v' {
  const walkable = (x: number, y: number) =>
    y >= 0 &&
    y < map.tiles.length &&
    x >= 0 &&
    x < map.tiles[0].length &&
    map.tiles[y][x] !== 'WALL';
  // The leaf sits across the corridor, so it spans the axis with walls.
  return walkable(cell.x - 1, cell.y) || walkable(cell.x + 1, cell.y)
    ? 'v'
    : 'h';
}

function ExitSign({
  cell,
  viewport,
}: {
  cell: Vec2;
  viewport: Viewport;
}) {
  const {x, y} = cellOrigin(viewport, cell);
  const c = viewport.cell;
  const inset = c * 0.1;

  return (
    <Group>
      {/* Spill onto the surrounding floor, so an exit is findable from a
          distance and through light smoke. */}
      <RoundedRect
        x={x - c * 0.35}
        y={y - c * 0.35}
        width={c + c * 0.7}
        height={c + c * 0.7}
        r={c * 0.3}
        color={palette.safe}
        opacity={0.28}>
        <BlurMask blur={c * 0.45} style="normal" />
      </RoundedRect>

      <RoundedRect
        x={x + inset}
        y={y + inset}
        width={c - inset * 2}
        height={c - inset * 2}
        r={c * 0.16}
        color={palette.safeDeep}
      />
      <RoundedRect
        x={x + inset}
        y={y + inset}
        width={c - inset * 2}
        height={c - inset * 2}
        r={c * 0.16}
        color={palette.safe}
        style="stroke"
        strokeWidth={Math.max(1, c * 0.06)}
      />

      {/* A door jamb and an arrow leaving through it. Shape, not colour,
          carries the meaning. */}
      <Rect
        x={x + c * 0.26}
        y={y + c * 0.26}
        width={c * 0.1}
        height={c * 0.48}
        color={palette.safe}
      />
      <Rect
        x={x + c * 0.42}
        y={y + c * 0.47}
        width={c * 0.24}
        height={c * 0.07}
        color={palette.safe}
      />
      <Path
        path={(() => {
          const p = Skia.Path.Make();
          p.moveTo(x + c * 0.74, y + c * 0.505);
          p.lineTo(x + c * 0.6, y + c * 0.4);
          p.lineTo(x + c * 0.6, y + c * 0.61);
          p.close();
          return p;
        })()}
        color={palette.safe}
      />
    </Group>
  );
}

function FloorLayerImpl({level, map, viewport, closedDoors}: Props) {
  const closed = new Set(closedDoors);
  const c = viewport.cell;

  const walkable = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < level.width &&
    y < level.height &&
    map.tiles[y][x] !== 'WALL';

  const {floorPath, wallPath} = useMemo(() => {
    const floor = Skia.Path.Make();
    const wall = Skia.Path.Make();

    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (!walkable(x, y)) {
          continue;
        }
        const o = cellOrigin(viewport, {x, y});
        // A hair of overlap keeps neighbouring plates from showing a seam.
        floor.addRect({
          x: o.x - 0.5,
          y: o.y - 0.5,
          width: c + 1,
          height: c + 1,
        });

        // Only the sides that face something unwalkable become wall.
        if (!walkable(x, y - 1)) {
          wall.moveTo(o.x, o.y);
          wall.lineTo(o.x + c, o.y);
        }
        if (!walkable(x, y + 1)) {
          wall.moveTo(o.x, o.y + c);
          wall.lineTo(o.x + c, o.y + c);
        }
        if (!walkable(x - 1, y)) {
          wall.moveTo(o.x, o.y);
          wall.lineTo(o.x, o.y + c);
        }
        if (!walkable(x + 1, y)) {
          wall.moveTo(o.x + c, o.y);
          wall.lineTo(o.x + c, o.y + c);
        }
      }
    }
    return {floorPath: floor, wallPath: wall};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, map, viewport, c]);

  const doors = level.doorCells.map(cell => {
    const key = cellKey(cell);
    const {x, y} = cellOrigin(viewport, cell);
    const isClosed = closed.has(key);
    const axis = doorAxis(map, cell);
    // Shut: a full leaf across the opening. Open: the leaf swung aside.
    const length = isClosed ? c * 0.96 : c * 0.34;
    const thickness = c * 0.2;

    const w = axis === 'v' ? thickness : length;
    const h = axis === 'v' ? length : thickness;
    const px = x + (c - w) / 2 + (isClosed ? 0 : axis === 'v' ? 0 : -c * 0.28);
    const py = y + (c - h) / 2 + (isClosed ? 0 : axis === 'v' ? -c * 0.28 : 0);

    return (
      <Group key={`d${key}`}>
        <RoundedRect
          x={px}
          y={py}
          width={w}
          height={h}
          r={c * 0.05}
          color={isClosed ? palette.wallInner : palette.structure}
        />
        {isClosed && (
          <RoundedRect
            x={px}
            y={py}
            width={w}
            height={h}
            r={c * 0.05}
            color={palette.danger}
            opacity={0.5}
            style="stroke"
            strokeWidth={Math.max(1, c * 0.05)}
          />
        )}
      </Group>
    );
  });

  return (
    <Group>
      <Rect
        x={viewport.frameX}
        y={viewport.frameY}
        width={viewport.width}
        height={viewport.height}
        color={palette.ground}
      />

      {/* A soft lift under the plan, so the building sits above the ground
          rather than being cut out of it. */}
      <Path path={floorPath} color={palette.wall} opacity={0.55}>
        <BlurMask blur={c * 0.5} style="normal" />
      </Path>

      <Path path={floorPath} color={palette.floor} />
      {/* Two lines make the boundary read: a heavy dark one centred on the
          edge, and a thin light trim just inside it. Without the trim the wall
          is dark-on-dark against the ground and the plan loses its outline. */}
      <Path
        path={wallPath}
        color={palette.wall}
        style="stroke"
        strokeWidth={Math.max(2, c * 0.22)}
        strokeCap="square"
      />
      <Path
        path={wallPath}
        color={palette.wallInner}
        style="stroke"
        strokeWidth={Math.max(1, c * 0.07)}
        strokeCap="square"
        opacity={0.9}
      />

      {level.graph.nodes
        .filter(n => n.kind === 'EXIT')
        .map(n => (
          <ExitSign key={`e${n.id}`} cell={n.cell} viewport={viewport} />
        ))}
      {doors}
    </Group>
  );
}

export const FloorLayer = React.memo(
  FloorLayerImpl,
  (a, b) =>
    a.level.id === b.level.id &&
    a.viewport.cell === b.viewport.cell &&
    a.viewport.originX === b.viewport.originX &&
    a.viewport.originY === b.viewport.originY &&
    a.closedDoors.length === b.closedDoors.length &&
    a.closedDoors.every((k, i) => k === b.closedDoors[i]),
);

/**
 * Floor, walls, doors and exits.
 *
 * Static for the life of a run apart from doors, so it is memoised on the door
 * set alone — this layer must not redraw on every animation frame.
 */

import React from 'react';
import {Group, Rect, RoundedRect} from '@shopify/react-native-skia';

import {CellKey, LevelDefinition, cellKey} from '../../game/types';
import {WorldMap} from '../../game/engine/world';
import {Viewport, boundingWalls, cellOrigin} from '../geometry';
import {palette} from '../../theme';

interface Props {
  level: LevelDefinition;
  map: WorldMap;
  viewport: Viewport;
  closedDoors: CellKey[];
}

function FloorLayerImpl({level, map, viewport, closedDoors}: Props) {
  const closed = new Set(closedDoors);
  const cells: React.ReactNode[] = [];

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (map.tiles[y][x] === 'WALL') {
        continue;
      }
      const {x: px, y: py} = cellOrigin(viewport, {x, y});
      cells.push(
        <Rect
          key={`f${x},${y}`}
          x={px}
          y={py}
          width={viewport.cell}
          height={viewport.cell}
          color={palette.floor}
        />,
      );
    }
  }

  const walls = boundingWalls(
    (x, y) => map.tiles[y][x] === 'WALL',
    level.width,
    level.height,
  ).map(cell => {
    const {x, y} = cellOrigin(viewport, cell);
    return (
      <Rect
        key={`w${cell.x},${cell.y}`}
        x={x}
        y={y}
        width={viewport.cell}
        height={viewport.cell}
        color={palette.wall}
      />
    );
  });

  // Exits read as a teal plate with an outward notch.
  const exits = level.graph.nodes
    .filter(n => n.kind === 'EXIT')
    .map(n => {
      const {x, y} = cellOrigin(viewport, n.cell);
      const inset = viewport.cell * 0.12;
      return (
        <RoundedRect
          key={`e${n.id}`}
          x={x + inset}
          y={y + inset}
          width={viewport.cell - inset * 2}
          height={viewport.cell - inset * 2}
          r={viewport.cell * 0.18}
          color={palette.safe}
        />
      );
    });

  // Doors: a steel bar when open, a solid graphite slab plus a hard edge when
  // shut. The two states must be distinguishable at a glance and without
  // relying on colour alone, so the shape changes too.
  const doors = level.doorCells.map(cell => {
    const key = cellKey(cell);
    const {x, y} = cellOrigin(viewport, cell);
    const isClosed = closed.has(key);
    const thickness = isClosed ? viewport.cell * 0.9 : viewport.cell * 0.22;
    const offset = (viewport.cell - thickness) / 2;
    return (
      <Group key={`d${key}`}>
        <RoundedRect
          x={x + viewport.cell * 0.05}
          y={y + offset}
          width={viewport.cell * 0.9}
          height={thickness}
          r={2}
          color={isClosed ? palette.wall : palette.structure}
        />
      </Group>
    );
  });

  return (
    <Group>
      {walls}
      {cells}
      {exits}
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

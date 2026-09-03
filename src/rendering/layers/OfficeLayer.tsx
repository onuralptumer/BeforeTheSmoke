/**
 * The office the corridors run through.
 *
 * The plan used to be a bare skeleton of corridors floating on dark ground,
 * because the tile grid is derived from the navigation graph and the graph only
 * knows about routes. This draws the building around that: an outer shell, the
 * rooms partitioned off it, and the furniture in them.
 *
 * None of it is simulated. What keeps it honest is that rooms are authored to
 * fill the footprint *everywhere the graph is not*, so the space left between
 * them is exactly the circulation — and `levels.floorplan.test.ts` fails the
 * build if a room ever covers a cell somebody can walk on. Room interiors are
 * also painted a shade darker than the corridor, so the route stays the
 * brightest thing on the plan and the player can still see where a person is
 * able to go. A drawing that looked like an office but hid that would break the
 * analysis phase, which is the only reason any of this exists.
 */

import React, {useMemo} from 'react';
import {
  Group,
  Path,
  Rect,
  RoundedRect,
  Skia,
  Circle,
  Text,
  matchFont,
} from '@shopify/react-native-skia';

import {FloorPlan, PropKind, Vec2} from '../../game/types';
import {Viewport, cellOrigin} from '../geometry';
import {palette} from '../../theme';

interface Props {
  plan: FloorPlan;
  viewport: Viewport;
}

/** Furniture, drawn from the top as a plan would show it. */
function Prop({
  kind,
  cell,
  viewport,
}: {
  kind: PropKind;
  cell: Vec2;
  viewport: Viewport;
}) {
  const c = viewport.cell;
  const o = cellOrigin(viewport, cell);
  const col = palette.furniture;
  const r = c * 0.12;

  switch (kind) {
    case 'desk':
      return (
        <Group>
          <RoundedRect
            x={o.x + c * 0.1}
            y={o.y + c * 0.22}
            width={c * 0.8}
            height={c * 0.42}
            r={r * 0.5}
            color={col}
          />
          <Circle cx={o.x + c * 0.5} cy={o.y + c * 0.8} r={c * 0.13} color={col} />
        </Group>
      );
    case 'chair':
      return (
        <Circle cx={o.x + c * 0.5} cy={o.y + c * 0.5} r={c * 0.16} color={col} />
      );
    case 'table':
      return (
        <Circle cx={o.x + c * 0.5} cy={o.y + c * 0.5} r={c * 0.32} color={col} />
      );
    case 'meeting':
      // Spans two cells: a boardroom table, with seats down both long sides.
      return (
        <Group>
          <RoundedRect
            x={o.x + c * 0.12}
            y={o.y + c * 0.18}
            width={c * 1.76}
            height={c * 0.62}
            r={r}
            color={col}
          />
          {[0.4, 0.8, 1.2, 1.6].map(f => (
            <Group key={`s${f}`}>
              <Circle cx={o.x + c * f} cy={o.y + c * 0.02} r={c * 0.12} color={col} />
              <Circle cx={o.x + c * f} cy={o.y + c * 0.96} r={c * 0.12} color={col} />
            </Group>
          ))}
        </Group>
      );
    case 'plant':
      return (
        <Group>
          <Circle cx={o.x + c * 0.5} cy={o.y + c * 0.45} r={c * 0.24} color={col} />
          <Rect
            x={o.x + c * 0.42}
            y={o.y + c * 0.62}
            width={c * 0.16}
            height={c * 0.2}
            color={col}
          />
        </Group>
      );
    case 'sofa':
      return (
        <Group>
          <RoundedRect
            x={o.x + c * 0.08}
            y={o.y + c * 0.3}
            width={c * 0.84}
            height={c * 0.44}
            r={r}
            color={col}
          />
          <Rect
            x={o.x + c * 0.08}
            y={o.y + c * 0.24}
            width={c * 0.84}
            height={c * 0.12}
            color={col}
          />
        </Group>
      );
    case 'cabinet':
      return (
        <Group>
          <Rect
            x={o.x + c * 0.14}
            y={o.y + c * 0.2}
            width={c * 0.72}
            height={c * 0.6}
            color={col}
          />
          <Rect
            x={o.x + c * 0.14}
            y={o.y + c * 0.48}
            width={c * 0.72}
            height={Math.max(1, c * 0.04)}
            color={palette.floorRoom}
          />
        </Group>
      );
    case 'wc':
      return (
        <Group>
          <RoundedRect
            x={o.x + c * 0.28}
            y={o.y + c * 0.22}
            width={c * 0.44}
            height={c * 0.5}
            r={c * 0.16}
            color={col}
          />
          <Rect
            x={o.x + c * 0.3}
            y={o.y + c * 0.16}
            width={c * 0.4}
            height={c * 0.1}
            color={col}
          />
        </Group>
      );
  }
}

function OfficeLayerImpl({plan, viewport}: Props) {
  const c = viewport.cell;
  const {shell} = plan;

  const font = useMemo(() => {
    try {
      return matchFont({
        fontSize: Math.max(6, Math.round(c * 0.24)),
        fontWeight: '700',
      });
    } catch {
      return null;
    }
  }, [c]);

  const shellOrigin = cellOrigin(viewport, {x: shell.x, y: shell.y});
  const shellW = shell.w * c;
  const shellH = shell.h * c;

  /** Faint tile joints across the whole slab, as a floor finish would show. */
  const tiles = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 1; i < shell.w; i++) {
      p.moveTo(shellOrigin.x + i * c, shellOrigin.y);
      p.lineTo(shellOrigin.x + i * c, shellOrigin.y + shellH);
    }
    for (let j = 1; j < shell.h; j++) {
      p.moveTo(shellOrigin.x, shellOrigin.y + j * c);
      p.lineTo(shellOrigin.x + shellW, shellOrigin.y + j * c);
    }
    return p;
  }, [shell.w, shell.h, shellOrigin.x, shellOrigin.y, c, shellW, shellH]);

  /**
   * One path for every room's walls, with a gap knocked out at each doorway.
   * Drawn as four separate edges rather than a rectangle so a door can remove
   * part of one side without opening the others.
   */
  const partitions = useMemo(() => {
    const p = Skia.Path.Make();
    for (const room of plan.rooms) {
      const a = cellOrigin(viewport, {x: room.x, y: room.y});
      const x0 = a.x;
      const y0 = a.y;
      const x1 = a.x + room.w * c;
      const y1 = a.y + room.h * c;

      const door = room.door;
      const onTop = door && door.y === room.y;
      const onBottom = door && door.y === room.y + room.h - 1;
      const onLeft = door && door.x === room.x;
      const onRight = door && door.x === room.x + room.w - 1;

      // Horizontal edges, split around a door in that side.
      const hEdge = (y: number, skip: boolean) => {
        if (!skip || !door) {
          p.moveTo(x0, y);
          p.lineTo(x1, y);
          return;
        }
        const dx = cellOrigin(viewport, {x: door.x, y: room.y}).x;
        p.moveTo(x0, y);
        p.lineTo(dx + c * 0.15, y);
        p.moveTo(dx + c * 0.85, y);
        p.lineTo(x1, y);
      };
      const vEdge = (x: number, skip: boolean) => {
        if (!skip || !door) {
          p.moveTo(x, y0);
          p.lineTo(x, y1);
          return;
        }
        const dy = cellOrigin(viewport, {x: room.x, y: door.y}).y;
        p.moveTo(x, y0);
        p.lineTo(x, dy + c * 0.15);
        p.moveTo(x, dy + c * 0.85);
        p.lineTo(x, y1);
      };

      hEdge(y0, !!onTop);
      hEdge(y1, !!onBottom);
      vEdge(x0, !!onLeft);
      vEdge(x1, !!onRight);
    }
    return p;
  }, [plan.rooms, viewport, c]);

  return (
    <Group>
      {/* The slab. Everything inside the shell is floor; the rooms sit on it. */}
      <Rect
        x={shellOrigin.x}
        y={shellOrigin.y}
        width={shellW}
        height={shellH}
        color={palette.floor}
      />
      <Path
        path={tiles}
        color={palette.wall}
        style="stroke"
        strokeWidth={1}
        opacity={0.07}
      />

      {/* Room interiors, a shade under the corridor. */}
      {plan.rooms.map((room, i) => {
        const a = cellOrigin(viewport, {x: room.x, y: room.y});
        return (
          <Rect
            key={`r${i}`}
            x={a.x}
            y={a.y}
            width={room.w * c}
            height={room.h * c}
            color={palette.floorRoom}
          />
        );
      })}

      {plan.props.map((item, i) => (
        <Prop
          key={`p${i}`}
          kind={item.kind}
          cell={item.cell}
          viewport={viewport}
        />
      ))}

      {/* Partitions, then the outer shell, in the same two-line treatment the
          corridor walls use: a heavy dark line with a lighter trim inside it. */}
      {/* Room names, in tiny caps. Only where the room is actually wide enough
          to hold one — a one-cell riser gets no label rather than a clipped
          one. Drawn in the wall colour, so they read as printed on the plan. */}
      {font &&
        plan.rooms.map((room, i) => {
          if (!room.label || room.w < 2) {
            return null;
          }
          const a = cellOrigin(viewport, {x: room.x, y: room.y});
          return (
            <Text
              key={`rl${i}`}
              x={a.x + c * 0.18}
              y={a.y + c * 0.62}
              text={room.label.toUpperCase()}
              font={font}
              color={palette.wall}
              opacity={0.38}
            />
          );
        })}

      <Path
        path={partitions}
        color={palette.wall}
        style="stroke"
        strokeWidth={Math.max(2, c * 0.14)}
        strokeCap="square"
      />
      <Rect
        x={shellOrigin.x}
        y={shellOrigin.y}
        width={shellW}
        height={shellH}
        color={palette.wall}
        style="stroke"
        strokeWidth={Math.max(3, c * 0.22)}
      />
      <Rect
        x={shellOrigin.x}
        y={shellOrigin.y}
        width={shellW}
        height={shellH}
        color={palette.wallInner}
        style="stroke"
        strokeWidth={Math.max(1, c * 0.06)}
        opacity={0.8}
      />
    </Group>
  );
}

export const OfficeLayer = React.memo(
  OfficeLayerImpl,
  (a, b) =>
    a.plan === b.plan &&
    a.viewport.cell === b.viewport.cell &&
    a.viewport.originX === b.viewport.originX &&
    a.viewport.originY === b.viewport.originY,
);

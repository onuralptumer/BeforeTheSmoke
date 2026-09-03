/**
 * Sockets and the signal.
 *
 * Amber appears nowhere else in the game, which is what makes one small arrow
 * feel like the whole of the player's power. Empty sockets stay dark during
 * observation and only light up once the analysis is over — showing them
 * earlier would answer the question before it has been asked.
 */

import React from 'react';
import {
  BlurMask,
  Circle,
  Group,
  Path,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';

import {
  LevelDefinition,
  SignalPlacement,
  SignalSocketDefinition,
  Vec2,
} from '../../game/types';
import {Viewport, cellCentre} from '../geometry';
import {palette} from '../../theme';

interface Props {
  level: LevelDefinition;
  viewport: Viewport;
  showSockets: boolean;
  /** Every signal the player has placed. A level's budget caps the count. */
  signals: SignalPlacement[];
  dragPoint: {x: number; y: number} | null;
  hoveredSocketId: string | null;
  phase: number;
}

function socketCentre(v: Viewport, socket: SignalSocketDefinition) {
  return cellCentre(v, socket.anchorCell);
}

/**
 * The first cell at which this edge stops agreeing with the others the socket
 * can point along — the cell where the choice is actually made.
 *
 * Two routes out of a junction can share their opening stretch. On level 10 the
 * middle socket is the case that matters: both of its edges leave J3 through
 * the same doorway at (6,12) and only part company two cells later, one
 * carrying on north to E1 and the other turning west to E4. Taking the
 * direction from the first cell therefore drew the identical arrow for both,
 * and turning the signal looked like it did nothing at all.
 */
function divergenceIndex(cells: Vec2[], siblings: Vec2[][]): number {
  if (siblings.length === 0) {
    return 0;
  }
  for (let i = 0; i < cells.length; i++) {
    for (const other of siblings) {
      const c = other[i];
      if (!c || c.x !== cells[i].x || c.y !== cells[i].y) {
        return i;
      }
    }
  }
  return 0;
}

/**
 * Which way the signal points: the direction of travel through the cell where
 * this route separates from the alternatives, not the direction out of the
 * junction. Those are usually the same cell, and where they are not, only the
 * divergence tells the player which way they have just sent everybody.
 */
function facingFor(
  level: LevelDefinition,
  edgeId: string,
  from: Vec2,
  socket?: SignalSocketDefinition,
) {
  const edge = level.graph.edges.find(e => e.id === edgeId);
  if (!edge || edge.cells.length === 0) {
    return {dx: 0, dy: -1};
  }

  const siblings = (socket?.allowedEdgeIds ?? [])
    .filter(id => id !== edgeId)
    .map(id => level.graph.edges.find(e => e.id === id)?.cells ?? []);

  const i = divergenceIndex(edge.cells, siblings);
  const target = edge.cells[i];
  const previous = i === 0 ? from : edge.cells[i - 1];

  const dx = target.x - previous.x;
  const dy = target.y - previous.y;
  const len = Math.hypot(dx, dy) || 1;
  return {dx: dx / len, dy: dy / len};
}

/** How far along the edge the beam reaches: past the divergence, never to the exit. */
function beamIndex(
  level: LevelDefinition,
  edgeId: string,
  socket?: SignalSocketDefinition,
): number {
  const edge = level.graph.edges.find(e => e.id === edgeId);
  if (!edge) {
    return 0;
  }
  const siblings = (socket?.allowedEdgeIds ?? [])
    .filter(id => id !== edgeId)
    .map(id => level.graph.edges.find(e => e.id === id)?.cells ?? []);
  const i = divergenceIndex(edge.cells, siblings);
  // Two cells is enough to state a direction; further only when the routes
  // have not separated by then.
  return Math.min(Math.max(2, i), edge.cells.length - 1);
}

/**
 * The signal dart: a tip, two swept-back wings, and a notch in the tail.
 *
 * This used to emit five points, four of which shared `baseX`/`baseY` and
 * differed only by a perpendicular offset — so all four sat on one straight
 * line and the notch rendered as a flat base. The dart had been a plain
 * isoceles triangle since it was written.
 *
 * The notch is the point that fixes it: it sits forward of the wings, on the
 * arrow's axis, which is what makes the tail concave. Proportions match the
 * `signal-arrow` glyph in the icon set, so the arrow on the map and the arrow
 * in the tray are the same shape.
 */
function arrowPath(
  centre: {x: number; y: number},
  facing: {dx: number; dy: number},
  size: number,
) {
  const path = Skia.Path.Make();
  // Unit perpendicular to `facing`.
  const px = -facing.dy;
  const py = facing.dx;

  const along = (d: number) => ({
    x: centre.x + facing.dx * size * d,
    y: centre.y + facing.dy * size * d,
  });

  const tip = along(1);
  const tail = along(-0.4);
  // Forward of the tail and on the axis — the concavity.
  const notch = along(0);

  path.moveTo(tip.x, tip.y);
  path.lineTo(tail.x + px * size * 0.66, tail.y + py * size * 0.66);
  path.lineTo(notch.x, notch.y);
  path.lineTo(tail.x - px * size * 0.66, tail.y - py * size * 0.66);
  path.close();
  return path;
}

function Socket({
  centre,
  cell,
  hovered,
  pulse,
}: {
  centre: {x: number; y: number};
  cell: number;
  hovered: boolean;
  pulse: number;
}) {
  // The design's 8% breathing expansion, doubled while a drag is over it.
  const scale = hovered ? 1.3 : 1 + 0.08 * pulse;
  const r = cell * 0.24 * scale;

  return (
    <Group>
      <Circle
        cx={centre.x}
        cy={centre.y}
        r={r * 1.9}
        color={palette.signal}
        opacity={hovered ? 0.5 : 0.18 + 0.12 * pulse}>
        <BlurMask blur={cell * 0.35} style="normal" />
      </Circle>
      <Circle
        cx={centre.x}
        cy={centre.y}
        r={r}
        color={palette.signal}
        style="stroke"
        strokeWidth={Math.max(1, cell * 0.06)}
        opacity={hovered ? 1 : 0.8}
      />
      <Circle
        cx={centre.x}
        cy={centre.y}
        r={r * 0.34}
        color={palette.signalGlow}
      />
    </Group>
  );
}

function SignalUnit({
  centre,
  facing,
  cell,
  beamTo,
}: {
  centre: {x: number; y: number};
  facing: {dx: number; dy: number};
  cell: number;
  beamTo?: {x: number; y: number} | null;
}) {
  const size = cell * 0.44;

  return (
    <Group>
      {/* The beam states the direction without previewing the route. */}
      {beamTo && (
        <Group>
          <Path
            path={(() => {
              const p = Skia.Path.Make();
              p.moveTo(centre.x + facing.dx * size, centre.y + facing.dy * size);
              p.lineTo(beamTo.x, beamTo.y);
              return p;
            })()}
            style="stroke"
            strokeWidth={Math.max(1.5, cell * 0.09)}
            strokeCap="round"
            color={palette.signal}
            opacity={0.55}>
            <BlurMask blur={cell * 0.22} style="normal" />
          </Path>
          <Path
            path={arrowPath(beamTo, facing, cell * 0.3)}
            color={palette.signalGlow}
          />
        </Group>
      )}

      <RoundedRect
        x={centre.x - size}
        y={centre.y - size}
        width={size * 2}
        height={size * 2}
        r={size * 0.28}
        color={palette.signal}
        opacity={0.35}>
        <BlurMask blur={cell * 0.4} style="normal" />
      </RoundedRect>
      <RoundedRect
        x={centre.x - size}
        y={centre.y - size}
        width={size * 2}
        height={size * 2}
        r={size * 0.24}
        color={palette.wall}
      />
      <RoundedRect
        x={centre.x - size}
        y={centre.y - size}
        width={size * 2}
        height={size * 2}
        r={size * 0.24}
        color={palette.signal}
        style="stroke"
        strokeWidth={Math.max(1.5, cell * 0.07)}
      />
      <Path
        path={arrowPath(centre, facing, size * 0.66)}
        color={palette.signalGlow}
      />
    </Group>
  );
}

function SignalLayerImpl({
  level,
  viewport,
  showSockets,
  signals,
  dragPoint,
  hoveredSocketId,
  phase,
}: Props) {
  if (!showSockets && signals.length === 0) {
    return null;
  }

  const c = viewport.cell;
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const nodes: React.ReactNode[] = [];

  if (showSockets) {
    for (const socket of level.signalSockets) {
      // A socket holding a signal is drawn as the signal, not as an opening.
      if (signals.some(x => x.socketId === socket.id)) {
        continue;
      }
      nodes.push(
        <Socket
          key={`sock${socket.id}`}
          centre={socketCentre(viewport, socket)}
          cell={c}
          hovered={hoveredSocketId === socket.id}
          pulse={pulse}
        />,
      );
    }
  }

  for (const signal of signals) {
    const socket = level.signalSockets.find(s => s.id === signal.socketId);
    const junction = level.graph.nodes.find(n => n.id === socket?.junctionId);
    const edge = level.graph.edges.find(e => e.id === signal.edgeId);
    if (socket && junction) {
      const centre = socketCentre(viewport, socket);
      const facing = facingFor(level, signal.edgeId, junction.cell, socket);
      const beamCell = edge?.cells[beamIndex(level, signal.edgeId, socket)];
      nodes.push(
        <SignalUnit
          key={`signal${signal.socketId}`}
          centre={centre}
          facing={facing}
          cell={c}
          beamTo={beamCell ? cellCentre(viewport, beamCell) : null}
        />,
      );
    }
  }

  if (dragPoint) {
    nodes.push(
      <Group key="drag" opacity={0.92}>
        <SignalUnit centre={dragPoint} facing={{dx: 0, dy: -1}} cell={c} />
      </Group>,
    );
  }

  return <Group>{nodes}</Group>;
}

export const SignalLayer = React.memo(SignalLayerImpl);
export {socketCentre, facingFor};

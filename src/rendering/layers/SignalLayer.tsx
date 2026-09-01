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
  signal: SignalPlacement | null;
  dragPoint: {x: number; y: number} | null;
  hoveredSocketId: string | null;
  phase: number;
}

function socketCentre(v: Viewport, socket: SignalSocketDefinition) {
  return cellCentre(v, socket.anchorCell);
}

function facingFor(level: LevelDefinition, edgeId: string, from: Vec2) {
  const edge = level.graph.edges.find(e => e.id === edgeId);
  const first = edge?.cells[0];
  if (!first) {
    return {dx: 0, dy: -1};
  }
  const dx = first.x - from.x;
  const dy = first.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {dx: dx / len, dy: dy / len};
}

function arrowPath(
  centre: {x: number; y: number},
  facing: {dx: number; dy: number},
  size: number,
) {
  const path = Skia.Path.Make();
  const px = -facing.dy;
  const py = facing.dx;
  const tipX = centre.x + facing.dx * size;
  const tipY = centre.y + facing.dy * size;
  const baseX = centre.x - facing.dx * size * 0.4;
  const baseY = centre.y - facing.dy * size * 0.4;
  path.moveTo(tipX, tipY);
  path.lineTo(baseX + px * size * 0.66, baseY + py * size * 0.66);
  path.lineTo(baseX + px * size * 0.26, baseY + py * size * 0.26);
  path.lineTo(baseX - px * size * 0.26, baseY - py * size * 0.26);
  path.lineTo(baseX - px * size * 0.66, baseY - py * size * 0.66);
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
  signal,
  dragPoint,
  hoveredSocketId,
  phase,
}: Props) {
  if (!showSockets && !signal) {
    return null;
  }

  const c = viewport.cell;
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const nodes: React.ReactNode[] = [];

  if (showSockets) {
    for (const socket of level.signalSockets) {
      if (signal?.socketId === socket.id) {
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

  if (signal) {
    const socket = level.signalSockets.find(s => s.id === signal.socketId);
    const junction = level.graph.nodes.find(n => n.id === socket?.junctionId);
    const edge = level.graph.edges.find(e => e.id === signal.edgeId);
    if (socket && junction) {
      const centre = socketCentre(viewport, socket);
      const facing = facingFor(level, signal.edgeId, junction.cell);
      // Point at the third cell along: enough to state a direction, far short
      // of showing where the corridor goes.
      const beamCell = edge?.cells[Math.min(2, edge.cells.length - 1)];
      nodes.push(
        <SignalUnit
          key="signal"
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

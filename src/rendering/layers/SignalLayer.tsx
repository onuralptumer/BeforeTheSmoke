/**
 * Sockets and the signal.
 *
 * Empty sockets are recessed dark diamonds and never glow during observation —
 * that would reveal the interaction before the analysis phase. During
 * intervention they expand slightly and pulse, and the signal becomes the
 * brightest object on screen. Amber appears nowhere else in the game.
 */

import React from 'react';
import {Group, Path, RoundedRect, Skia} from '@shopify/react-native-skia';

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
  /** Where the player's finger is, while dragging. */
  dragPoint: {x: number; y: number} | null;
  /** Socket the drag would snap to right now. */
  hoveredSocketId: string | null;
  /** 0..1, drives the socket pulse. */
  phase: number;
}

function socketCentre(v: Viewport, socket: SignalSocketDefinition) {
  return cellCentre(v, socket.anchorCell);
}

/** An arrow drawn from the socket towards the first cell of the chosen edge. */
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
  const baseX = centre.x - facing.dx * size * 0.35;
  const baseY = centre.y - facing.dy * size * 0.35;
  path.moveTo(tipX, tipY);
  path.lineTo(baseX + px * size * 0.62, baseY + py * size * 0.62);
  path.lineTo(baseX + px * size * 0.24, baseY + py * size * 0.24);
  path.lineTo(baseX - px * size * 0.24, baseY - py * size * 0.24);
  path.lineTo(baseX - px * size * 0.62, baseY - py * size * 0.62);
  path.close();
  return path;
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

  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const nodes: React.ReactNode[] = [];

  if (showSockets) {
    for (const socket of level.signalSockets) {
      if (signal?.socketId === socket.id) {
        continue;
      }
      const c = socketCentre(viewport, socket);
      const hovered = hoveredSocketId === socket.id;
      // 8% expansion while available, per the design.
      const size = viewport.cell * 0.3 * (hovered ? 1.25 : 1 + 0.08 * pulse);
      const diamond = Skia.Path.Make();
      diamond.moveTo(c.x, c.y - size);
      diamond.lineTo(c.x + size, c.y);
      diamond.lineTo(c.x, c.y + size);
      diamond.lineTo(c.x - size, c.y);
      diamond.close();
      nodes.push(
        <Path
          key={`sock${socket.id}`}
          path={diamond}
          color={hovered ? palette.signal : palette.wall}
          opacity={hovered ? 1 : 0.55}
        />,
      );
    }
  }

  if (signal) {
    const socket = level.signalSockets.find(s => s.id === signal.socketId);
    const junction = level.graph.nodes.find(
      n => n.id === socket?.junctionId,
    );
    if (socket && junction) {
      const c = socketCentre(viewport, socket);
      const facing = facingFor(level, signal.edgeId, junction.cell);
      const size = viewport.cell * 0.42;
      nodes.push(
        <Group key="signal">
          <RoundedRect
            x={c.x - size * 0.75}
            y={c.y - size * 0.75}
            width={size * 1.5}
            height={size * 1.5}
            r={size * 0.24}
            color={palette.wall}
          />
          <Path path={arrowPath(c, facing, size * 0.62)} color={palette.signal} />
        </Group>,
      );
    }
  }

  if (dragPoint) {
    const size = viewport.cell * 0.42;
    nodes.push(
      <Group key="drag" opacity={0.9}>
        <RoundedRect
          x={dragPoint.x - size * 0.75}
          y={dragPoint.y - size * 0.75}
          width={size * 1.5}
          height={size * 1.5}
          r={size * 0.24}
          color={palette.wall}
        />
        <Path
          path={arrowPath(dragPoint, {dx: 0, dy: -1}, size * 0.62)}
          color={palette.signal}
        />
      </Group>,
    );
  }

  return <Group>{nodes}</Group>;
}

export const SignalLayer = React.memo(SignalLayerImpl);
export {socketCentre, facingFor};

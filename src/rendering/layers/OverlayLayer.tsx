/**
 * Explanatory overlays: the decision the analysis blames, people who failed
 * without moving, and the direction preview under a placed signal.
 *
 * These carry the argument the game is making — that the failure had a cause,
 * and the cause was a decision somewhere else. They are drawn above the route
 * trails and below the people.
 */

import React from 'react';
import {Circle, Group, Rect} from '@shopify/react-native-skia';

import {Vec2} from '../../game/types';
import {Viewport, cellCentre, cellOrigin} from '../geometry';
import {palette} from '../../theme';

interface Props {
  viewport: Viewport;
  /** The junction the level authors as responsible. */
  criticalCell: Vec2 | null;
  /** People who failed while stationary — a deadlock, or a shut door. */
  stallCells: Vec2[];
  /** First cells of the signalled edge. Never the whole route. */
  previewCells: Vec2[];
  phase: number;
}

function OverlayLayerImpl({
  viewport,
  criticalCell,
  stallCells,
  previewCells,
  phase,
}: Props) {
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);

  return (
    <Group>
      {/* Where the signal points. Three cells only: the player has to predict
          the consequence, not read it off the map. */}
      {previewCells.map((cell, i) => {
        const {x, y} = cellOrigin(viewport, cell);
        const inset = viewport.cell * 0.14;
        return (
          <Rect
            key={`pv${cell.x},${cell.y}`}
            x={x + inset}
            y={y + inset}
            width={viewport.cell - inset * 2}
            height={viewport.cell - inset * 2}
            color={palette.signal}
            style="stroke"
            strokeWidth={Math.max(1.5, viewport.cell * 0.07)}
            opacity={0.85 - i * 0.22}
          />
        );
      })}

      {/* A stationary failure has no trail worth drawing — one cell repeated
          eight times reads as nothing at all. */}
      {stallCells.map(cell => {
        const c = cellCentre(viewport, cell);
        return (
          <Group key={`st${cell.x},${cell.y}`}>
            <Circle
              cx={c.x}
              cy={c.y}
              r={viewport.cell * (0.42 + 0.16 * pulse)}
              color={palette.routeFailed}
              style="stroke"
              strokeWidth={Math.max(1.5, viewport.cell * 0.06)}
              opacity={0.75 - 0.35 * pulse}
            />
          </Group>
        );
      })}

      {criticalCell ? (
        <Group>
          <Circle
            cx={cellCentre(viewport, criticalCell).x}
            cy={cellCentre(viewport, criticalCell).y}
            r={viewport.cell * (0.5 + 0.25 * pulse)}
            color={palette.routeFailed}
            style="stroke"
            strokeWidth={Math.max(2, viewport.cell * 0.08)}
            opacity={0.9 - 0.45 * pulse}
          />
          <Circle
            cx={cellCentre(viewport, criticalCell).x}
            cy={cellCentre(viewport, criticalCell).y}
            r={viewport.cell * 0.14}
            color={palette.routeFailed}
            opacity={0.8}
          />
        </Group>
      ) : null}
    </Group>
  );
}

export const OverlayLayer = React.memo(OverlayLayerImpl);

/**
 * The analysis marks.
 *
 * These carry the argument the game is making — that the failure had a cause,
 * and the cause was a decision somewhere else. The reticle sits on the
 * decision; the cross sits on the consequence. Keeping them visually distinct
 * is the whole point: a player who only ever looks at the cross will keep
 * trying to fix the symptom.
 */

import React from 'react';
import {BlurMask, Circle, Group, Path, Skia} from '@shopify/react-native-skia';

import {Vec2} from '../../game/types';
import {Viewport, cellCentre} from '../geometry';
import {palette} from '../../theme';

interface Props {
  viewport: Viewport;
  /** The junction the level authors as responsible. */
  criticalCell: Vec2 | null;
  /** Where each person was lost. */
  lostCells: Vec2[];
  /** Of those, the ones who failed without moving. */
  stallCells: Vec2[];
  phase: number;
}

function Reticle({
  centre,
  cell,
  pulse,
}: {
  centre: {x: number; y: number};
  cell: number;
  pulse: number;
}) {
  const stroke = Math.max(1.5, cell * 0.07);
  const ticks = Skia.Path.Make();
  const inner = cell * 0.44;
  const outer = cell * 0.66;
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    ticks.moveTo(centre.x + dx * inner, centre.y + dy * inner);
    ticks.lineTo(centre.x + dx * outer, centre.y + dy * outer);
  }

  return (
    <Group>
      {/* An expanding ring, so the eye is pulled here before the cross. */}
      <Circle
        cx={centre.x}
        cy={centre.y}
        r={cell * (0.5 + 0.45 * pulse)}
        color={palette.danger}
        style="stroke"
        strokeWidth={stroke}
        opacity={0.75 * (1 - pulse)}
      />
      <Circle
        cx={centre.x}
        cy={centre.y}
        r={cell * 0.55}
        color={palette.danger}
        opacity={0.28}>
        <BlurMask blur={cell * 0.4} style="normal" />
      </Circle>
      <Circle
        cx={centre.x}
        cy={centre.y}
        r={cell * 0.44}
        color={palette.danger}
        style="stroke"
        strokeWidth={stroke}
      />
      <Circle
        cx={centre.x}
        cy={centre.y}
        r={cell * 0.2}
        color={palette.danger}
        style="stroke"
        strokeWidth={stroke * 0.8}
      />
      <Path
        path={ticks}
        color={palette.danger}
        style="stroke"
        strokeWidth={stroke * 0.8}
        strokeCap="round"
      />
    </Group>
  );
}

function LostMark({
  centre,
  cell,
}: {
  centre: {x: number; y: number};
  cell: number;
}) {
  const a = cell * 0.3;
  const cross = Skia.Path.Make();
  cross.moveTo(centre.x - a, centre.y - a);
  cross.lineTo(centre.x + a, centre.y + a);
  cross.moveTo(centre.x + a, centre.y - a);
  cross.lineTo(centre.x - a, centre.y + a);

  return (
    <Group>
      <Path
        path={cross}
        color={palette.danger}
        style="stroke"
        strokeWidth={Math.max(2, cell * 0.14)}
        strokeCap="round"
        opacity={0.5}>
        <BlurMask blur={cell * 0.25} style="normal" />
      </Path>
      <Path
        path={cross}
        color={palette.danger}
        style="stroke"
        strokeWidth={Math.max(1.5, cell * 0.1)}
        strokeCap="round"
      />
    </Group>
  );
}

function OverlayLayerImpl({
  viewport,
  criticalCell,
  lostCells,
  stallCells,
  phase,
}: Props) {
  const c = viewport.cell;
  const pulse = (phase % 1 + 1) % 1;

  return (
    <Group>
      {/* Someone who failed without moving has no trail worth drawing — one
          cell repeated reads as nothing at all. The ring says they stopped. */}
      {stallCells.map(cell => {
        const centre = cellCentre(viewport, cell);
        return (
          <Circle
            key={`st${cell.x},${cell.y}`}
            cx={centre.x}
            cy={centre.y}
            r={c * (0.45 + 0.3 * pulse)}
            color={palette.danger}
            style="stroke"
            strokeWidth={Math.max(1.2, c * 0.05)}
            opacity={0.6 * (1 - pulse)}
          />
        );
      })}

      {lostCells.map(cell => (
        <LostMark
          key={`lost${cell.x},${cell.y}`}
          centre={cellCentre(viewport, cell)}
          cell={c}
        />
      ))}

      {criticalCell ? (
        <Reticle
          centre={cellCentre(viewport, criticalCell)}
          cell={c}
          pulse={pulse}
        />
      ) : null}
    </Group>
  );
}

export const OverlayLayer = React.memo(OverlayLayerImpl);

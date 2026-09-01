/**
 * Smoke.
 *
 * Drawn as soft overlapping volumes rather than filled cells, so it reads as
 * something seeping through the building. The constraint that shapes this
 * layer: the tile boundary underneath has to stay countable. The difference
 * between three cells of smoke and four is the difference between a survivable
 * corridor and a lethal one, so the mass is translucent and a crisp inner
 * marker keeps each affected cell legible.
 */

import React from 'react';
import {BlurMask, Circle, Group, Rect} from '@shopify/react-native-skia';

import {CellKey} from '../../game/types';
import {Viewport, cellCentre} from '../geometry';
import {palette} from '../../theme';

interface Props {
  viewport: Viewport;
  smokeCells: CellKey[];
  /** Slow drift, 0..1. */
  phase: number;
}

function HazardLayerImpl({viewport, smokeCells, phase}: Props) {
  const c = viewport.cell;
  const cells = smokeCells.map(key => {
    const [x, y] = key.split(',').map(Number);
    return {key, x, y};
  });

  return (
    <Group>
      {/* The volume: large soft blobs, offset per cell by a fixed hash so
          neighbours never pulse in lockstep and nothing is random. */}
      {cells.map(({key, x, y}) => {
        const centre = cellCentre(viewport, {x, y});
        const hash = ((x * 7 + y * 13) % 8) / 8;
        const drift = Math.sin((phase + hash) * Math.PI * 2);
        return (
          <Group key={`sm${key}`}>
            <Circle
              cx={centre.x + drift * c * 0.16}
              cy={centre.y - drift * c * 0.1}
              r={c * (0.85 + 0.1 * hash)}
              color={palette.smoke}
              opacity={0.3}>
              <BlurMask blur={c * 0.7} style="normal" />
            </Circle>
            <Circle
              cx={centre.x - drift * c * 0.12}
              cy={centre.y + drift * c * 0.14}
              r={c * 0.6}
              color={palette.smoke}
              opacity={0.26}>
              <BlurMask blur={c * 0.45} style="normal" />
            </Circle>
          </Group>
        );
      })}

      {/* The reading: which exact cell is dangerous, and from when. */}
      {cells.map(({key, x, y}) => {
        const o = cellCentre(viewport, {x, y});
        return (
          <Rect
            key={`sc${key}`}
            x={o.x - c * 0.34}
            y={o.y - c * 0.34}
            width={c * 0.68}
            height={c * 0.68}
            color={palette.smoke}
            style="stroke"
            strokeWidth={Math.max(1, c * 0.05)}
            opacity={0.4}
          />
        );
      })}
    </Group>
  );
}

export const HazardLayer = React.memo(HazardLayerImpl);

/**
 * Smoke.
 *
 * Translucent blue-grey with a lighter inner plate, so the cell boundary stays
 * readable underneath. That readability is load-bearing, not decoration: the
 * difference between a three-cell and a four-cell smoke zone is the difference
 * between a survivable corridor and a lethal one, and the player has to be able
 * to count them.
 */

import React from 'react';
import {Group, Rect} from '@shopify/react-native-skia';

import {CellKey} from '../../game/types';
import {Viewport, cellOrigin} from '../geometry';
import {palette} from '../../theme';

interface Props {
  viewport: Viewport;
  smokeCells: CellKey[];
  /** Slow drift, 0..1, so the mass is not a flat stamp. */
  phase: number;
}

function HazardLayerImpl({viewport, smokeCells, phase}: Props) {
  const drift = Math.sin(phase * Math.PI * 2) * (viewport.cell * 0.04);

  return (
    <Group>
      {smokeCells.map(key => {
        const [cx, cy] = key.split(',').map(Number);
        const {x, y} = cellOrigin(viewport, {x: cx, y: cy});
        // Deterministic per-cell offset keeps neighbouring cells from
        // pulsing in lockstep without introducing randomness.
        const skew = ((cx * 7 + cy * 13) % 5) / 5;
        return (
          <Group key={`s${key}`}>
            <Rect
              x={x}
              y={y}
              width={viewport.cell}
              height={viewport.cell}
              color={palette.smoke}
              opacity={0.5}
            />
            <Rect
              x={x + viewport.cell * 0.15 + drift * skew}
              y={y + viewport.cell * 0.15 - drift * (1 - skew)}
              width={viewport.cell * 0.7}
              height={viewport.cell * 0.7}
              color={palette.smoke}
              opacity={0.35}
            />
          </Group>
        );
      })}
    </Group>
  );
}

export const HazardLayer = React.memo(HazardLayerImpl);

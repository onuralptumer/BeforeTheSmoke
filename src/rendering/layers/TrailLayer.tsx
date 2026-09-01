/**
 * Route history.
 *
 * Three readings, separated by weight and dash as well as hue so they survive
 * being drawn over smoke: what was observed (thin, dashed, pale), what ended
 * badly (heavier, dashed, red), and what got out (bright teal, continuous,
 * glowing). Corners are rounded because people take corners, and a hard
 * polyline reads as a diagram rather than a path someone walked.
 */

import React from 'react';
import {
  BlurMask,
  CornerPathEffect,
  DashPathEffect,
  Group,
  Path,
  Skia,
} from '@shopify/react-native-skia';

import {Vec2} from '../../game/types';
import {Viewport, cellCentre} from '../geometry';
import {palette} from '../../theme';

export type TrailVariant = 'observed' | 'failed' | 'rescued' | 'ghost';

export interface Trail {
  id: string;
  cells: Vec2[];
  variant: TrailVariant;
}

interface Props {
  viewport: Viewport;
  trails: Trail[];
}

function buildPath(viewport: Viewport, cells: Vec2[]) {
  const path = Skia.Path.Make();
  cells.forEach((cell, i) => {
    const {x, y} = cellCentre(viewport, cell);
    if (i === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  });
  return path;
}

const style: Record<
  TrailVariant,
  {color: string; width: number; opacity: number; dash: boolean; glow: boolean}
> = {
  observed: {
    color: palette.routeHistory,
    width: 0.07,
    opacity: 0.55,
    dash: true,
    glow: false,
  },
  failed: {
    color: palette.danger,
    width: 0.1,
    opacity: 0.95,
    dash: true,
    glow: true,
  },
  rescued: {
    color: palette.safe,
    width: 0.12,
    opacity: 0.95,
    dash: false,
    glow: true,
  },
  ghost: {
    color: palette.routeHistory,
    width: 0.05,
    opacity: 0.22,
    dash: true,
    glow: false,
  },
};

function TrailLayerImpl({viewport, trails}: Props) {
  const c = viewport.cell;

  return (
    <Group>
      {trails.map(trail => {
        if (trail.cells.length < 2) {
          return null;
        }
        const s = style[trail.variant];
        const path = buildPath(viewport, trail.cells);
        const width = Math.max(1.2, c * s.width);

        return (
          <Group key={`${trail.variant}-${trail.id}`}>
            {s.glow && (
              <Path
                path={path}
                style="stroke"
                strokeWidth={width * 2.6}
                strokeCap="round"
                strokeJoin="round"
                color={s.color}
                opacity={0.3}>
                <CornerPathEffect r={c * 0.4} />
                <BlurMask blur={c * 0.3} style="normal" />
              </Path>
            )}
            <Path
              path={path}
              style="stroke"
              strokeWidth={width}
              strokeCap="round"
              strokeJoin="round"
              color={s.color}
              opacity={s.opacity}>
              <CornerPathEffect r={c * 0.4} />
              {s.dash && <DashPathEffect intervals={[c * 0.3, c * 0.26]} phase={0} />}
            </Path>
          </Group>
        );
      })}
    </Group>
  );
}

export const TrailLayer = React.memo(TrailLayerImpl);

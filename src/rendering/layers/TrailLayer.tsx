/**
 * Route history.
 *
 * Slate indigo for what happened before, dusty coral for the route that ended
 * badly. Trails are drawn under people and over smoke, and are differentiated
 * by weight as well as hue — the analysis view draws them directly on top of
 * the smoke mass, so colour alone would not separate them.
 */

import React from 'react';
import {Group, Path, Skia} from '@shopify/react-native-skia';

import {Vec2} from '../../game/types';
import {Viewport, cellCentre} from '../geometry';
import {palette} from '../../theme';

interface Trail {
  id: string;
  cells: Vec2[];
  failed: boolean;
}

interface Props {
  viewport: Viewport;
  trails: Trail[];
  /** Ghosts of the previous attempt, drawn fainter and thinner. */
  ghost?: boolean;
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

function TrailLayerImpl({viewport, trails, ghost = false}: Props) {
  return (
    <Group>
      {trails.map(trail => {
        if (trail.cells.length < 2) {
          return null;
        }
        return (
          <Path
            key={`${ghost ? 'g' : 't'}${trail.id}`}
            path={buildPath(viewport, trail.cells)}
            style="stroke"
            strokeWidth={
              ghost ? viewport.cell * 0.08 : viewport.cell * (trail.failed ? 0.16 : 0.11)
            }
            strokeCap="round"
            strokeJoin="round"
            color={trail.failed ? palette.routeFailed : palette.routeHistory}
            opacity={ghost ? 0.3 : trail.failed ? 0.9 : 0.4}
          />
        );
      })}
    </Group>
  );
}

export const TrailLayer = React.memo(TrailLayerImpl);
export type {Trail};

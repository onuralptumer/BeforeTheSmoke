/**
 * Smoke.
 *
 * The hard problem here is that the hazard is defined on a grid but must not
 * look like one. Three earlier attempts failed in three different ways:
 * translucent blurred circles were so faint they read as a smudge, a solid
 * per-cell fill was legible but looked like grey tiles, and a blurred union of
 * lobes read as one soft blob — better, but still a shape with no structure.
 *
 * What this draws instead is closer to how smoke is actually rendered: a
 * coarse mass, then noise. Each cell contributes three overlapping opaque
 * lobes; the whole set goes into one offscreen layer which is blurred,
 * thresholded into a single continuous silhouette, and then **displaced by
 * fractal noise**. The displacement is what does the real work — it pulls the
 * smooth boundary into tendrils and wisps, so the edge looks torn rather than
 * drawn, and no two parts of it look alike. A short blur afterwards takes the
 * hardness off the displaced edge.
 *
 * The displacement scale is deliberately bounded to well under a cell. Smoke is
 * mechanical here — four ticks in it incapacitates somebody — so the mass must
 * stay where the simulation says it is. Noise may make the boundary ragged; it
 * may not move the smoke onto a cell that is not in `frame.smokeCells`.
 *
 * Everything is derived from a fixed seed and a per-cell hash. Nothing is
 * random, so two replays of the same run draw identically.
 */

import React, {useMemo} from 'react';
import {
  Blur,
  Circle,
  ColorMatrix,
  DisplacementMap,
  FractalNoise,
  Group,
  Paint,
  Turbulence,
} from '@shopify/react-native-skia';

import {CellKey} from '../../game/types';
import {Viewport, cellCentre} from '../geometry';
import {palette} from '../../theme';

interface Props {
  viewport: Viewport;
  smokeCells: CellKey[];
  /** Slow drift, 0..1. */
  phase: number;
}

/**
 * Three lobes per cell, as fractions of a cell: offset x, offset y, radius.
 * Deliberately off-centre and unequal, so one cell of smoke is already an
 * irregular shape and a run of cells never repeats.
 */
const LOBES: Array<[number, number, number]> = [
  [0, 0, 0.6],
  [-0.28, -0.2, 0.46],
  [0.26, 0.18, 0.5],
];

function HazardLayerImpl({viewport, smokeCells, phase}: Props) {
  const c = viewport.cell;

  // `phase` changes on the animation clock but the smoke set only changes on a
  // tick, so parsing the keys is memoised against the cells rather than the
  // clock. Without this the whole set is re-split on every frame of playback.
  const cells = useMemo(
    () =>
      smokeCells.map(key => {
        const [x, y] = key.split(',').map(Number);
        // A fixed per-cell offset, so neighbours never drift in lockstep and
        // nothing is random.
        return {key, x, y, hash: ((x * 7 + y * 13) % 8) / 8};
      }),
    [smokeCells],
  );

  if (cells.length === 0) {
    return null;
  }

  return (
    <Group>
      <Group
        layer={
          <Paint>
            {/* Merge the lobes, then pull the merged interior back up to
                something dense. Multiplying alpha by 7 and subtracting 2.4
                keeps the outer part of the falloff and discards the rest, so
                the result is a cloud with a soft edge rather than a haze. */}
            <Blur blur={c * 0.3} />
            <ColorMatrix
              // prettier-ignore
              matrix={[
                1, 0, 0, 0, 0,
                0, 1, 0, 0, 0,
                0, 0, 1, 0, 0,
                0, 0, 0, 7, -2.4,
              ]}
            />
            {/* Tear the boundary. Low frequency with several octaves gives
                large tendrils carrying finer detail, which is what separates
                smoke from a blob. Scale stays under half a cell so the mass
                cannot wander off the cells the simulation actually holds. */}
            <DisplacementMap channelX="r" channelY="g" scale={c * 0.42}>
              <FractalNoise
                freqX={0.9 / c}
                freqY={0.9 / c}
                octaves={4}
                seed={7}
              />
            </DisplacementMap>
            <Blur blur={c * 0.09} />
          </Paint>
        }
        opacity={0.78}>
        {cells.map(({key, x, y, hash}) => {
          const centre = cellCentre(viewport, {x, y});
          const drift = Math.sin((phase + hash) * Math.PI * 2);
          const swirl = Math.cos((phase + hash) * Math.PI * 2);
          return (
            <Group key={`sm${key}`}>
              {LOBES.map(([ox, oy, r], i) => (
                <Circle
                  key={`l${i}`}
                  cx={centre.x + (ox + drift * 0.07 * (i + 1)) * c}
                  cy={centre.y + (oy + swirl * 0.06 * (i + 1)) * c}
                  // The hash varies lobe size per cell, so no two cells of
                  // smoke are the same shape.
                  r={c * r * (0.9 + 0.2 * hash)}
                  color={palette.smoke}
                />
              ))}
            </Group>
          );
        })}
      </Group>

      {/* Internal structure. The threshold above flattens the mass to one even
          tone, which is what makes a cloud look like paint — real smoke is
          lumpy inside, not only at its edge.

          A turbulence shader supplies the fine detail, clipped to soft blobs on
          the cells so it can only appear inside the mass. Under it sits a dark
          core per cell, which doubles as the countability marker: three cells
          of smoke against four decides whether a corridor is survivable, so the
          cells must stay countable — as denser patches within the cloud, never
          as a drawn grid. */}
      <Group layer={<Paint><Blur blur={c * 0.2} /></Paint>} opacity={0.5}>
        {cells.map(({key, x, y, hash}) => {
          const centre = cellCentre(viewport, {x, y});
          const drift = Math.sin((phase + hash) * Math.PI * 2);
          return (
            <Circle
              key={`d${key}`}
              cx={centre.x + drift * c * 0.08}
              cy={centre.y - drift * c * 0.06}
              r={c * (0.3 + 0.08 * hash)}
              color={palette.wall}
              opacity={0.34}
            />
          );
        })}
      </Group>

      {/* Turbulence is an RGBA noise shader, so raw it speckles the cloud with
          red and green. This layer takes it to luminance and darkens it, which
          leaves grey soot rather than confetti — and grey is the only thing
          allowed here anyway, since teal, amber and red all carry meaning. */}
      <Group
        layer={
          <Paint>
            <ColorMatrix
              // prettier-ignore
              matrix={[
                0.13, 0.43, 0.04, 0, 0,
                0.13, 0.43, 0.04, 0, 0,
                0.13, 0.43, 0.04, 0, 0,
                0,    0,    0,    1, 0,
              ]}
            />
            <Blur blur={c * 0.05} />
          </Paint>
        }
        opacity={0.3}>
        {cells.map(({key, x, y, hash}) => {
          const centre = cellCentre(viewport, {x, y});
          return (
            <Circle
              key={`t${key}`}
              cx={centre.x}
              cy={centre.y}
              r={c * (0.5 + 0.1 * hash)}>
              <Turbulence
                freqX={3.5 / c}
                freqY={3.5 / c}
                octaves={3}
                seed={3}
              />
            </Circle>
          );
        })}
      </Group>
    </Group>
  );
}

export const HazardLayer = React.memo(HazardLayerImpl);

/**
 * The map. One Skia canvas, five layers, no nested React components per
 * person — the whole scene is one draw tree that reads a frame snapshot.
 */

import React, {useMemo} from 'react';
import {StyleSheet} from 'react-native';
import {Canvas, Rect} from '@shopify/react-native-skia';

import {
  LevelDefinition,
  SignalPlacement,
  Vec2,
} from '../game/types';
import {WorldMap} from '../game/engine/world';
import {RecordedRun} from '../game/replay/record';
import {Viewport, lerpCentre} from './geometry';
import {FloorLayer} from './layers/FloorLayer';
import {HazardLayer} from './layers/HazardLayer';
import {OverlayLayer} from './layers/OverlayLayer';
import {PeopleLayer, PersonView} from './layers/PeopleLayer';
import {SignalLayer} from './layers/SignalLayer';
import {Trail, TrailLayer} from './layers/TrailLayer';
import {palette} from '../theme';

interface Props {
  level: LevelDefinition;
  map: WorldMap;
  run: RecordedRun;
  viewport: Viewport;
  tickIndex: number;
  alpha: number;
  showSockets: boolean;
  signal: SignalPlacement | null;
  dragPoint: {x: number; y: number} | null;
  hoveredSocketId: string | null;
  /** Trails from the baseline attempt, drawn as ghosts. */
  ghostRun?: RecordedRun | null;
  /** Show finished route trails — analysis and result only. */
  showTrails: boolean;
  /** Drop the environment back slightly so the analysis reads over it. */
  dim: boolean;
  criticalCell: Vec2 | null;
  stallCells: Vec2[];
  previewCells: Vec2[];
  phase: number;
}

export function GameCanvas({
  level,
  map,
  run,
  viewport,
  tickIndex,
  alpha,
  showSockets,
  signal,
  dragPoint,
  hoveredSocketId,
  ghostRun,
  showTrails,
  dim,
  criticalCell,
  stallCells,
  previewCells,
  phase,
}: Props) {
  const frame = run.frames[Math.min(tickIndex, run.frames.length - 1)];
  const previous = run.frames[Math.max(0, Math.min(tickIndex, run.frames.length - 1) - 1)];

  const people: PersonView[] = useMemo(() => {
    const prevById = new Map(previous.agents.map(a => [a.id, a]));
    return frame.agents.map(agent => {
      const prev = prevById.get(agent.id);
      const from = prev?.cell ?? null;
      const to = agent.cell;
      const pos = lerpCentre(viewport, from, to, alpha);

      let facing = {dx: 0, dy: -1};
      if (from && to && (from.x !== to.x || from.y !== to.y)) {
        facing = {dx: Math.sign(to.x - from.x), dy: Math.sign(to.y - from.y)};
      }

      return {
        id: agent.id,
        type: agent.type,
        state: agent.state,
        pos,
        facing,
        exposure: agent.exposure,
      };
    });
  }, [frame, previous, viewport, alpha]);

  const trails: Trail[] = useMemo(() => {
    if (!showTrails) {
      return [];
    }
    const lost = new Set(run.result.failedAgentIds);
    return [...run.trails.entries()].map(([id, cells]) => ({
      id,
      cells: cells as Vec2[],
      failed: lost.has(id),
    }));
  }, [run, showTrails]);

  const ghostTrails: Trail[] = useMemo(() => {
    if (!ghostRun || !showTrails) {
      return [];
    }
    return [...ghostRun.trails.entries()].map(([id, cells]) => ({
      id: `ghost-${id}`,
      cells: cells as Vec2[],
      failed: false,
    }));
  }, [ghostRun, showTrails]);

  return (
    <Canvas style={styles.canvas}>
      <FloorLayer
        level={level}
        map={map}
        viewport={viewport}
        closedDoors={frame.closedDoorCells}
      />
      <HazardLayer
        viewport={viewport}
        smokeCells={frame.smokeCells}
        phase={phase}
      />
      {/* The wash sits above the environment and below everything that
          explains it, so trails and the signal stay at full strength. */}
      {dim && (
        <Rect
          x={viewport.originX}
          y={viewport.originY}
          width={viewport.width}
          height={viewport.height}
          color={palette.background}
          opacity={0.2}
        />
      )}
      {ghostTrails.length > 0 && (
        <TrailLayer viewport={viewport} trails={ghostTrails} ghost />
      )}
      {trails.length > 0 && <TrailLayer viewport={viewport} trails={trails} />}
      <OverlayLayer
        viewport={viewport}
        criticalCell={criticalCell}
        stallCells={stallCells}
        previewCells={previewCells}
        phase={phase}
      />
      <SignalLayer
        level={level}
        viewport={viewport}
        showSockets={showSockets}
        signal={signal}
        dragPoint={dragPoint}
        hoveredSocketId={hoveredSocketId}
        phase={phase}
      />
      <PeopleLayer viewport={viewport} people={people} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {flex: 1, backgroundColor: palette.background},
});

/**
 * The map. One Skia canvas, six layers, no nested React component per person —
 * the whole scene is a single draw tree reading one frame snapshot.
 */

import React, {useMemo} from 'react';
import {StyleSheet} from 'react-native';
import {Canvas, Rect} from '@shopify/react-native-skia';

import {LevelDefinition, SignalPlacement, Vec2} from '../game/types';
import {WorldMap} from '../game/engine/world';
import {RecordedRun} from '../game/replay/record';
import {Viewport, lerpCentre} from './geometry';
import {FloorLayer} from './layers/FloorLayer';
import {HazardLayer} from './layers/HazardLayer';
import {PlanFurnitureLayer} from './layers/PlanFurnitureLayer';
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
  signals: SignalPlacement[];
  dragPoint: {x: number; y: number} | null;
  hoveredSocketId: string | null;
  /** Trails from the baseline attempt, drawn as ghosts. */
  ghostRun?: RecordedRun | null;
  /** Finished route trails — analysis and result only. */
  showTrails: boolean;
  /** Drop the building back so the analysis marks read over it. */
  dim: boolean;
  criticalCell: Vec2 | null;
  phase: number;
  /** The full canvas, for placing the drawing furniture in the margins. */
  canvasWidth: number;
  canvasHeight: number;
  sheetCount: number;
}

export function GameCanvas({
  level,
  map,
  run,
  viewport,
  tickIndex,
  alpha,
  showSockets,
  signals,
  dragPoint,
  hoveredSocketId,
  ghostRun,
  showTrails,
  dim,
  criticalCell,
  phase,
  canvasWidth,
  canvasHeight,
  sheetCount,
}: Props) {
  // Smoke renders through two offscreen layers with blurs, which is the most
  // expensive thing on this canvas, and its drift is a slow 1.6 s loop. So it
  // gets a coarser clock than everything else: quantising the phase means the
  // memoised layer re-renders about 24 times a second instead of 60, and the
  // two-pixel difference in drift is not visible.
  const smokePhase = Math.round(phase * 24) / 24;

  const index = Math.min(tickIndex, run.frames.length - 1);
  const frame = run.frames[index];
  const previous = run.frames[Math.max(0, index - 1)];

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
      variant: lost.has(id)
        ? ('failed' as const)
        : run.result.success
        ? ('rescued' as const)
        : ('observed' as const),
    }));
  }, [run, showTrails]);

  const ghostTrails: Trail[] = useMemo(() => {
    if (!ghostRun || !showTrails) {
      return [];
    }
    return [...ghostRun.trails.entries()].map(([id, cells]) => ({
      id: `ghost-${id}`,
      cells: cells as Vec2[],
      variant: 'ghost' as const,
    }));
  }, [ghostRun, showTrails]);

  // Paired with the agent id, not reduced to a bare cell: two people can end
  // the run on the same cell, and keying a mark by position then collides.
  const lostMarks = useMemo(() => {
    if (!showTrails) {
      return [];
    }
    return run.result.failedAgentIds
      .map(id => {
        const cell = frame.agents.find(a => a.id === id)?.cell ?? null;
        return cell ? {id, cell} : null;
      })
      .filter((m): m is {id: string; cell: Vec2} => m !== null);
  }, [showTrails, run, frame]);

  // Deduplicated by cell. A stall ring describes a *place* where movement
  // stopped, not a person, so two people stalled on one cell want one ring —
  // and drawing two would collide on the cell-derived key.
  const stallCells: Vec2[] = useMemo(() => {
    if (!showTrails) {
      return [];
    }
    const seen = new Set<string>();
    return run.stalls.filter(cell => {
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [showTrails, run]);

  return (
    <Canvas style={styles.canvas}>
      <FloorLayer
        level={level}
        map={map}
        viewport={viewport}
        closedDoors={frame.closedDoorCells}
      />
      {/* The drawing furniture is part of the printed plan, so it sits on the
          floor and under the hazard — smoke rolls over the room labels. */}
      <PlanFurnitureLayer
        level={level}
        viewport={viewport}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        sheetCount={sheetCount}
      />
      {/* Smoke sits *under* the analysis wash, with the building.
          Counter-intuitively this is what keeps it readable: the wash darkens
          toward the shell colour, so dimming the floor and the smoke together
          preserves the gap between them, whereas dimming only the floor drags
          it down toward the un-dimmed mid-grey of the smoke and closes it.
          Measured on level 6: smoke-under-wash 2.3:1, smoke-over-wash 1.5:1. */}
      <HazardLayer
        viewport={viewport}
        smokeCells={frame.smokeCells}
        phase={smokePhase}
      />

      {/* The wash sits above the building and below everything that explains
          it, so trails, marks and the signal stay at full strength. */}
      {dim && (
        <Rect
          x={viewport.frameX}
          y={viewport.frameY}
          width={viewport.width}
          height={viewport.height}
          color={palette.shell}
          opacity={0.3}
        />
      )}
      <TrailLayer viewport={viewport} trails={[...ghostTrails, ...trails]} />
      <OverlayLayer
        viewport={viewport}
        criticalCell={criticalCell}
        lostMarks={lostMarks}
        stallCells={stallCells}
        phase={phase}
      />
      <SignalLayer
        level={level}
        viewport={viewport}
        showSockets={showSockets}
        signals={signals}
        dragPoint={dragPoint}
        hoveredSocketId={hoveredSocketId}
        phase={phase}
      />
      <PeopleLayer viewport={viewport} people={people} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {flex: 1, backgroundColor: palette.shell},
});

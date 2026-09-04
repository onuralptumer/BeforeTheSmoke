/**
 * The drawing, as opposed to the game.
 *
 * The fiction is a floor plan, but the screen had none of the vocabulary of an
 * actual drawing: no grid reference, no north arrow, no title block. All of
 * that is typography rather than art, and it is what makes ten structurally
 * similar office plans feel like ten documents out of a real archive.
 *
 * Two rules govern everything here.
 *
 * It must never compete. Every element is drawn below `textMuted` in value, so
 * teal, amber and red stay the only things on screen that carry meaning. The
 * document furniture should look like it was printed before the incident
 * started.
 *
 * It must never collide. The plan is fitted to the content bounds and centred,
 * so how much margin exists around it depends on the level's aspect ratio —
 * a wide level leaves almost no horizontal room. Each element measures the
 * space it needs and draws nothing if it does not fit, rather than overlapping
 * the building.
 *
 * There is deliberately no scale bar. One would have to state a distance, and
 * the simulation's cell size is not calibrated to metres — a person crosses a
 * cell per tick, which at the clock this game shows would be a sprint. A grid
 * reference is honest about being a grid; a scale bar would be a fabrication.
 */

import React, {useMemo} from 'react';
import {Group, Path, Skia, Text, matchFont} from '@shopify/react-native-skia';

import {LevelDefinition} from '../../game/types';
import {Viewport, cellCentre, cellOrigin} from '../geometry';
import {palette} from '../../theme';

interface Props {
  level: LevelDefinition;
  viewport: Viewport;
  /**
   * The full canvas, which is larger than the fitted plan. Only the height is
   * read today — the title block needs a clear band beneath the building — but
   * both are in the memo comparator, because a width change re-fits the
   * viewport and so moves everything here.
   */
  canvasWidth?: number;
  canvasHeight: number;
  /** Total levels, for the title block's sheet count. */
  sheetCount: number;
}

/**
 * Two inks, because the furniture lives on two grounds.
 *
 * The grid reference, north arrow and title block sit on the dark shell
 * *outside* the building, so they are drawn in a light ink. Room labels are
 * printed *on* the floor plate, which is the one large light area in the game —
 * the same light ink would disappear on it. They get a dark ink instead, so
 * both read as the same weight of quiet.
 */
const INK = palette.textMuted;
const INK_OPACITY = 0.38;
const RULE_OPACITY = 0.22;

/** Printed on the floor plate. */
const ROOM_INK = palette.wall;
const ROOM_OPACITY = 0.5;

/** Space a grid reference needs outside the plan before it is worth drawing. */
const GUTTER = 16;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function PlanFurnitureLayerImpl({
  level,
  viewport,
  canvasHeight,
  sheetCount,
}: Props) {
  const v = viewport;

  // `fitViewportToContent` folds the content bounds into the origin, so the
  // first drawn column and row are recoverable from the offset between the
  // origin and the visible frame rather than being passed in again.
  const minX = Math.round((v.frameX - v.originX) / v.cell);
  const minY = Math.round((v.frameY - v.originY) / v.cell);
  const cols = Math.round(v.width / v.cell);
  const rows = Math.round(v.height / v.cell);

  const small = useMemo(() => {
    try {
      return matchFont({fontSize: 9, fontWeight: '600'});
    } catch {
      return null;
    }
  }, []);

  const label = useMemo(() => {
    try {
      return matchFont({fontSize: 10, fontWeight: '700'});
    } catch {
      return null;
    }
  }, []);

  const north = useMemo(() => {
    const p = Skia.Path.Make();
    // A slim north dart: tip up, notched tail, matching the signal arrow's
    // language without borrowing its colour.
    p.moveTo(0, -11);
    p.lineTo(5, 6);
    p.lineTo(0, 2);
    p.lineTo(-5, 6);
    p.close();
    return p;
  }, []);

  if (!small || !label) {
    return null;
  }

  const roomLabels = level.rooms ?? [];

  // Only claim the gutters if the fitted plan actually left any.
  const showColumnRefs = v.frameY >= GUTTER;
  const showRowRefs = v.frameX >= GUTTER;

  // The title block sits under the plan, right-aligned, and only when there is
  // a clear band of canvas beneath it.
  const blockTop = v.frameY + v.height + 18;
  const showTitleBlock = blockTop + 26 <= canvasHeight;

  const sheet = level.id.replace(/^level-/, '');

  return (
    <>
      {/* Room labels, in tiny caps, printed on the floor plate. Optional level
          data: a level that names no rooms simply has none. */}
      <Group opacity={ROOM_OPACITY}>
        {roomLabels.map((room, i) => {
          const o = cellOrigin(v, room.cell);
          return (
            <Text
              key={`room${i}`}
              // Inset from the cell edge, so a label never starts flush against
              // the wall line it sits beside.
              x={o.x + v.cell * 0.14}
              y={o.y + v.cell * 0.62}
              text={room.label.toUpperCase()}
              font={label}
              color={ROOM_INK}
            />
          );
        })}
      </Group>

      <Group opacity={INK_OPACITY}>
      {/* Column reference along the top edge. */}
      {showColumnRefs &&
        Array.from({length: cols}, (_, i) => {
          const letter = LETTERS[(minX + i) % LETTERS.length];
          const centre = cellCentre(v, {x: minX + i, y: minY});
          return (
            <Text
              key={`c${i}`}
              x={centre.x - 3}
              y={v.frameY - 6}
              text={letter}
              font={small}
              color={INK}
            />
          );
        })}

      {/* Row reference down the left edge. */}
      {showRowRefs &&
        Array.from({length: rows}, (_, i) => {
          const n = String(minY + i + 1);
          const centre = cellCentre(v, {x: minX, y: minY + i});
          return (
            <Text
              key={`r${i}`}
              x={v.frameX - 6 - n.length * 5}
              y={centre.y + 3}
              text={n}
              font={small}
              color={INK}
            />
          );
        })}

      {/* North arrow, bottom-left of the plan. */}
      {showTitleBlock && (
        <Group
          transform={[
            {translateX: v.frameX + 10},
            {translateY: blockTop + 10},
          ]}>
          <Path path={north} color={INK} style="stroke" strokeWidth={1} />
          <Text x={9} y={2} text="N" font={small} color={INK} />
        </Group>
      )}

      {/* Title block. Right-aligned, two lines, no box — a rule is enough. */}
      {showTitleBlock && (
        <Group>
          <Path
            path={(() => {
              const p = Skia.Path.Make();
              p.moveTo(v.frameX + v.width - 150, blockTop - 6);
              p.lineTo(v.frameX + v.width, blockTop - 6);
              return p;
            })()}
            color={INK}
            style="stroke"
            strokeWidth={1}
            opacity={RULE_OPACITY}
          />
          <Text
            x={v.frameX + v.width - 150}
            y={blockTop + 6}
            text="BEFORE THE SMOKE"
            font={label}
            color={INK}
          />
          <Text
            x={v.frameX + v.width - 150}
            y={blockTop + 19}
            text={`SHEET ${sheet} OF ${sheetCount} · REV A`}
            font={small}
            color={INK}
          />
        </Group>
      )}
      </Group>
    </>
  );
}

export const PlanFurnitureLayer = React.memo(
  PlanFurnitureLayerImpl,
  (a, b) =>
    a.level.id === b.level.id &&
    a.viewport.cell === b.viewport.cell &&
    a.viewport.frameX === b.viewport.frameX &&
    a.viewport.frameY === b.viewport.frameY &&
    a.canvasWidth === b.canvasWidth &&
    a.canvasHeight === b.canvasHeight &&
    a.sheetCount === b.sheetCount,
);

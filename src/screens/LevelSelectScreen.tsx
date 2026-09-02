/**
 * The Incident Archive.
 *
 * No padlocks. A future incident is a muted archive entry with its
 * prerequisite stated, which keeps the tone professional and preserves
 * curiosity about the floor plan it is hiding.
 */

import React, {useMemo} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Canvas, Group, Path, Rect, Skia} from '@shopify/react-native-skia';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {LevelDefinition} from '../game/types';
import {WorldMap} from '../game/engine/world';
import {LEVELS} from '../game/levels';
import {LevelProgress, ProgressMap} from '../storage/progress';
import {contentBounds} from '../rendering/geometry';
import {palette, radius, space, tracking, type} from '../theme';

const THUMB_W = 84;
const THUMB_H = 108;

interface Props {
  progress: ProgressMap;
  onSelect: (level: LevelDefinition) => void;
}

export function LevelSelectScreen({progress, onSelect}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>INCIDENT ARCHIVE</Text>
        <Text style={styles.blurb}>
          Ten incidents. One signal each. Watch what went wrong, then change it.
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.list,
          {paddingBottom: insets.bottom + 24},
        ]}>
        {LEVELS.map((level, index) => (
          <IncidentCard
            key={level.id}
            level={level}
            index={index}
            progress={progress[level.id]}
            previousTitle={LEVELS[index - 1]?.title}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function IncidentCard({
  level,
  index,
  progress,
  previousTitle,
  onSelect,
}: {
  level: LevelDefinition;
  index: number;
  progress: LevelProgress | undefined;
  previousTitle: string | undefined;
  onSelect: (level: LevelDefinition) => void;
}) {
  const unlocked = progress?.unlocked ?? index === 0;
  const completed = progress?.completed ?? false;

  return (
    <TouchableOpacity
      activeOpacity={unlocked ? 0.75 : 1}
      accessibilityRole="button"
      accessibilityState={{disabled: !unlocked}}
      onPress={unlocked ? () => onSelect(level) : undefined}
      style={[styles.card, !unlocked && styles.cardLocked]}>
      <LevelThumb level={level} dimmed={!unlocked} />
      <View style={styles.cardBody}>
        <Text style={styles.cardIndex}>
          INCIDENT {String(index + 1).padStart(2, '0')}
        </Text>
        <Text style={styles.cardTitle}>{level.title}</Text>
        <Text style={styles.cardTeaches} numberOfLines={2}>
          {unlocked
            ? level.teaches
            : `Filed after ${previousTitle ?? 'the previous incident'} is resolved.`}
        </Text>
        {unlocked && progress ? (
          <View style={styles.markRow}>
            <MarkChip label="RESCUE" earned={progress.marks.rescue} />
            <MarkChip label="FLOW" earned={progress.marks.flow} />
            <MarkChip label="SWIFT" earned={progress.marks.swift} />
          </View>
        ) : null}
      </View>
      {completed ? (
        <View style={styles.stamp}>
          <Text style={styles.stampText}>RESOLVED</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** A compact plan, drawn from the same derived grid the game renders. */
const LevelThumb = React.memo(function LevelThumbImpl({
  level,
  dimmed,
}: {
  level: LevelDefinition;
  dimmed: boolean;
}) {
  const map = useMemo(() => new WorldMap(level), [level]);

  // Same framing as the game screen: show the plan, not the empty grid it was
  // authored on.
  const {floor, wall, exits, cell} = useMemo(() => {
    const walkable = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < level.width &&
      y < level.height &&
      map.tiles[y][x] !== 'WALL';

    const b = contentBounds(
      (x, y) => map.tiles[y][x] === 'WALL',
      level.width,
      level.height,
    );
    const cols = b.maxX - b.minX + 1;
    const rows = b.maxY - b.minY + 1;
    const size = Math.min(THUMB_W / cols, THUMB_H / rows);
    const offsetX = (THUMB_W - size * cols) / 2 - b.minX * size;
    const offsetY = (THUMB_H - size * rows) / 2 - b.minY * size;

    const px = (x: number) => offsetX + x * size;
    const py = (y: number) => offsetY + y * size;

    const floorPath = Skia.Path.Make();
    const wallPath = Skia.Path.Make();

    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (!walkable(x, y)) {
          continue;
        }
        floorPath.addRect({
          x: px(x) - 0.3,
          y: py(y) - 0.3,
          width: size + 0.6,
          height: size + 0.6,
        });
        if (!walkable(x, y - 1)) {
          wallPath.moveTo(px(x), py(y));
          wallPath.lineTo(px(x) + size, py(y));
        }
        if (!walkable(x, y + 1)) {
          wallPath.moveTo(px(x), py(y) + size);
          wallPath.lineTo(px(x) + size, py(y) + size);
        }
        if (!walkable(x - 1, y)) {
          wallPath.moveTo(px(x), py(y));
          wallPath.lineTo(px(x), py(y) + size);
        }
        if (!walkable(x + 1, y)) {
          wallPath.moveTo(px(x) + size, py(y));
          wallPath.lineTo(px(x) + size, py(y) + size);
        }
      }
    }

    return {
      floor: floorPath,
      wall: wallPath,
      exits: level.graph.nodes
        .filter(n => n.kind === 'EXIT')
        .map(n => ({id: n.id, x: px(n.cell.x), y: py(n.cell.y)})),
      cell: size,
    };
  }, [level, map]);

  return (
    <Canvas style={styles.thumb}>
      <Rect x={0} y={0} width={THUMB_W} height={THUMB_H} color={palette.ground} />
      <Group opacity={dimmed ? 0.4 : 1}>
        <Path path={floor} color={palette.floor} />
        <Path path={wall} color={palette.wall} style="stroke" strokeWidth={1.6} />
        <Path
          path={wall}
          color={palette.wallInner}
          style="stroke"
          strokeWidth={0.6}
          opacity={0.9}
        />
        {exits.map(exit => (
          <Rect
            key={exit.id}
            x={exit.x}
            y={exit.y}
            width={cell}
            height={cell}
            color={palette.safe}
          />
        ))}
      </Group>
    </Canvas>
  );
});

function MarkChip({label, earned}: {label: string; earned: boolean}) {
  return (
    <View style={[styles.chip, earned && styles.chipEarned]}>
      <Text style={[styles.chipText, earned && styles.chipTextEarned]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.shell},
  thumb: {width: THUMB_W, height: THUMB_H, borderRadius: radius.md},
  header: {paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl, gap: space.sm},
  kicker: {
    color: palette.text,
    fontSize: type.body,
    fontWeight: '800',
    letterSpacing: tracking.capsWide,
  },
  blurb: {color: palette.textMuted, fontSize: type.body, lineHeight: 20},
  list: {paddingHorizontal: space.lg, gap: space.md},
  card: {
    flexDirection: 'row',
    gap: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.panelEdge,
    backgroundColor: palette.panel,
  },
  cardLocked: {opacity: 0.5},
  cardBody: {flex: 1, gap: space.xs},
  cardIndex: {
    color: palette.textMuted,
    fontSize: type.micro,
    fontWeight: '800',
    letterSpacing: tracking.caps,
  },
  cardTitle: {color: palette.text, fontSize: type.display, fontWeight: '700'},
  cardTeaches: {color: palette.textMuted, fontSize: type.body, lineHeight: 18},
  markRow: {flexDirection: 'row', gap: space.sm, marginTop: 8},
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.panelEdge,
  },
  chipEarned: {backgroundColor: palette.safeDeep, borderColor: palette.safe},
  chipText: {
    color: palette.textMuted,
    fontSize: type.micro,
    fontWeight: '800',
    letterSpacing: tracking.caps,
  },
  chipTextEarned: {color: palette.safe},
  stamp: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1.5,
    borderColor: palette.safe,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    transform: [{rotate: '-8deg'}],
  },
  stampText: {
    color: palette.safe,
    fontSize: type.micro,
    fontWeight: '800',
    letterSpacing: tracking.caps,
  },
});

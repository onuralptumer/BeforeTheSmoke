/**
 * The Incident Archive.
 *
 * No padlocks. A future incident is a muted archive entry with its
 * prerequisite stated, which keeps the tone professional and preserves
 * curiosity about what the floor plan is hiding.
 */

import React, {useMemo} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Canvas, Rect} from '@shopify/react-native-skia';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {LevelDefinition} from '../game/types';
import {WorldMap} from '../game/engine/world';
import {LEVELS} from '../game/levels';
import {LevelProgress, ProgressMap} from '../storage/progress';
import {palette} from '../theme';

const THUMB_W = 78;

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
      activeOpacity={unlocked ? 0.7 : 1}
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
            <MarkChip label="Rescue" earned={progress.marks.rescue} />
            <MarkChip label="Flow" earned={progress.marks.flow} />
            <MarkChip label="Swift" earned={progress.marks.swift} />
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

/** A compact floor plan, drawn from the same derived grid the game uses. */
const LevelThumb = React.memo(function LevelThumbImpl({
  level,
  dimmed,
}: {
  level: LevelDefinition;
  dimmed: boolean;
}) {
  const map = useMemo(() => new WorldMap(level), [level]);
  const cell = THUMB_W / level.width;
  const height = cell * level.height;

  return (
    <Canvas style={{width: THUMB_W, height}}>
      <Rect x={0} y={0} width={THUMB_W} height={height} color={palette.wall} />
      {map.tiles.flatMap((row, y) =>
        row.map((tile, x) =>
          tile === 'WALL' ? null : (
            <Rect
              key={`${x},${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              color={tile === 'EXIT' ? palette.safe : palette.floor}
              opacity={dimmed ? 0.35 : 1}
            />
          ),
        ),
      )}
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
  root: {flex: 1, backgroundColor: palette.background},
  header: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 6},
  kicker: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  blurb: {color: palette.textMuted, fontSize: 14, lineHeight: 20},
  list: {paddingHorizontal: 16, gap: 12},
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDAD2',
    backgroundColor: '#FBFAF7',
  },
  cardLocked: {opacity: 0.55},
  cardBody: {flex: 1, gap: 3},
  cardIndex: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  cardTitle: {color: palette.text, fontSize: 17, fontWeight: '600'},
  cardTeaches: {color: palette.textMuted, fontSize: 13, lineHeight: 18},
  markRow: {flexDirection: 'row', gap: 6, marginTop: 6},
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D2CFC7',
  },
  chipEarned: {backgroundColor: palette.safe, borderColor: palette.safe},
  chipText: {color: palette.textMuted, fontSize: 10, fontWeight: '700'},
  chipTextEarned: {color: '#FFFFFF'},
  stamp: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1.5,
    borderColor: palette.safe,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{rotate: '-8deg'}],
  },
  stampText: {
    color: palette.safe,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});

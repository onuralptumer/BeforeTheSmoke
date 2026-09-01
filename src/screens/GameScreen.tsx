/**
 * The game screen and its phase machine.
 *
 *   INTRO → OBSERVING → ANALYZING ⇄ REPLAYING → RESULT
 *
 * The simulation never runs here. Each attempt is recorded in full the moment
 * the signal changes, and this screen only moves a playhead across it.
 */

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {LevelDefinition, SignalPlacement} from '../game/types';
import {WorldMap} from '../game/engine/world';
import {
  RecordedRun,
  criticalDecision,
  failureLine,
  recordRun,
  timelineFor,
} from '../game/replay/record';
import {GameCanvas} from '../rendering/GameCanvas';
import {Viewport, cellCentre, distance, fitViewport} from '../rendering/geometry';
import {usePlayback} from '../state/usePlayback';
import {Button} from '../components/Button';
import {haptics} from '../audio/haptics';
import {numeric, palette} from '../theme';

type Phase = 'INTRO' | 'OBSERVING' | 'ANALYZING' | 'REPLAYING' | 'RESULT';

/** Snap radius for socket placement, in points. */
const SNAP_RADIUS = 32;

interface Props {
  level: LevelDefinition;
  onExit: () => void;
  onNext: (() => void) | null;
  onResult: (run: RecordedRun) => void;
}

export function GameScreen({level, onExit, onNext, onResult}: Props) {
  const insets = useSafeAreaInsets();
  const map = useMemo(() => new WorldMap(level), [level]);
  const baseline = useMemo(() => recordRun(level, null), [level]);

  const [phase, setPhase] = useState<Phase>('INTRO');
  const [signal, setSignal] = useState<SignalPlacement | null>(null);
  const [run, setRun] = useState<RecordedRun>(baseline);
  const [showBefore, setShowBefore] = useState(false);
  const [dragPoint, setDragPoint] = useState<{x: number; y: number} | null>(null);
  const [hoveredSocketId, setHoveredSocketId] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({width: 0, height: 0});
  const lastHovered = useRef<string | null>(null);

  const viewport: Viewport = useMemo(
    () =>
      fitViewport(
        mapSize.width || 1,
        mapSize.height || 1,
        level.width,
        level.height,
      ),
    [mapSize, level.width, level.height],
  );

  // Playback always calls the latest version of this, so reading `run` from
  // the closure is safe — and keeps the reporting out of a state updater,
  // where React is free to invoke it more than once.
  const onRunFinished = useCallback(() => {
    if (run.result.success) {
      haptics.everyoneOut();
      setPhase('RESULT');
    } else {
      haptics.failure();
      setPhase('ANALYZING');
    }
    onResult(run);
  }, [run, onResult]);

  const playback = usePlayback(run, onRunFinished);
  const {play, restart} = playback;

  // A slow shared phase for socket pulse and smoke drift, derived from the
  // playhead so it costs no extra state.
  const pulsePhase = (playback.tickIndex + playback.alpha) / 6.4;

  const startBaseline = useCallback(() => {
    setPhase('OBSERVING');
    restart();
    requestAnimationFrame(play);
  }, [restart, play]);

  const replayWithSignal = useCallback(() => {
    if (!signal) {
      return;
    }
    const next = recordRun(level, signal);
    setRun(next);
    setPhase('REPLAYING');
    requestAnimationFrame(play);
  }, [level, signal, play]);

  const retry = useCallback(() => {
    setPhase('ANALYZING');
    restart();
  }, [restart]);

  const socketPoints = useMemo(
    () =>
      level.signalSockets.map(socket => ({
        id: socket.id,
        point: cellCentre(viewport, socket.anchorCell),
      })),
    [level.signalSockets, viewport],
  );

  const nearestSocket = useCallback(
    (x: number, y: number) => {
      let best: {id: string; d: number} | null = null;
      for (const {id, point} of socketPoints) {
        const d = distance(point, {x, y});
        if (d <= SNAP_RADIUS && (!best || d < best.d)) {
          best = {id, d};
        }
      }
      return best?.id ?? null;
    },
    [socketPoints],
  );

  const canPlace = phase === 'ANALYZING';

  // The gesture is attached to the map view, so its x/y are already in map
  // space — no measuring, and nothing to go stale when the layout changes.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canPlace)
        .onBegin(e => {
          setDragPoint({x: e.x, y: e.y});
        })
        .onUpdate(e => {
          setDragPoint({x: e.x, y: e.y});
          const hit = nearestSocket(e.x, e.y);
          if (hit !== lastHovered.current) {
            lastHovered.current = hit;
            setHoveredSocketId(hit);
            if (hit) {
              haptics.socketHover();
            }
          }
        })
        .onEnd(e => {
          const hit = nearestSocket(e.x, e.y);
          if (hit) {
            const socket = level.signalSockets.find(s => s.id === hit)!;
            setSignal(current =>
              current?.socketId === hit
                ? current
                : {socketId: hit, edgeId: socket.allowedEdgeIds[0]},
            );
            haptics.signalSnap();
          }
        })
        .onFinalize(() => {
          setDragPoint(null);
          setHoveredSocketId(null);
          lastHovered.current = null;
        })
        .runOnJS(true),
    [canPlace, nearestSocket, level.signalSockets],
  );

  const rotate = useCallback(() => {
    if (!signal) {
      return;
    }
    const socket = level.signalSockets.find(s => s.id === signal.socketId);
    if (!socket) {
      return;
    }
    const index = socket.allowedEdgeIds.indexOf(signal.edgeId);
    const nextEdge =
      socket.allowedEdgeIds[(index + 1) % socket.allowedEdgeIds.length];
    setSignal({socketId: signal.socketId, edgeId: nextEdge});
    haptics.rotate();
  }, [signal, level.signalSockets]);

  const frame = run.frames[Math.min(playback.tickIndex, run.frames.length - 1)];
  const safeCount = frame.agents.filter(a => a.state === 'SAFE').length;

  const onMapLayout = useCallback((e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setMapSize({width, height});
  }, []);

  const showTrails = phase === 'ANALYZING' || phase === 'RESULT';

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <TopBar
        level={level}
        safeCount={safeCount}
        total={frame.agents.length}
        tick={frame.tick}
        onExit={onExit}
      />

      <GestureDetector gesture={pan}>
        <View style={styles.map} onLayout={onMapLayout}>
          {mapSize.width > 0 && (
            <GameCanvas
              level={level}
              map={map}
              run={run}
              viewport={viewport}
              tickIndex={playback.tickIndex}
              alpha={playback.alpha}
              showSockets={canPlace}
              signal={signal}
              dragPoint={dragPoint}
              hoveredSocketId={hoveredSocketId}
              ghostRun={showBefore ? baseline : null}
              showTrails={showTrails}
              phase={pulsePhase}
            />
          )}

          {phase === 'INTRO' && (
            <Pressable style={styles.introOverlay} onPress={startBaseline}>
              <Text style={styles.introTitle}>WATCH THE INCIDENT</Text>
              <Text style={styles.introHint}>Tap to begin</Text>
            </Pressable>
          )}
        </View>
      </GestureDetector>

      <View style={[styles.bottom, {paddingBottom: insets.bottom + 12}]}>
        {phase === 'OBSERVING' || phase === 'REPLAYING' ? (
          <PlaybackControls playback={playback} />
        ) : null}

        {phase === 'ANALYZING' ? (
          <AnalysisControls
            level={level}
            run={run}
            signal={signal}
            showBefore={showBefore}
            onToggleBefore={() => setShowBefore(v => !v)}
            onRotate={rotate}
            onReplay={replayWithSignal}
          />
        ) : null}

        {phase === 'RESULT' ? (
          <ResultSheet
            run={run}
            onRetry={retry}
            onNext={onNext}
            onExit={onExit}
          />
        ) : null}
      </View>
    </View>
  );
}

function TopBar({
  level,
  safeCount,
  total,
  tick,
  onExit,
}: {
  level: LevelDefinition;
  safeCount: number;
  total: number;
  tick: number;
  onExit: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onExit} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Archive</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {level.title}
      </Text>
      <View style={styles.readouts}>
        <Text style={styles.readout}>
          {safeCount}/{total} safe
        </Text>
        <Text style={[styles.readout, styles.mono]}>t{String(tick).padStart(2, '0')}</Text>
      </View>
    </View>
  );
}

function PlaybackControls({
  playback,
}: {
  playback: ReturnType<typeof usePlayback>;
}) {
  return (
    <View style={styles.row}>
      <Button
        label={playback.playing ? 'Pause' : 'Play'}
        onPress={playback.playing ? playback.pause : playback.play}
      />
      <Button
        label={playback.speed === 1 ? '1×' : '2×'}
        onPress={() => playback.setSpeed(playback.speed === 1 ? 2 : 1)}
      />
    </View>
  );
}

function AnalysisControls({
  level,
  run,
  signal,
  showBefore,
  onToggleBefore,
  onRotate,
  onReplay,
}: {
  level: LevelDefinition;
  run: RecordedRun;
  signal: SignalPlacement | null;
  showBefore: boolean;
  onToggleBefore: () => void;
  onRotate: () => void;
  onReplay: () => void;
}) {
  const cause = failureLine(run);
  const critical = criticalDecision(level, run);
  const events = timelineFor(level, run);

  return (
    <View style={styles.analysis}>
      {cause ? <Text style={styles.cause}>{cause}</Text> : null}
      {critical ? (
        <Text style={styles.subCause}>
          The decision that set it up happened at {critical.junctionId} on tick{' '}
          {critical.tick}.
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}>
        {events.map((event, i) => (
          <View key={`${event.tick}-${i}`} style={styles.stripItem}>
            <Text style={[styles.stripTick, styles.mono]}>t{event.tick}</Text>
            <Text style={styles.stripLabel}>{event.label}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.tray}>
        <View style={[styles.chip, signal ? styles.chipPlaced : null]}>
          <View style={styles.chipArrow} />
          <Text style={styles.chipLabel}>
            {signal ? 'Signal placed' : 'Drag onto a socket'}
          </Text>
        </View>
        <View style={styles.row}>
          <Button label="Rotate" onPress={onRotate} disabled={!signal} />
          <Button
            label={showBefore ? 'Hide before' : 'Before'}
            onPress={onToggleBefore}
          />
          <Button
            label="REPLAY"
            variant="primary"
            onPress={onReplay}
            disabled={!signal}
          />
        </View>
      </View>
    </View>
  );
}

function ResultSheet({
  run,
  onRetry,
  onNext,
  onExit,
}: {
  run: RecordedRun;
  onRetry: () => void;
  onNext: (() => void) | null;
  onExit: () => void;
}) {
  const {marks, finishTick, totalWaitTicks} = run.result;
  return (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>EVERYONE OUT</Text>
      <Text style={styles.resultSub}>Before the smoke.</Text>
      <View style={styles.marks}>
        <Mark label="Rescue" earned={marks.rescue} />
        <Mark label="Flow" earned={marks.flow} detail={`${totalWaitTicks} waiting`} />
        <Mark label="Swift" earned={marks.swift} detail={`out at t${finishTick}`} />
      </View>
      <View style={styles.row}>
        <Button label="Replay" onPress={onRetry} />
        {onNext ? (
          <Button label="Next incident" variant="primary" onPress={onNext} />
        ) : (
          <Button label="Archive" variant="primary" onPress={onExit} />
        )}
      </View>
    </View>
  );
}

function Mark({
  label,
  earned,
  detail,
}: {
  label: string;
  earned: boolean;
  detail?: string;
}) {
  return (
    <View style={styles.mark}>
      <View style={[styles.markDot, earned ? styles.markDotEarned : null]} />
      <Text style={[styles.markLabel, earned ? styles.markLabelEarned : null]}>
        {label}
      </Text>
      {detail ? <Text style={styles.markDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.background},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  back: {color: palette.textMuted, fontSize: 15},
  title: {flex: 1, color: palette.text, fontSize: 16, fontWeight: '600'},
  readouts: {alignItems: 'flex-end'},
  readout: {color: palette.textMuted, fontSize: 12},
  mono: {...numeric},
  map: {flex: 1},
  introOverlay: {
    // Not StyleSheet.absoluteFill: that is a registered style id, and
    // spreading it yields an empty object rather than the four insets.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(241,239,233,0.82)',
  },
  introTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  introHint: {color: palette.textMuted, fontSize: 14, marginTop: 8},
  bottom: {paddingHorizontal: 16, paddingTop: 12, gap: 12},
  row: {flexDirection: 'row', gap: 10, alignItems: 'center'},
  analysis: {gap: 10},
  cause: {color: palette.text, fontSize: 16, fontWeight: '600'},
  subCause: {color: palette.textMuted, fontSize: 13, lineHeight: 18},
  strip: {maxHeight: 52},
  stripContent: {gap: 14, paddingVertical: 4},
  stripItem: {gap: 2},
  stripTick: {color: palette.text, fontSize: 12, fontWeight: '700'},
  stripLabel: {color: palette.textMuted, fontSize: 11},
  tray: {gap: 10},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: palette.wall,
  },
  chipPlaced: {opacity: 0.45},
  chipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: palette.signal,
  },
  chipLabel: {color: palette.background, fontSize: 13, fontWeight: '600'},
  result: {gap: 10},
  resultTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  resultSub: {color: palette.textMuted, fontSize: 14},
  marks: {flexDirection: 'row', gap: 20, paddingVertical: 6},
  mark: {gap: 3},
  markDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: palette.structure,
  },
  markDotEarned: {backgroundColor: palette.safe, borderColor: palette.safe},
  markLabel: {color: palette.textMuted, fontSize: 13, fontWeight: '600'},
  markLabelEarned: {color: palette.text},
  markDetail: {color: palette.textMuted, fontSize: 11},
});

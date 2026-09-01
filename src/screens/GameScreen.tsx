/**
 * The game screen and its phase machine.
 *
 *   INTRO → OBSERVING → ANALYZING → PLACING → REPLAYING → RESULT
 *                            ↑__________________________|
 *
 * Analysis and placement are separate steps on purpose. Sockets stay hidden
 * while the player is still reading what went wrong, so the interface never
 * answers the question before it has been asked.
 *
 * The simulation never runs here. Each attempt is recorded in full the moment
 * the signal changes; this screen only moves a playhead across it.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  TimelineEvent,
  criticalCell,
  criticalDecision,
  failureLine,
  recordRun,
  timelineFor,
} from '../game/replay/record';
import {GameCanvas} from '../rendering/GameCanvas';
import {
  Viewport,
  cellCentre,
  contentBounds,
  distance,
  fitViewportToContent,
} from '../rendering/geometry';
import {usePlayback} from '../state/usePlayback';
import {usePulse} from '../state/usePulse';
import {haptics} from '../audio/haptics';
import {sounds} from '../audio/sounds';
import {formatClock, formatPrecise, numeric, palette} from '../theme';

type Phase =
  | 'INTRO'
  | 'OBSERVING'
  | 'ANALYZING'
  | 'PLACING'
  | 'REPLAYING'
  | 'RESULT';

/** Snap radius for socket placement, in points. */
const SNAP_RADIUS = 32;

interface Props {
  level: LevelDefinition;
  levelNumber: number;
  onExit: () => void;
  onNext: (() => void) | null;
  onResult: (run: RecordedRun) => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function GameScreen({
  level,
  levelNumber,
  onExit,
  onNext,
  onResult,
  muted,
  onToggleMute,
}: Props) {
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

  // Frame the part of the grid this level actually uses, so a sparse plan
  // fills the screen instead of floating in empty ground.
  const bounds = useMemo(
    () =>
      contentBounds(
        (x, y) => map.tiles[y][x] === 'WALL',
        level.width,
        level.height,
      ),
    [map, level.width, level.height],
  );

  const viewport: Viewport = useMemo(
    () =>
      fitViewportToContent(mapSize.width || 1, mapSize.height || 1, bounds),
    [mapSize, bounds],
  );

  const onRunFinished = useCallback(() => {
    if (run.result.success) {
      haptics.everyoneOut();
      sounds.everyoneOut();
      setPhase('RESULT');
    } else {
      haptics.failure();
      setPhase('ANALYZING');
    }
    onResult(run);
  }, [run, onResult]);

  const playback = usePlayback(run, onRunFinished);
  const {play, restart} = playback;

  const explaining = phase === 'ANALYZING' || phase === 'PLACING';
  const canPlace = phase === 'PLACING';
  const watching = phase === 'OBSERVING' || phase === 'REPLAYING';

  // While a run plays the playhead is already re-rendering, so derive the
  // pulse from it. While the analysis sits still, so does the playhead.
  const idlePulse = usePulse(explaining);
  const pulsePhase = explaining
    ? idlePulse
    : (playback.tickIndex + playback.alpha) / 6.4;

  const startBaseline = useCallback(() => {
    setPhase('OBSERVING');
    restart();
    requestAnimationFrame(play);
  }, [restart, play]);

  const replayWithSignal = useCallback(() => {
    if (!signal) {
      return;
    }
    setRun(recordRun(level, signal));
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

  // The gesture is attached to the map view, so its x/y are already in map
  // space — no measuring, and nothing to go stale when the layout changes.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canPlace)
        .onBegin(e => setDragPoint({x: e.x, y: e.y}))
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
            sounds.signalSnap();
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
    sounds.rotate();
  }, [signal, level.signalSockets]);

  const frame = run.frames[Math.min(playback.tickIndex, run.frames.length - 1)];
  const safeCount = frame.agents.filter(a => a.state === 'SAFE').length;

  // One warning when somebody first reaches exposure 3 — a person-tick from
  // incapacitation. Never per tick, and never per person.
  const warnedRef = useRef(false);
  useEffect(() => {
    if (!watching) {
      warnedRef.current = false;
      return;
    }
    if (warnedRef.current) {
      return;
    }
    if (frame.agents.some(a => a.exposure >= 3 && a.state === 'ACTIVE')) {
      warnedRef.current = true;
      haptics.hazardThreshold();
    }
  }, [watching, frame]);

  // A door shutting is the one world event that gets a sound, because it is
  // the one the player is most likely to be looking away from.
  const doorsRef = useRef(frame.closedDoorCells.length);
  useEffect(() => {
    const count = frame.closedDoorCells.length;
    if (watching && count > doorsRef.current) {
      sounds.doorClose();
    }
    doorsRef.current = count;
  }, [watching, frame]);

  const onMapLayout = useCallback((e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setMapSize({width, height});
  }, []);

  const blamedCell = useMemo(
    () => (explaining ? criticalCell(level) : null),
    [explaining, level],
  );

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <TopBar
        levelNumber={levelNumber}
        title={level.title}
        tick={frame.tick}
        playing={playback.playing}
        onTogglePlay={playback.playing ? playback.pause : playback.play}
        canPause={watching}
        onExit={onExit}
        muted={muted}
        onToggleMute={onToggleMute}
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
              showTrails={explaining || phase === 'RESULT'}
              dim={phase === 'ANALYZING'}
              criticalCell={blamedCell}
              phase={pulsePhase}
            />
          )}

          {phase === 'INTRO' && (
            <Pressable
              style={styles.introOverlay}
              accessibilityRole="button"
              accessibilityLabel="Watch the incident"
              onPress={startBaseline}
            />
          )}

          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>
              {safeCount}/{frame.agents.length}
            </Text>
            <Text style={styles.counterLabel}>SAFE</Text>
          </View>
        </View>
      </GestureDetector>

      <View style={[styles.dock, {paddingBottom: insets.bottom + 14}]}>
        {phase === 'INTRO' && (
          <ActionBar label="WATCH" onPress={startBaseline} glyph="eye" />
        )}

        {watching && (
          <ActionBar
            label={phase === 'OBSERVING' ? 'WATCH' : 'REPLAY'}
            onPress={playback.playing ? playback.pause : playback.play}
            glyph={playback.playing ? 'pause' : 'play'}
          />
        )}

        {phase === 'ANALYZING' && (
          <AnalysisPanel
            level={level}
            run={run}
            showBefore={showBefore}
            onToggleBefore={() => setShowBefore(v => !v)}
            onProceed={() => setPhase('PLACING')}
          />
        )}

        {phase === 'PLACING' && (
          <PlacementBar
            signal={signal}
            onRotate={rotate}
            onReplay={replayWithSignal}
            onBack={() => setPhase('ANALYZING')}
          />
        )}

        {phase === 'RESULT' && (
          <ResultBar
            run={run}
            onRetry={retry}
            onNext={onNext}
            onExit={onExit}
          />
        )}
      </View>
    </View>
  );
}

function TopBar({
  levelNumber,
  title,
  tick,
  playing,
  onTogglePlay,
  canPause,
  onExit,
  muted,
  onToggleMute,
}: {
  levelNumber: number;
  title: string;
  tick: number;
  playing: boolean;
  onTogglePlay: () => void;
  canPause: boolean;
  onExit: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onExit} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.incident}>
          INCIDENT {String(levelNumber).padStart(2, '0')}
        </Text>
        <Text style={styles.incidentTitle} numberOfLines={1}>
          {title}
        </Text>
      </Pressable>
      <View style={styles.topRight}>
        <Text style={[styles.clock, numeric]}>{formatClock(tick)}</Text>
        <Pressable
          onPress={onToggleMute}
          accessibilityRole="switch"
          accessibilityLabel={muted ? 'Unmute sound' : 'Mute sound'}
          accessibilityState={{checked: !muted}}
          hitSlop={10}
          style={styles.iconButton}>
          <View style={[styles.speaker, muted && styles.speakerMuted]}>
            <View style={styles.speakerBody} />
            <View style={styles.speakerCone} />
            {!muted && <View style={styles.speakerWave} />}
            {muted && <View style={styles.speakerSlash} />}
          </View>
        </Pressable>
        <Pressable
          onPress={canPause ? onTogglePlay : undefined}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          accessibilityState={{disabled: !canPause}}
          hitSlop={10}
          style={[styles.iconButton, !canPause && styles.iconDisabled]}>
          <PauseGlyph playing={playing} />
        </Pressable>
      </View>
    </View>
  );
}

function PauseGlyph({playing}: {playing: boolean}) {
  if (playing) {
    return (
      <View style={styles.pauseGlyph}>
        <View style={styles.pauseBar} />
        <View style={styles.pauseBar} />
      </View>
    );
  }
  return <View style={styles.playGlyph} />;
}

function ActionBar({
  label,
  onPress,
  glyph,
}: {
  label: string;
  onPress: () => void;
  glyph: 'eye' | 'play' | 'pause';
}) {
  return (
    <Pressable
      style={styles.actionBar}
      accessibilityRole="button"
      onPress={onPress}>
      <Text style={styles.actionLabel}>{label}</Text>
      {glyph === 'eye' && <View style={styles.eye} />}
      {glyph === 'play' && <View style={styles.playGlyphLarge} />}
      {glyph === 'pause' && (
        <View style={styles.pauseGlyph}>
          <View style={styles.pauseBarLarge} />
          <View style={styles.pauseBarLarge} />
        </View>
      )}
    </Pressable>
  );
}

function AnalysisPanel({
  level,
  run,
  showBefore,
  onToggleBefore,
  onProceed,
}: {
  level: LevelDefinition;
  run: RecordedRun;
  showBefore: boolean;
  onToggleBefore: () => void;
  onProceed: () => void;
}) {
  const cause = failureLine(run);
  const critical = criticalDecision(level, run);
  const events = timelineFor(level, run);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>ANALYZE</Text>
        <Pressable
          onPress={onToggleBefore}
          accessibilityRole="button"
          hitSlop={10}>
          <Text style={styles.panelAction}>
            {showBefore ? 'HIDE BEFORE' : 'BEFORE'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.panelBody}
        contentContainerStyle={styles.panelBodyContent}
        showsVerticalScrollIndicator={false}>
        {cause ? <Text style={styles.cause}>{cause}</Text> : null}
        {critical ? (
          <Text style={styles.subCause}>
            It was decided at {critical.junctionId},{' '}
            {formatPrecise(critical.tick)} into the incident.
          </Text>
        ) : null}
        <Timeline events={events} lastTick={run.lastTick} />
      </ScrollView>

      <Pressable
        style={styles.primary}
        accessibilityRole="button"
        onPress={onProceed}>
        <Text style={styles.primaryLabel}>PLACE ONE SIGNAL</Text>
      </Pressable>
    </View>
  );
}

/**
 * A read-only strip, not a scrubber. It says when the building turned against
 * them; moving the playhead to a chosen moment is a different feature with a
 * much larger surface, and it is not what makes a level legible.
 */
function Timeline({
  events,
  lastTick,
}: {
  events: TimelineEvent[];
  lastTick: number;
}) {
  return (
    <View style={styles.timeline}>
      <View style={styles.track}>
        <View style={styles.trackFill} />
        {events.map((event, i) => {
          const left = `${Math.min(100, (event.tick / Math.max(1, lastTick)) * 100)}%`;
          return (
            <View
              key={`${event.tick}-${i}`}
              style={[
                styles.marker,
                event.kind === 'FAILURE' && styles.markerFailure,
                {left: left as unknown as number},
              ]}
            />
          );
        })}
      </View>
      <View style={styles.trackLabels}>
        {events.map((event, i) => (
          <Text key={`l${i}`} style={styles.trackEvent} numberOfLines={1}>
            <Text style={numeric}>{formatPrecise(event.tick)}</Text>{' '}
            {event.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function PlacementBar({
  signal,
  onRotate,
  onReplay,
  onBack,
}: {
  signal: SignalPlacement | null;
  onRotate: () => void;
  onReplay: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitleSignal}>PLACE ONE SIGNAL</Text>
        <View style={styles.tray}>
          <View style={styles.trayChip}>
            <View style={styles.trayArrow} />
          </View>
          <Text style={styles.trayCount}>{signal ? 0 : 1}</Text>
        </View>
      </View>

      <Text style={styles.subCause}>
        {signal
          ? 'Tap rotate to turn it. Drag to move it.'
          : 'Drag the signal onto a socket.'}
      </Text>

      <View style={styles.row}>
        <Pressable
          style={styles.secondary}
          accessibilityRole="button"
          onPress={onBack}>
          <Text style={styles.secondaryLabel}>BACK</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, !signal && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{disabled: !signal}}
          onPress={signal ? onRotate : undefined}>
          <Text style={styles.secondaryLabel}>ROTATE</Text>
        </Pressable>
        <Pressable
          style={[styles.primary, styles.grow, !signal && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{disabled: !signal}}
          onPress={signal ? onReplay : undefined}>
          <Text style={styles.primaryLabel}>REPLAY</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultBar({
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
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.outTitle}>EVERYONE OUT</Text>
        <Pressable
          style={styles.nextButton}
          accessibilityRole="button"
          onPress={onNext ?? onExit}>
          <Text style={styles.nextLabel}>
            {onNext ? 'NEXT INCIDENT ›' : 'ARCHIVE ›'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.subCause}>Before the smoke.</Text>
      <View style={styles.marks}>
        <Mark label="RESCUE" earned={marks.rescue} />
        <Mark
          label="FLOW"
          earned={marks.flow}
          detail={`${totalWaitTicks} waiting`}
        />
        <Mark
          label="SWIFT"
          earned={marks.swift}
          detail={finishTick !== null ? formatClock(finishTick) : undefined}
        />
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          hitSlop={10}
          style={styles.grow}>
          <Text style={styles.panelAction}>REPLAY</Text>
        </Pressable>
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
      <View style={[styles.markDot, earned && styles.markDotEarned]} />
      <Text style={[styles.markLabel, earned && styles.markLabelEarned]}>
        {label}
      </Text>
      {detail ? <Text style={styles.markDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.shell},

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
  },
  incident: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  incidentTitle: {color: palette.text, fontSize: 15, fontWeight: '600'},
  topRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  clock: {color: palette.text, fontSize: 15, fontWeight: '600'},
  iconButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisabled: {opacity: 0.3},
  pauseGlyph: {flexDirection: 'row', gap: 3},
  pauseBar: {width: 3, height: 13, backgroundColor: palette.text},
  pauseBarLarge: {width: 4, height: 16, backgroundColor: palette.text},
  playGlyph: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: palette.text,
  },
  playGlyphLarge: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: palette.safe,
  },
  speaker: {
    width: 20,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerMuted: {opacity: 0.45},
  speakerBody: {width: 4, height: 8, backgroundColor: palette.text},
  speakerCone: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: palette.text,
  },
  speakerWave: {
    width: 6,
    height: 6,
    marginLeft: 2,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: palette.text,
  },
  speakerSlash: {
    width: 14,
    height: 1.8,
    marginLeft: -8,
    backgroundColor: palette.danger,
    transform: [{rotate: '-45deg'}],
  },

  map: {flex: 1, minHeight: 200},
  introOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  counter: {
    position: 'absolute',
    top: 14,
    right: 18,
    alignItems: 'flex-end',
  },
  counterText: {color: palette.text, fontSize: 17, fontWeight: '700'},
  counterLabel: {
    color: palette.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },

  dock: {paddingHorizontal: 14, paddingTop: 10, maxHeight: '52%'},
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.panelEdge,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  actionLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  eye: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: palette.safe,
  },

  panel: {
    flexShrink: 1,
    minHeight: 0,
    backgroundColor: palette.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.panelEdge,
    padding: 16,
    gap: 10,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  panelTitleSignal: {
    color: palette.signal,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  panelAction: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  cause: {color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600'},
  subCause: {color: palette.textMuted, fontSize: 13, lineHeight: 19},

  panelBody: {flexShrink: 1},
  panelBodyContent: {gap: 10, paddingBottom: 4},
  timeline: {gap: 6, paddingTop: 4},
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.panelEdge,
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.panelEdge,
  },
  marker: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    marginLeft: -4,
    backgroundColor: palette.textMuted,
  },
  markerFailure: {backgroundColor: palette.danger},
  trackLabels: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  trackTime: {color: palette.textMuted, fontSize: 11},
  trackEvent: {color: palette.textMuted, fontSize: 11},

  row: {flexDirection: 'row', gap: 10, alignItems: 'center'},
  grow: {flex: 1},
  primary: {
    backgroundColor: palette.signal,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryLabel: {
    color: palette.shell,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  secondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.panelEdge,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  disabled: {opacity: 0.35},

  tray: {flexDirection: 'row', alignItems: 'center', gap: 8},
  trayChip: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayArrow: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: palette.signal,
  },
  trayCount: {color: palette.signal, fontSize: 15, fontWeight: '700'},

  outTitle: {
    color: palette.safe,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  nextButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.safeDeep,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
  },
  nextLabel: {
    color: palette.safe,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  marks: {flexDirection: 'row', gap: 18, alignItems: 'flex-start'},
  mark: {gap: 3},
  markDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: palette.textMuted,
  },
  markDotEarned: {backgroundColor: palette.safe, borderColor: palette.safe},
  markLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  markLabelEarned: {color: palette.text},
  markDetail: {color: palette.textMuted, fontSize: 10},
});

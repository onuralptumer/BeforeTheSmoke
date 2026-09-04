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
  Animated,
  Easing,
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
import {LEVELS} from '../game/levels';
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
import {Icon} from '../components/Icon';
import {IconName, eventIcon, markIcon} from '../components/icons';
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
import {
  formatClock,
  formatPrecise,
  motion,
  numeric,
  palette,
  pulseTicks,
  radius,
  space,
  state,
  tracking,
  type,
} from '../theme';

type Phase =
  | 'INTRO'
  | 'OBSERVING'
  | 'ANALYZING'
  | 'PLACING'
  | 'REPLAYING'
  | 'RESULT';

/** Snap radius for socket placement, in points. */
const SNAP_RADIUS = 32;

/** Timeline event glyph. Small, but not below where a silhouette survives. */
const MARKER_SIZE = 12;

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
  const [signals, setSignals] = useState<SignalPlacement[]>([]);
  const [run, setRun] = useState<RecordedRun>(baseline);
  const [showBefore, setShowBefore] = useState(false);
  const [dragPoint, setDragPoint] = useState<{x: number; y: number} | null>(null);
  const [hoveredSocketId, setHoveredSocketId] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({width: 0, height: 0});
  const lastHovered = useRef<string | null>(null);

  // Where the map sits on screen. The drag starts on the tray, which lives in
  // the dock, so gesture coordinates arrive in window space and have to be
  // brought back into map space before they can be matched against a socket.
  const mapRef = useRef<React.ComponentRef<typeof View>>(null);
  const mapOrigin = useRef({x: 0, y: 0});

  const budget = level.signalBudget ?? 1;
  const remaining = budget - signals.length;

  // Frame the part of the grid this level actually uses, so a sparse plan
  // fills the screen instead of floating in empty ground.
  const bounds = useMemo(() => {
    const b = contentBounds(
      (x, y) => map.tiles[y][x] === 'WALL',
      level.width,
      level.height,
    );
    const shell = level.floorPlan?.shell;
    if (!shell) {
      return b;
    }
    // Frame the whole building, not just the corridors inside it. Without this
    // a room that sits outside the graph's bounding box gets cropped off.
    return {
      minX: Math.min(b.minX, shell.x),
      minY: Math.min(b.minY, shell.y),
      maxX: Math.max(b.maxX, shell.x + shell.w - 1),
      maxY: Math.max(b.maxY, shell.y + shell.h - 1),
    };
  }, [map, level.width, level.height, level.floorPlan]);

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
    : (playback.tickIndex + playback.alpha) / pulseTicks;

  const startBaseline = useCallback(() => {
    setPhase('OBSERVING');
    restart();
    requestAnimationFrame(play);
  }, [restart, play]);

  const replayWithSignal = useCallback(() => {
    if (signals.length === 0) {
      return;
    }
    setRun(recordRun(level, signals));
    setPhase('REPLAYING');
    requestAnimationFrame(play);
  }, [level, signals, play]);

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

  /**
   * Dragging a signal out of the tray.
   *
   * The signal used to appear on a socket from anywhere on the map, which gave
   * the player's one intervention no sense of being a thing they were holding.
   * It now starts in the tray at the bottom of the dock and is carried onto the
   * plan, so a placement costs a deliberate gesture and the tray visibly runs
   * out. Coordinates arrive in window space because the gesture begins outside
   * the map view, so they are rebased through `mapOrigin` before being matched.
   */
  const toMap = useCallback(
    (e: {absoluteX: number; absoluteY: number}) => ({
      x: e.absoluteX - mapOrigin.current.x,
      y: e.absoluteY - mapOrigin.current.y,
    }),
    [],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canPlace && remaining > 0)
        .onBegin(e => setDragPoint(toMap(e)))
        .onUpdate(e => {
          const point = toMap(e);
          setDragPoint(point);
          const hit = nearestSocket(point.x, point.y);
          // A socket that already holds a signal is not a drop target.
          const free = hit && !signals.some(x => x.socketId === hit) ? hit : null;
          if (free !== lastHovered.current) {
            lastHovered.current = free;
            setHoveredSocketId(free);
            if (free) {
              haptics.socketHover();
            }
          }
        })
        .onEnd(e => {
          const point = toMap(e);
          const hit = nearestSocket(point.x, point.y);
          if (!hit || signals.some(x => x.socketId === hit)) {
            return;
          }
          const socket = level.signalSockets.find(s => s.id === hit)!;
          setSignals(current =>
            current.length >= budget
              ? current
              : [...current, {socketId: hit, edgeId: socket.allowedEdgeIds[0]}],
          );
          haptics.signalSnap();
          sounds.signalSnap();
        })
        .onFinalize(() => {
          setDragPoint(null);
          setHoveredSocketId(null);
          lastHovered.current = null;
        })
        .runOnJS(true),
    [
      canPlace,
      remaining,
      toMap,
      nearestSocket,
      signals,
      level.signalSockets,
      budget,
    ],
  );

  /** Tapping a placed signal turns it; tapping it again cycles on round. */
  const tapMap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(canPlace)
        .onEnd(e => {
          const hit = nearestSocket(e.x, e.y);
          if (!hit) {
            return;
          }
          const socket = level.signalSockets.find(s => s.id === hit);
          if (!socket || !signals.some(x => x.socketId === hit)) {
            return;
          }
          setSignals(current =>
            current.map(x => {
              if (x.socketId !== hit) {
                return x;
              }
              const i = socket.allowedEdgeIds.indexOf(x.edgeId);
              return {
                socketId: x.socketId,
                edgeId:
                  socket.allowedEdgeIds[(i + 1) % socket.allowedEdgeIds.length],
              };
            }),
          );
          haptics.rotate();
          sounds.rotate();
        })
        .runOnJS(true),
    [canPlace, nearestSocket, level.signalSockets, signals],
  );

  const clearSignals = useCallback(() => setSignals([]), []);

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
    // Window position, not parent-relative: the tray drag reports in window
    // coordinates and has to be rebased into this view.
    mapRef.current?.measureInWindow((x: number, y: number) => {
      mapOrigin.current = {x, y};
    });
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

      <GestureDetector gesture={tapMap}>
        <View ref={mapRef} style={styles.map} onLayout={onMapLayout}>
          {mapSize.width > 0 && (
            <GameCanvas
              level={level}
              map={map}
              run={run}
              viewport={viewport}
              tickIndex={playback.tickIndex}
              alpha={playback.alpha}
              showSockets={canPlace}
              signals={signals}
              dragPoint={dragPoint}
              hoveredSocketId={hoveredSocketId}
              ghostRun={showBefore ? baseline : null}
              showTrails={explaining || phase === 'RESULT'}
              dim={phase === 'ANALYZING'}
              criticalCell={blamedCell}
              phase={pulsePhase}
              canvasWidth={mapSize.width}
              canvasHeight={mapSize.height}
              sheetCount={LEVELS.length}
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
        <DockPanel phaseKey={phase}>
        {phase === 'INTRO' && (
          <ActionBar label="WATCH" onPress={startBaseline} glyph="watch" />
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
            placed={signals.length}
            budget={budget}
            trayGesture={pan}
            onClear={clearSignals}
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
        </DockPanel>
      </View>
    </View>
  );
}

/**
 * The 220 ms panel transition from design.md §11.
 *
 * The dock swaps one of five components as the phase changes, and it used to do
 * it in a single frame. This settles the incoming panel in instead: it rises
 * eight points and fades, which is the "clean slide or fade" the spec asks for.
 *
 * There is deliberately no matching fade-out. A cross-fade would need both
 * panels mounted at once and the dock is height-constrained, so the old one
 * would push the new one around while both were visible.
 *
 * `useNativeDriver` is what makes this free: opacity and transform are handed
 * to the platform, so none of it competes with the playback loop on the JS
 * thread — which is the exact cost the rest of this pass is trying to remove.
 */
function DockPanel({
  phaseKey,
  children,
}: {
  phaseKey: string;
  children: React.ReactNode;
}) {
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: motion.panelMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [phaseKey, enter]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
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
      {/* The whole title block is the way back to the archive, so it needs to
          look like a control. It used to be bare text with no glyph and no
          label — tappable, but with nothing saying so. */}
      <Pressable
        onPress={onExit}
        accessibilityRole="button"
        accessibilityLabel="Back to the incident archive"
        hitSlop={12}
        style={styles.exit}>
        <Icon name="chevron-left" size={16} color={palette.textMuted} />
        <View>
          <Text style={styles.incident}>
            INCIDENT {String(levelNumber).padStart(2, '0')}
          </Text>
          <Text style={styles.incidentTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
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
          <Icon
            name={muted ? 'sound-off' : 'sound-on'}
            size={20}
            color={palette.text}
            opacity={muted ? 0.45 : 1}
          />
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
  return <Icon name={playing ? 'pause' : 'play'} size={20} />;
}

function ActionBar({
  label,
  onPress,
  glyph,
}: {
  label: string;
  onPress: () => void;
  glyph: IconName;
}) {
  return (
    <Pressable
      style={styles.actionBar}
      accessibilityRole="button"
      onPress={onPress}>
      <Text style={styles.actionLabel}>{label}</Text>
      {/* Teal for the two glyphs that mean "go", text for pause — the same
          split the View-based glyphs had. */}
      <Icon
        name={glyph}
        size={26}
        color={glyph === 'pause' ? palette.text : palette.safe}
      />
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
        {/* record.ts emits four kinds — DOOR, SMOKE, BLOCK and FAILURE — and
            all four used to draw as the same grey dot, so "Route blocked" was
            indistinguishable from "Door closes" on the strip that exists to
            say what happened. Each now has its own silhouette. */}
        {events.map((event, i) => {
          const left = `${Math.min(100, (event.tick / Math.max(1, lastTick)) * 100)}%`;
          return (
            <View
              key={`${event.tick}-${i}`}
              style={[styles.marker, {left: left as unknown as number}]}>
              <Icon
                name={eventIcon(event.kind)}
                size={MARKER_SIZE}
                color={
                  event.kind === 'FAILURE' ? palette.danger : palette.textMuted
                }
              />
            </View>
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

/**
 * The tray, and what can be done with what is in it.
 *
 * The tray is the origin of a placement rather than a decoration: a signal is
 * dragged out of it and onto a socket, so the player's one intervention is
 * something they pick up and carry rather than something that appears where
 * they tapped. Levels with a larger budget show a chip per signal, and the
 * count says how many are left to spend without the player having to count
 * arrows on the plan.
 */
function PlacementBar({
  placed,
  budget,
  trayGesture,
  onClear,
  onReplay,
  onBack,
}: {
  placed: number;
  budget: number;
  trayGesture: ReturnType<typeof Gesture.Pan>;
  onClear: () => void;
  onReplay: () => void;
  onBack: () => void;
}) {
  const remaining = budget - placed;
  const hint =
    remaining === 0
      ? budget === 1
        ? 'Tap the signal to turn it, or clear it to move it somewhere else.'
        : 'All signals placed. Tap one to turn it, or clear to start again.'
      : placed === 0
      ? `Drag the signal onto a socket.${budget > 1 ? ` You have ${budget}.` : ''}`
      : `${remaining} signal${remaining === 1 ? '' : 's'} left. Tap a placed one to turn it.`;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitleSignal}>
          {budget === 1 ? 'PLACE ONE SIGNAL' : `PLACE ${budget} SIGNALS`}
        </Text>

        {/* Drag starts here. Every unspent signal is a chip; the last one is
            the handle, so the pile visibly shrinks as they are placed. */}
        <GestureDetector gesture={trayGesture}>
          <View style={styles.tray} accessibilityLabel="Signal tray">
            <View style={styles.trayChips}>
              {Array.from({length: budget}, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.trayChip,
                    i >= remaining && styles.trayChipSpent,
                  ]}>
                  <Icon
                    name="signal-arrow"
                    size={18}
                    color={i < remaining ? palette.signal : palette.textMuted}
                    opacity={i < remaining ? 1 : 0.5}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.trayCount}>{remaining}</Text>
          </View>
        </GestureDetector>
      </View>

      <Text style={styles.subCause}>{hint}</Text>

      <View style={styles.row}>
        <Pressable
          style={styles.secondary}
          accessibilityRole="button"
          onPress={onBack}>
          <Text style={styles.secondaryLabel}>BACK</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, placed === 0 && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{disabled: placed === 0}}
          onPress={placed > 0 ? onClear : undefined}>
          <Text style={styles.secondaryLabel}>CLEAR</Text>
        </Pressable>
        <Pressable
          style={[styles.primary, styles.grow, placed === 0 && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{disabled: placed === 0}}
          onPress={placed > 0 ? onReplay : undefined}>
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
        <Mark mark="rescue" label="RESCUE" earned={marks.rescue} />
        <Mark
          mark="flow"
          label="FLOW"
          earned={marks.flow}
          detail={`${totalWaitTicks} waiting`}
        />
        <Mark
          mark="swift"
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
  mark,
  label,
  earned,
  detail,
}: {
  mark: 'rescue' | 'flow' | 'swift';
  label: string;
  earned: boolean;
  detail?: string;
}) {
  return (
    <View style={styles.mark}>
      {/* 12 px, not the 9 px dot this replaces: below about 12 no silhouette
          holds, and three identical circles carried no meaning anyway. Earned
          and unearned are different shapes rather than one shape at two
          opacities — opacity alone vanishes in greyscale and reads as
          "loading" rather than "not yet". */}
      <Icon
        name={markIcon(mark, earned)}
        size={12}
        color={earned ? palette.safe : palette.textMuted}
      />
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
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    gap: space.md,
  },
  exit: {flexDirection: 'row', alignItems: 'center', gap: space.sm},
  incident: {
    color: palette.textMuted,
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: tracking.caps,
  },
  incidentTitle: {color: palette.text, fontSize: type.title, fontWeight: '600'},
  topRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.lg,
  },
  clock: {color: palette.text, fontSize: type.title, fontWeight: '600'},
  iconButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisabled: {opacity: state.disabledOpacity},

  map: {flex: 1, minHeight: 200},
  introOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  counter: {
    position: 'absolute',
    top: 14,
    right: 18,
    alignItems: 'flex-end',
  },
  counterText: {color: palette.text, fontSize: type.display, fontWeight: '700'},
  counterLabel: {
    color: palette.textMuted,
    fontSize: type.micro,
    fontWeight: '700',
    letterSpacing: tracking.caps,
  },

  dock: {paddingHorizontal: space.lg, paddingTop: space.md, maxHeight: '52%'},
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.panelEdge,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  actionLabel: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '700',
    letterSpacing: tracking.capsWide,
  },
  panel: {
    flexShrink: 1,
    minHeight: 0,
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.panelEdge,
    padding: space.lg,
    gap: space.md,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: palette.text,
    fontSize: type.body,
    fontWeight: '700',
    letterSpacing: tracking.capsWide,
  },
  panelTitleSignal: {
    color: palette.signal,
    fontSize: type.body,
    fontWeight: '700',
    letterSpacing: tracking.capsWide,
  },
  panelAction: {
    color: palette.textMuted,
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: tracking.caps,
  },
  cause: {color: palette.text, fontSize: type.title, lineHeight: 22, fontWeight: '600'},
  subCause: {color: palette.textMuted, fontSize: type.body, lineHeight: 19},

  panelBody: {flexShrink: 1},
  panelBodyContent: {gap: space.md, paddingBottom: space.xs},
  timeline: {gap: space.sm, paddingTop: space.xs},
  track: {
    height: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.panelEdge,
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.panelEdge,
  },
  // Centred on its tick. The dot this replaces was 9 px wide with a -4 margin
  // and a radius of 5, so it sat half a pixel off its own mark in both axes.
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    marginLeft: -MARKER_SIZE / 2,
  },
  trackLabels: {flexDirection: 'row', flexWrap: 'wrap', gap: space.md},
  trackTime: {color: palette.textMuted, fontSize: type.label},
  trackEvent: {color: palette.textMuted, fontSize: type.label},

  row: {flexDirection: 'row', gap: space.md, alignItems: 'center'},
  grow: {flex: 1},
  primary: {
    backgroundColor: palette.signal,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryLabel: {
    color: palette.shell,
    fontSize: type.body,
    fontWeight: '800',
    letterSpacing: tracking.caps,
  },
  secondary: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.panelEdge,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: palette.text,
    fontSize: type.body,
    fontWeight: '700',
    letterSpacing: tracking.caps,
  },
  disabled: {opacity: state.disabledOpacity},

  tray: {flexDirection: 'row', alignItems: 'center', gap: space.sm},
  trayChips: {flexDirection: 'row', gap: space.xs},
  trayChipSpent: {opacity: 0.5},
  trayChip: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayCount: {color: palette.signal, fontSize: type.title, fontWeight: '700'},

  outTitle: {
    color: palette.safe,
    fontSize: type.title,
    fontWeight: '800',
    letterSpacing: tracking.capsWide,
  },
  nextButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.safeDeep,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 40,
    justifyContent: 'center',
  },
  nextLabel: {
    color: palette.safe,
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: tracking.caps,
  },
  marks: {flexDirection: 'row', gap: space.xl, alignItems: 'flex-start'},
  mark: {gap: space.xs},
  markLabel: {
    color: palette.textMuted,
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: tracking.caps,
  },
  markLabelEarned: {color: palette.text},
  markDetail: {color: palette.textMuted, fontSize: type.micro},
});

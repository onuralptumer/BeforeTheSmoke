/**
 * Playback of a recorded run.
 *
 * The simulation is already finished before this runs, so playback is an index
 * into an array plus a sub-tick fraction for interpolation. Nothing here can
 * affect an outcome: dropping frames, backgrounding the app or changing speed
 * moves the playhead and never the simulation. That is what makes queue and
 * counterflow results independent of device performance.
 *
 * The playhead is one state object rather than two. It used to be a separate
 * `tickIndex` and `alpha`, each set on every animation frame, and every commit
 * re-renders GameScreen and the whole canvas tree beneath it. Holding them
 * together halves that, and lets the loop skip the commit entirely on frames
 * where neither value has visibly moved.
 */

import {useCallback, useEffect, useRef, useState} from 'react';

import {motion} from '../theme';
import {RecordedRun} from '../game/replay/record';

export type PlaybackSpeed = 1 | 2;

interface Playhead {
  tickIndex: number;
  alpha: number;
}

interface Playback {
  tickIndex: number;
  /**
   * 0..1 through the current step. Linear, per design.md §11, which asks for
   * "linear or softly eased" — the character of the movement comes from the
   * 30 ms pause at the end of each tick, not from an easing curve.
   */
  alpha: number;
  playing: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  restart: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  speed: PlaybackSpeed;
}

const START: Playhead = {tickIndex: 0, alpha: 0};

/**
 * Smallest alpha change worth a render. A person crosses one cell per tick, so
 * below roughly a hundredth of a cell there is nothing on screen to see — and
 * because alpha saturates at 1 for the last 30 ms of every tick, this also
 * drops every frame of the decision pause instead of re-rendering into it.
 */
const MIN_ALPHA_STEP = 0.01;

export function usePlayback(
  run: RecordedRun | null,
  onFinished?: () => void,
): Playback {
  const [head, setHead] = useState<Playhead>(START);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const frameRef = useRef<number | null>(null);
  const startedAt = useRef(0);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // The loop reads the playhead to resume from it, but must not be restarted
  // by its own output, so it goes through a ref rather than the dependency
  // list.
  const headRef = useRef(head);
  headRef.current = head;

  const lastFrame = run ? run.frames.length - 1 : 0;

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const restart = useCallback(() => {
    stop();
    finishedRef.current = false;
    setHead(START);
    setPlaying(false);
  }, [stop]);

  // A new recording always starts from its opening frame.
  useEffect(() => {
    restart();
  }, [run, restart]);

  useEffect(() => {
    if (!playing || !run) {
      stop();
      return;
    }

    startedAt.current =
      Date.now() - (headRef.current.tickIndex * motion.tickMs) / speed;

    const loop = () => {
      const elapsed = (Date.now() - startedAt.current) * speed;
      const index = Math.floor(elapsed / motion.tickMs);
      const within = elapsed - index * motion.tickMs;

      if (index >= lastFrame) {
        setHead({tickIndex: lastFrame, alpha: 1});
        setPlaying(false);
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinishedRef.current?.();
        }
        return;
      }

      // Movement occupies 220 ms of the 250 ms tick; the remainder is the
      // pause in which a decision visibly happens.
      const alpha = Math.min(1, within / motion.stepMs);
      const current = headRef.current;
      if (
        current.tickIndex !== index ||
        Math.abs(current.alpha - alpha) >= MIN_ALPHA_STEP
      ) {
        setHead({tickIndex: index, alpha});
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return stop;
  }, [playing, run, speed, lastFrame, stop]);

  return {
    tickIndex: head.tickIndex,
    alpha: head.alpha,
    playing,
    atEnd: head.tickIndex >= lastFrame,
    play: useCallback(() => setPlaying(true), []),
    pause: useCallback(() => setPlaying(false), []),
    restart,
    setSpeed,
    speed,
  };
}

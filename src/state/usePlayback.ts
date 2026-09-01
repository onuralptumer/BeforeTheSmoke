/**
 * Playback of a recorded run.
 *
 * The simulation is already finished before this runs, so playback is an index
 * into an array plus a sub-tick fraction for interpolation. Nothing here can
 * affect an outcome: dropping frames, backgrounding the app or changing speed
 * moves the playhead and never the simulation. That is what makes queue and
 * counterflow results independent of device performance.
 */

import {useCallback, useEffect, useRef, useState} from 'react';

import {motion} from '../theme';
import {RecordedRun} from '../game/replay/record';

export type PlaybackSpeed = 1 | 2;

interface Playback {
  tickIndex: number;
  /** 0..1 through the current step, eased for the 220 ms move. */
  alpha: number;
  playing: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  restart: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  speed: PlaybackSpeed;
}

export function usePlayback(
  run: RecordedRun | null,
  onFinished?: () => void,
): Playback {
  const [tickIndex, setTickIndex] = useState(0);
  const [alpha, setAlpha] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const frameRef = useRef<number | null>(null);
  const startedAt = useRef(0);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

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
    setTickIndex(0);
    setAlpha(0);
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

    startedAt.current = Date.now() - (tickIndex * motion.tickMs) / speed;

    const loop = () => {
      const elapsed = (Date.now() - startedAt.current) * speed;
      const index = Math.floor(elapsed / motion.tickMs);
      const within = elapsed - index * motion.tickMs;

      if (index >= lastFrame) {
        setTickIndex(lastFrame);
        setAlpha(1);
        setPlaying(false);
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinishedRef.current?.();
        }
        return;
      }

      setTickIndex(index);
      // Movement occupies 220 ms of the 250 ms tick; the remainder is the
      // pause in which a decision visibly happens.
      setAlpha(Math.min(1, within / motion.stepMs));
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return stop;
    // tickIndex is deliberately excluded: it is an output of the loop, and
    // including it would restart the loop on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, run, speed, lastFrame, stop]);

  return {
    tickIndex,
    alpha,
    playing,
    atEnd: tickIndex >= lastFrame,
    play: useCallback(() => setPlaying(true), []),
    pause: useCallback(() => setPlaying(false), []),
    restart,
    setSpeed,
    speed,
  };
}

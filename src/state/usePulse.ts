/**
 * A slow, independent clock for the socket pulse and the analysis markers.
 *
 * During analysis the playhead is stopped, so anything driven from it would sit
 * frozen. It is a presentation clock only: nothing it drives can affect an
 * outcome.
 *
 * Driven by requestAnimationFrame rather than an interval. The interval it
 * replaced fired every 66 ms against a 16.7 ms display, so each update landed a
 * different distance into a frame — four frames, then five, then four — and a
 * 1.6 s loop stepping unevenly reads as judder rather than as slowness.
 *
 * Running off the frame clock fixes the beat, but committing on every frame
 * would quadruple the renders the interval was doing, and each one re-renders
 * the whole canvas tree. So the phase is quantised: the loop looks at every
 * frame and sets state only when the value has moved a visible amount. That
 * costs about half the renders of the old interval and none of the beat.
 */

import {useEffect, useState} from 'react';

import {motion} from '../theme';

/**
 * Smallest phase change worth a render — 1/48th of the loop, so roughly 30
 * updates a second. Below this the socket scale moves less than a tenth of a
 * point and nobody can see it.
 */
const MIN_STEP = 1 / 48;

export function usePulse(active: boolean): number {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const startedAt = Date.now();
    let frame: number | null = null;
    let committed = -1;

    const loop = () => {
      const elapsed = Date.now() - startedAt;
      const next = (elapsed % motion.socketPulseMs) / motion.socketPulseMs;
      // `next` wraps to 0 once a cycle, so compare on the ring rather than by
      // magnitude — otherwise the wrap looks like a huge step and always fires.
      const moved = Math.abs(next - committed);
      if (committed < 0 || moved >= MIN_STEP) {
        committed = next;
        setPhase(next);
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [active]);

  return phase;
}

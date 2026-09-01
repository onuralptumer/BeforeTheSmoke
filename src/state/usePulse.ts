/**
 * A slow, independent clock for the socket pulse and the analysis markers.
 *
 * During analysis the playhead is stopped, so anything driven from it would
 * sit frozen. This runs at roughly 15 fps, which is plenty for a 1.6 s loop
 * and costs a fraction of a render budget that is otherwise idle. It is a
 * presentation clock only: nothing it drives can affect an outcome.
 */

import {useEffect, useRef, useState} from 'react';

import {motion} from '../theme';

const FRAME_MS = 66;

export function usePulse(active: boolean): number {
  const [phase, setPhase] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    startedAt.current = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setPhase((elapsed % motion.socketPulseMs) / motion.socketPulseMs);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [active]);

  return phase;
}

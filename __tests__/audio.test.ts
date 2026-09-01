/**
 * The audio layer.
 *
 * Two things matter here. Silence must be a complete experience — every sound
 * call has to be a no-op when there is no audio device, because the acceptance
 * criteria say nothing critical is lost with the sound off. And the internal
 * import path the module depends on has to keep existing, because reaching
 * past a package's barrel export is a coupling that must fail loudly rather
 * than at bundle time on someone's machine.
 */

import {sounds} from '../src/audio/sounds';

const nodeRequire = require as unknown as {
  resolve: (id: string) => string;
};

const AUDIO_CONTEXT_PATH = 'react-native-audio-api/src/core/AudioContext';
const resolveAudioContext = () => nodeRequire.resolve(AUDIO_CONTEXT_PATH);

describe('sounds', () => {
  it('degrades to silence when no audio context can be opened', () => {
    // jest.setup makes the constructor throw, standing in for a device that
    // cannot open one.
    expect(() => {
      sounds.signalSnap();
      sounds.rotate();
      sounds.doorClose();
      sounds.everyoneOut();
    }).not.toThrow();
  });

  it('is a no-op once muted, and can be turned back on', () => {
    sounds.setEnabled(false);
    expect(sounds.isEnabled()).toBe(false);
    expect(() => sounds.signalSnap()).not.toThrow();
    sounds.setEnabled(true);
    expect(sounds.isEnabled()).toBe(true);
  });
});

describe('audio dependency', () => {
  it('still exposes the internal AudioContext path the module imports', () => {
    // If an upgrade moves this file, fail here rather than in a red screen.
    expect(() => resolveAudioContext()).not.toThrow();
  });

  it('is pinned to an exact version, because it couples to an internal path', () => {
    const pkg = require('../package.json');
    expect(pkg.dependencies['react-native-audio-api']).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('does not resolve through the package barrel', () => {
    // The barrel re-exports AudioControls, which imports Reanimated
    // unconditionally. The module we use must sit outside that subtree.
    expect(resolveAudioContext()).toContain('core/AudioContext');
    expect(resolveAudioContext()).not.toContain('Audio/controls');
  });
});

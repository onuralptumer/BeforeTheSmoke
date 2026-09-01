/**
 * Native module stand-ins for the headless test environment.
 *
 * The simulation tests need none of this — the engine imports no React and no
 * native code, which is the point. This exists only so the App smoke test can
 * mount the real screens.
 */

require('react-native-gesture-handler/jestSetup');
require('@shopify/react-native-skia/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(key => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key, value) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn(key => {
        store.delete(key);
        return Promise.resolve();
      }),
    },
  };
});

// No audio device under test. Throwing here also exercises the graceful
// degradation path: the game must be complete in silence.
jest.mock('react-native-audio-api/src/core/AudioContext', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    throw new Error('no audio device in tests');
  }),
}));

jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: {trigger: jest.fn()},
  HapticFeedbackTypes: new Proxy({}, {get: (_, name) => String(name)}),
}));

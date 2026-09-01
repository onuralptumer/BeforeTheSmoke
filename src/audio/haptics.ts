/**
 * Haptics communicate decisions and thresholds, never continuous simulation
 * activity. There is deliberately no per-step, per-smoke-tick or per-frame
 * trigger here — the API simply does not expose one.
 */

import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
};

const fire = (type: HapticFeedbackTypes) => {
  try {
    ReactNativeHapticFeedback.trigger(type, options);
  } catch {
    // A device without haptics is a supported device.
  }
};

export const haptics = {
  /** Dragging the signal over an eligible socket. */
  socketHover: () => fire(HapticFeedbackTypes.impactLight),
  /** The signal seats into a socket. */
  signalSnap: () => fire(HapticFeedbackTypes.impactMedium),
  /** Rotating through valid directions. */
  rotate: () => fire(HapticFeedbackTypes.selection),
  /** Someone first reaches exposure 3, one step from incapacitation. */
  hazardThreshold: () => fire(HapticFeedbackTypes.notificationWarning),
  everyoneOut: () => fire(HapticFeedbackTypes.notificationSuccess),
  failure: () => fire(HapticFeedbackTypes.notificationError),
};

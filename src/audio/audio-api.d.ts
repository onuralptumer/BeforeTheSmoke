/**
 * The slice of react-native-audio-api this game uses.
 *
 * Declared locally rather than resolved from the package: `sounds.ts` imports
 * an internal module path (see the comment there), and letting TypeScript
 * follow it would pull the dependency's own untyped source into this
 * project's compile. Declaring the surface keeps the type check honest about
 * what we actually call, and nothing more.
 */

declare module 'react-native-audio-api/src/core/AudioContext' {
  export interface AudioParamLike {
    value: number;
    setValueAtTime(value: number, startTime: number): AudioParamLike;
    linearRampToValueAtTime(value: number, endTime: number): AudioParamLike;
    exponentialRampToValueAtTime(
      value: number,
      endTime: number,
    ): AudioParamLike;
  }

  export interface AudioNodeLike {
    connect(destination: AudioNodeLike): void;
    disconnect(): void;
  }

  export interface OscillatorNodeLike extends AudioNodeLike {
    type: string;
    readonly frequency: AudioParamLike;
    start(when?: number): void;
    stop(when?: number): void;
  }

  export interface GainNodeLike extends AudioNodeLike {
    readonly gain: AudioParamLike;
  }

  export default class AudioContext {
    readonly currentTime: number;
    readonly destination: AudioNodeLike;
    createOscillator(): OscillatorNodeLike;
    createGain(): GainNodeLike;
    close(): Promise<void>;
  }
}

import type { Hand, HandState, Landmark, NormalizedLandmark } from '../vision/types';
import { HAND_LANDMARKS } from '../vision/types';

export abstract class InputDeviceInterface {
  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract isRunning(): boolean;
  abstract getHandState(): HandState;
  abstract getFrame(): ImageData | null;
  abstract dispose(): void;
  abstract canAccessCamera(): Promise<boolean>;
  abstract onFrame(callback: (state: HandState) => void): () => void;
}

export type { Hand, HandState, Landmark, NormalizedLandmark };
export { HAND_LANDMARKS };

export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export type HandLandmarkName = keyof typeof HAND_LANDMARKS;
export type HandLandmarkIndex = (typeof HAND_LANDMARKS)[HandLandmarkName];

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
  depth?: number;
}

export interface NormalizedLandmark extends Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export interface Finger {
  mcp: Landmark;
  pip: Landmark;
  dip: Landmark;
  tip: Landmark;
  extended: boolean;
  length: number;
}

export interface HandOrientation {
  pitch: number;
  yaw: number;
  roll: number;
  normal: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
}

export interface Hand {
  id: string;
  handedness: 'Left' | 'Right';
  confidence: number;
  landmarks: Landmark[];
  normalized: NormalizedLandmark[];
  wrist: Landmark;
  thumb: Finger;
  index: Finger;
  middle: Finger;
  ring: Finger;
  pinky: Finger;
  palmCenter: Landmark;
  palmNormal: { x: number; y: number; z: number };
  orientation: HandOrientation;
  isValid: boolean;
  timestamp: number;
}

export interface HandState {
  hands: Hand[];
  handCount: number;
  leftHand: Hand | null;
  rightHand: Hand | null;
  hasTwoHands: boolean;
  timestamp: number;
  confidence: number;
  tracked: boolean;
}

export type GestureType =
  | 'POINTING'
  | 'PINCH'
  | 'GRAB'
  | 'OPEN_PALM'
  | 'FIST'
  | 'TWO_FINGER'
  | 'THREE_FINGER'
  | 'SWIPE_LEFT'
  | 'SWIPE_RIGHT'
  | 'SWIPE_UP'
  | 'SWIPE_DOWN'
  | 'PALM_ROTATION'
  | 'TWO_HAND_SCALE'
  | 'TWO_HAND_GRAB'
  | 'IDLE';

export type GestureStateType =
  | 'IDLE'
  | 'HAND_DETECTED'
  | 'POINTING'
  | 'HOVERING_OBJECT'
  | 'PINCH_START'
  | 'PINCH_HOLD'
  | 'TRANSFORMING'
  | 'PINCH_RELEASE'
  | 'SELECTED';

export interface GestureRecognition {
  type: GestureType;
  confidence: number;
  state: GestureStateType;
  stableFrames: number;
  pinchDistance?: number;
  handDistance?: number;
  swipeDirection?: { x: number; y: number; z: number };
  rotationDelta?: { pitch: number; yaw: number; roll: number };
  timestamp: number;
}

export interface CalibrationData {
  handedness: 'Left' | 'Right' | 'unknown';
  handSize: number;
  pinchThreshold: number;
  grabThreshold: number;
  movementSensitivity: number;
  rotationSensitivity: number;
  depthSensitivity: number;
  swipeThreshold: number;
  createdAt: number;
}

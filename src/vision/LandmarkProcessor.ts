import type { Hand, HandState, Landmark, NormalizedLandmark, FingerName, HandOrientation } from './types';
import { HAND_LANDMARKS } from './types';
import { InputDeviceInterface } from '../interaction/InputDeviceInterface';

const FINGER_INDICES: Record<FingerName, [number, number, number, number]> = {
  thumb: [
    HAND_LANDMARKS.THUMB_CMC,
    HAND_LANDMARKS.THUMB_MCP,
    HAND_LANDMARKS.THUMB_IP,
    HAND_LANDMARKS.THUMB_TIP,
  ],
  index: [
    HAND_LANDMARKS.INDEX_MCP,
    HAND_LANDMARKS.INDEX_PIP,
    HAND_LANDMARKS.INDEX_DIP,
    HAND_LANDMARKS.INDEX_TIP,
  ],
  middle: [
    HAND_LANDMARKS.MIDDLE_MCP,
    HAND_LANDMARKS.MIDDLE_PIP,
    HAND_LANDMARKS.MIDDLE_DIP,
    HAND_LANDMARKS.MIDDLE_TIP,
  ],
  ring: [
    HAND_LANDMARKS.RING_MCP,
    HAND_LANDMARKS.RING_PIP,
    HAND_LANDMARKS.RING_DIP,
    HAND_LANDMARKS.RING_TIP,
  ],
  pinky: [
    HAND_LANDMARKS.PINKY_MCP,
    HAND_LANDMARKS.PINKY_PIP,
    HAND_LANDMARKS.PINKY_DIP,
    HAND_LANDMARKS.PINKY_TIP,
  ],
};

const LANDMARK_COUNT = 21;

type RawLandmark = { x: number; y: number; z: number; visibility?: number };
type RawHand = {
  landmarks: RawLandmark[];
  handedness: string;
  score: number;
};

interface SmoothingState {
  smoothed: NormalizedLandmark[];
  initialized: boolean;
}

function vec3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

function length(v: { x: number; y: number; z: number }) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: { x: number; y: number; z: number }) {
  const l = length(v);
  return l > 0 ? { x: v.x / l, y: v.y / l, z: v.z / l } : { x: 0, y: 0, z: 0 };
}

function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function subtract(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpLandmark(a: NormalizedLandmark, b: NormalizedLandmark, t: number): NormalizedLandmark {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    visibility: lerp(a.visibility, b.visibility, t),
  };
}

function exponentialSmooth(
  prev: NormalizedLandmark[],
  curr: NormalizedLandmark[],
  factor: number
): NormalizedLandmark[] {
  if (prev.length !== curr.length) return curr;
  return curr.map((lm, i) => lerpLandmark(prev[i], lm, factor));
}

function oneEuroFilter(
  prev: NormalizedLandmark,
  curr: NormalizedLandmark,
  factor: number,
  minCutoff = 0.1,
  beta = 0.1
): NormalizedLandmark {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  const dz = curr.z - prev.z;
  
  const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  const cutoff = minCutoff + beta * speed;
  const dFactor = cutoff / 2;
  
  const t = Math.min(1, Math.max(0, factor + dFactor));
  
  return {
    x: prev.x + t * dx,
    y: prev.y + t * dy,
    z: prev.z + t * dz,
    visibility: curr.visibility,
  };
}

export class LandmarkProcessor {
  private static instances = 0;
  private instanceId = ++LandmarkProcessor.instances;
  
  smoothLandmarks(
    prev: NormalizedLandmark[] | null,
    curr: RawLandmark[],
    method: 'exponential' | 'one-euro' | 'kalman',
    factor: number
  ): NormalizedLandmark[] {
    if (!curr || curr.length === 0) return [];
    if (!prev || prev.length === 0) {
      return curr.map(this.normalizeRaw);
    }
    
    const normalized = curr.map(this.normalizeRaw);
    
    switch (method) {
      case 'exponential':
        return exponentialSmooth(prev, normalized, factor);
      case 'one-euro': {
        if (prev.length !== normalized.length) return normalized;
        return normalized.map((lm, i) => oneEuroFilter(prev[i], lm, factor));
      }
      case 'kalman':
        return this.kalmanSmooth(prev, normalized, factor);
      default:
        return exponentialSmooth(prev, normalized, factor);
    }
  }
  
  private normalizeRaw = (lm: RawLandmark): NormalizedLandmark => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: lm.visibility ?? 1,
  });
  
  private kalmanSmooth(prev: NormalizedLandmark[], curr: NormalizedLandmark[], factor: number): NormalizedLandmark[] {
    const processNoise = 0.1;
    const measurementNoise = 0.5;
    const kalmanGain = 1 / (1 + measurementNoise);
    
    return curr.map((lm, i) => {
      if (i >= prev.length) return lm;
      return {
        x: prev[i].x + kalmanGain * (lm.x - prev[i].x) * factor,
        y: prev[i].y + kalmanGain * (lm.y - prev[i].y) * factor,
        z: prev[i].z + kalmanGain * (lm.z - prev[i].z) * factor,
        visibility: lm.visibility,
      };
    });
  }
  
  computeFingerExtended(landmarks: NormalizedLandmark[], finger: FingerName): boolean {
    const [mcp, pip, dip, tip] = FINGER_INDICES[finger];
    
    if (finger === 'thumb') {
      return this.isThumbExtended(landmarks, mcp, tip);
    }
    
    const mcpLm = landmarks[mcp];
    const pipLm = landmarks[pip];
    const tipLm = landmarks[tip];
    const dipLm = landmarks[dip];
    
    if (!mcpLm || !pipLm || !tipLm || !dipLm) return false;
    
    const anglePip = this.computeJointAngle(mcpLm, pipLm, tipLm, dipLm);
    return anglePip > 2.5;
  }
  
  private isThumbExtended(landmarks: NormalizedLandmark[], mcp: number, tip: number): boolean {
    const mcpLm = landmarks[mcp];
    const tipLm = landmarks[tip];
    const wrist = landmarks[HAND_LANDMARKS.WRIST];
    const indexMcp = landmarks[HAND_LANDMARKS.INDEX_MCP];
    const middleMcp = landmarks[HAND_LANDMARKS.MIDDLE_MCP];
    
    if (!mcpLm || !tipLm || !wrist || !indexMcp || !middleMcp) return false;
    
    const cmcLm = landmarks[HAND_LANDMARKS.THUMB_CMC];
    if (!cmcLm) return false;
    
    const thumbVec = subtract(tipLm, cmcLm);
    const palmVec = subtract(middleMcp, wrist);
    
    const thumbLength = length(thumbVec);
    const palmLength = length(palmVec);
    
    if (thumbLength < 0.01 || palmLength < 0.01) return false;
    
    const dotProduct = dot(normalize(thumbVec), normalize(palmVec));
    return dotProduct > 0.6;
  }
  
  computeFingerLength(landmarks: NormalizedLandmark[], finger: FingerName): number {
    const [mcp] = FINGER_INDICES[finger];
    const [, , , tip] = FINGER_INDICES[finger];
    
    const mcpLm = landmarks[mcp];
    const tipLm = landmarks[tip];
    
    if (!mcpLm || !tipLm) return 0;
    
    return length(subtract(tipLm, mcpLm));
  }
  
  private computeJointAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark, d?: NormalizedLandmark): number {
    const v1 = subtract(b, a);
    const v2 = subtract(c, b);
    const n1 = normalize(v1);
    const n2 = normalize(v2);
    const cosAngle = dot(n1, n2);
    return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  }
  
  computePinchDistance(landmarks: NormalizedLandmark[]): number {
    const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
    
    if (!thumbTip || !indexTip) return Infinity;
    
    return length(subtract(indexTip, thumbTip));
  }
  
  computePalmCenter(landmarks: NormalizedLandmark[]): NormalizedLandmark {
    const indices = [
      HAND_LANDMARKS.WRIST,
      HAND_LANDMARKS.INDEX_MCP,
      HAND_LANDMARKS.MIDDLE_MCP,
      HAND_LANDMARKS.RING_MCP,
      HAND_LANDMARKS.PINKY_MCP,
    ];
    
    let x = 0, y = 0, z = 0;
    let count = 0;
    
    for (const i of indices) {
      const lm = landmarks[i];
      if (lm) {
        x += lm.x;
        y += lm.y;
        z += lm.z;
        count++;
      }
    }
    
    return {
      x: x / count,
      y: y / count,
      z: z / count,
      visibility: 1,
    };
  }
  
  computePalmNormal(landmarks: NormalizedLandmark[]): { x: number; y: number; z: number } {
    const wrist = landmarks[HAND_LANDMARKS.WRIST];
    const indexMcp = landmarks[HAND_LANDMARKS.INDEX_MCP];
    const pinkyMcp = landmarks[HAND_LANDMARKS.PINKY_MCP];
    const middleMcp = landmarks[HAND_LANDMARKS.MIDDLE_MCP];
    const ringMcp = landmarks[HAND_LANDMARKS.RING_MCP];
    
    if (!wrist || !indexMcp || !pinkyMcp || !middleMcp || !ringMcp) {
      return { x: 0, y: 0, z: 1 };
    }
    
    const v1 = subtract(indexMcp, wrist);
    const v2 = subtract(pinkyMcp, wrist);
    const n = cross(v1, v2);
    const len = length(n);
    
    return len > 0 ? { x: n.x / len, y: n.y / len, z: n.z / len } : { x: 0, y: 0, z: 1 };
  }
  
  computeWristOrientation(landmarks: NormalizedLandmark[]): HandOrientation {
    const wrist = landmarks[HAND_LANDMARKS.WRIST];
    const indexMcp = landmarks[HAND_LANDMARKS.INDEX_MCP];
    const middleMcp = landmarks[HAND_LANDMARKS.MIDDLE_MCP];
    const ringMcp = landmarks[HAND_LANDMARKS.RING_MCP];
    const pinkyMcp = landmarks[HAND_LANDMARKS.PINKY_MCP];
    
    if (!wrist || !indexMcp || !middleMcp || !ringMcp || !pinkyMcp) {
      return {
        pitch: 0,
        yaw: 0,
        roll: 0,
        normal: { x: 0, y: 0, z: 1 },
        direction: { x: 0, y: 1, z: 0 },
      };
    }
    
    const palmNormal = this.computePalmNormal(landmarks);
    const palmVec = subtract(middleMcp, wrist);
    const palmDir = normalize(palmVec);
    
    const pitch = Math.asin(-palmDir.y);
    const yaw = Math.atan2(palmDir.x, palmDir.z);
    const roll = Math.atan2(palmNormal.x, palmNormal.y);
    
    return {
      pitch,
      yaw,
      roll,
      normal: palmNormal,
      direction: palmDir,
    };
  }
  
  buildHand(
    raw: RawHand,
    prevLandmarks: NormalizedLandmark[] | null,
    smoothingMethod: 'exponential' | 'one-euro' | 'kalman',
    smoothingFactor: number,
    handedness: 'Left' | 'Right'
  ): Hand {
    const smoothed = this.smoothLandmarks(prevLandmarks, raw.landmarks, smoothingMethod, smoothingFactor);
    
    const thumb = this.buildFinger(smoothed, 'thumb');
    const index = this.buildFinger(smoothed, 'index');
    const middle = this.buildFinger(smoothed, 'middle');
    const ring = this.buildFinger(smoothed, 'ring');
    const pinky = this.buildFinger(smoothed, 'pinky');
    
    const palmCenter = this.computePalmCenter(smoothed);
    const palmNormal = this.computePalmNormal(smoothed);
    const orientation = this.computeWristOrientation(smoothed);
    
    return {
      id: raw.handedness + '_' + this.instanceId + '_' + Date.now(),
      handedness,
      confidence: raw.score,
      landmarks: smoothed,
      normalized: smoothed,
      wrist: smoothed[HAND_LANDMARKS.WRIST],
      thumb,
      index,
      middle,
      ring,
      pinky,
      palmCenter,
      palmNormal,
      orientation,
      isValid: smoothed.length === LANDMARK_COUNT,
      timestamp: Date.now(),
    };
  }
  
  private buildFinger(landmarks: NormalizedLandmark[], finger: FingerName) {
    const [mcp, pip, dip, tip] = FINGER_INDICES[finger];
    return {
      mcp: landmarks[mcp],
      pip: landmarks[pip],
      dip: landmarks[dip],
      tip: landmarks[tip],
      extended: this.computeFingerExtended(landmarks, finger),
      length: this.computeFingerLength(landmarks, finger),
    };
  }
}

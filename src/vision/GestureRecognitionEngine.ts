import type { Hand, GestureRecognition, GestureType, NormalizedLandmark, FingerName } from './types';
import { HAND_LANDMARKS } from './types';
import { LandmarkProcessor } from './LandmarkProcessor';

export interface GestureConfig {
  pinchThreshold: number;
  grabThreshold: number;
  stabilityFrames: number;
  hysteresisFrames: number;
  swipeThreshold: number;
  rotationSensitivity: number;
  scaleSpeed: number;
}

export interface GestureFrameData {
  indexTip: { x: number; y: number; z: number } | null;
  thumbTip: { x: number; y: number; z: number } | null;
  middleTip: { x: number; y: number; z: number } | null;
  palmCenter: { x: number; y: number; z: number } | null;
  wrist: { x: number; y: number; z: number } | null;
  fingersExtended: number;
  pinchDistance: number;
  grabDistance: number;
  orientation: { pitch: number; yaw: number; roll: number };
  timestamp: number;
}

export class GestureRecognitionEngine {
  private config: GestureConfig;
  private processor: LandmarkProcessor;
  private frameHistory: GestureFrameData[] = [];
  private gestureHistory: Map<string, GestureType> = new Map();
  private stabilityCounters: Map<GestureType, number> = new Map();
  private currentGesture: GestureType = 'IDLE';
  private stableGesture: GestureType = 'IDLE';
  private lastStableGesture: GestureType = 'IDLE';
  private transitionCounter = 0;
  private lastPinchTime = 0;
  private pinchActive = false;
  private lastSwipeTime = 0;
  private debug = false;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = {
      pinchThreshold: 40,
      grabThreshold: 60,
      stabilityFrames: 3,
      hysteresisFrames: 5,
      swipeThreshold: 50,
      rotationSensitivity: 1.0,
      scaleSpeed: 0.01,
      ...config,
    };
    this.processor = new LandmarkProcessor();
  }

  updateConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  private computeFrameData(hand: Hand): GestureFrameData {
    const lm = hand.landmarks;

    const indexTip = lm[HAND_LANDMARKS.INDEX_TIP] || null;
    const thumbTip = lm[HAND_LANDMARKS.THUMB_TIP] || null;
    const middleTip = lm[HAND_LANDMARKS.MIDDLE_TIP] || null;
    
    const palmCenter = hand.palmCenter;
    const wrist = lm[HAND_LANDMARKS.WRIST] || null;
    
    let fingersExtended = 0;
    const fingers: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const f of fingers) {
      if ((hand as any)[f].extended) fingersExtended++;
    }
    
    const pinchDistance = this.processor.computePinchDistance(lm as NormalizedLandmark[]);
    const grabDistance = this.computeGrabDistance(lm as NormalizedLandmark[]);
    
    const orientation = hand.orientation;
    
    return {
      indexTip: indexTip ? { x: indexTip.x, y: indexTip.y, z: indexTip.z } : null,
      thumbTip: thumbTip ? { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z } : null,
      middleTip: middleTip ? { x: middleTip.x, y: middleTip.y, z: middleTip.z } : null,
      palmCenter: palmCenter ? { x: palmCenter.x, y: palmCenter.y, z: palmCenter.z } : null,
      wrist: wrist ? { x: wrist.x, y: wrist.y, z: wrist.z } : null,
      fingersExtended,
      pinchDistance,
      grabDistance,
      orientation: {
        pitch: orientation.pitch,
        yaw: orientation.yaw,
        roll: orientation.roll,
      },
      timestamp: Date.now(),
    };
  }

  private computeGrabDistance(lm: NormalizedLandmark[]): number {
    const tipIndices = [
      HAND_LANDMARKS.THUMB_TIP,
      HAND_LANDMARKS.INDEX_TIP,
      HAND_LANDMARKS.MIDDLE_TIP,
      HAND_LANDMARKS.RING_TIP,
      HAND_LANDMARKS.PINKY_TIP,
    ];
    
    const tips = tipIndices.map(i => lm[i]).filter(t => t !== undefined);
    if (tips.length < 2) return 0;
    
    const palmCenter = tips.reduce(
      (acc, lm) => {
        acc.x += lm.x;
        acc.y += lm.y;
        acc.z += lm.z;
        return acc;
      },
      { x: 0, y: 0, z: 0 }
    );
    
    const count = tips.length;
    palmCenter.x /= count;
    palmCenter.y /= count;
    palmCenter.z /= count;
    
    let totalDist = 0;
    for (const tip of tips) {
      const dx = tip.x - palmCenter.x;
      const dy = tip.y - palmCenter.y;
      const dz = tip.z - palmCenter.z;
      totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    return totalDist / count * 1000;
  }

  recognize(hands: Hand[]): GestureRecognition {
    if (hands.length === 0) {
      return this.createIdleRecognition();
    }
    
    const primaryHand = hands.find(h => h.handedness === 'Right') || hands.find(h => h.handedness === 'Left') || hands[0];
    const frameData = this.computeFrameData(primaryHand);
    
    this.frameHistory.push(frameData);
    if (this.frameHistory.length > 30) {
      this.frameHistory.shift();
    }
    
    const rawGesture = this.detectGesture(frameData, primaryHand);
    this.currentGesture = rawGesture;

    const { stable, confidence } = this.applyStability(rawGesture);
    this.stableGesture = stable;

    const state = this.computeState(stable, primaryHand);
    this.lastStableGesture = stable;

    const result: GestureRecognition = {
      type: stable,
      confidence,
      state,
      stableFrames: this.stabilityCounters.get(stable) || 0,
      pinchDistance: frameData.pinchDistance,
      timestamp: Date.now(),
    };
    
    if (hands.length >= 2) {
      const left = hands.find(h => h.handedness === 'Left');
      const right = hands.find(h => h.handedness === 'Right');
      if (left && right) {
        const dist = this.computeHandDistance(left, right);
        result.handDistance = dist;
        if (stable === 'PINCH' && dist < 200) {
          result.type = 'TWO_HAND_GRAB';
        } else if (stable === 'OPEN_PALM' && dist > 200) {
          result.type = 'TWO_HAND_SCALE';
        }
      }
    }
    
    return result;
  }

  private detectGesture(data: GestureFrameData, hand: Hand): GestureType {
    const { fingersExtended, pinchDistance, grabDistance } = data;
    
    const pinchNorm = pinchDistance * 1000;
    const grabNorm = grabDistance;
    
    if (pinchNorm < this.config.pinchThreshold * 0.5 && grabNorm < this.config.grabThreshold * 0.8) {
      if (fingersExtended <= 2) {
        return 'PINCH';
      }
    }
    
    if (grabNorm < this.config.grabThreshold * 0.7) {
      return 'GRAB';
    }
    
    if (pinchNorm < this.config.pinchThreshold) {
      return 'PINCH';
    }
    
    if (fingersExtended === 1 && hand.index.extended) {
      return 'POINTING';
    }
    
    if (fingersExtended >= 4) {
      return 'OPEN_PALM';
    }
    
    if (fingersExtended === 2 && hand.index.extended && hand.middle.extended) {
      return 'TWO_FINGER';
    }
    
    if (fingersExtended === 3 && hand.index.extended && hand.middle.extended && hand.ring.extended) {
      return 'THREE_FINGER';
    }
    
    if (fingersExtended === 0) {
      return 'FIST';
    }
    
    const swipe = this.detectSwipe();
    if (swipe) return swipe;
    
    return 'IDLE';
  }

  private detectSwipe(): GestureType | null {
    if (this.frameHistory.length < 10) return null;
    if (Date.now() - this.lastSwipeTime < 300) return null;
    
    const recent = this.frameHistory.slice(-10);
    
    const start = recent[0];
    const end = recent[9];
    
    if (!start.indexTip || !end.indexTip) return null;
    
    const dx = (end.indexTip.x - start.indexTip.x) * 1000;
    const dy = (end.indexTip.y - start.indexTip.y) * 1000;
    
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < this.config.swipeThreshold) return null;
    
    const angle = Math.atan2(dy, dx);
    const absAngle = Math.abs(angle);
    
    if (absAngle < Math.PI / 4) {
      this.lastSwipeTime = Date.now();
      return 'SWIPE_RIGHT';
    } else if (absAngle > 3 * Math.PI / 4) {
      this.lastSwipeTime = Date.now();
      return 'SWIPE_LEFT';
    } else if (angle > 0) {
      this.lastSwipeTime = Date.now();
      return 'SWIPE_DOWN';
    } else {
      this.lastSwipeTime = Date.now();
      return 'SWIPE_UP';
    }
  }

  private applyStability(gesture: GestureType): { stable: GestureType; confidence: number } {
    const counter = (this.stabilityCounters.get(gesture) || 0) + 1;
    this.stabilityCounters.set(gesture, counter);
    
    for (const [k, v] of this.stabilityCounters) {
      if (k !== gesture) {
        const newV = Math.max(0, v - 1);
        if (newV === 0) {
          this.stabilityCounters.delete(k);
        } else {
          this.stabilityCounters.set(k, newV);
        }
      }
    }
    
    const stable = counter >= this.config.stabilityFrames ? gesture : this.stableGesture;
    
    const confidence = Math.min(1, counter / this.config.stabilityFrames);
    
    return { stable, confidence };
  }

  private computeState(gesture: GestureType, hand: Hand): GestureRecognition['state'] {
    void hand;
    switch (gesture) {
      case 'IDLE':
        if (this.pinchActive && this.lastStableGesture === 'PINCH') {
          this.pinchActive = false;
          return 'PINCH_RELEASE';
        }
        return 'IDLE';
      case 'POINTING':
        if (this.pinchActive && this.lastStableGesture === 'PINCH') {
          this.pinchActive = false;
          return 'PINCH_RELEASE';
        }
        return 'POINTING';
      case 'PINCH':
      case 'GRAB':
      case 'FIST':
        if (!this.pinchActive) {
          this.pinchActive = true;
          this.lastPinchTime = Date.now();
          return 'PINCH_START';
        }
        return 'PINCH_HOLD';
      case 'OPEN_PALM':
        if (this.pinchActive) {
          this.pinchActive = false;
          return 'PINCH_RELEASE';
        }
        return 'IDLE';
      default:
        if (this.pinchActive && this.lastStableGesture === 'PINCH') {
          this.pinchActive = false;
          return 'PINCH_RELEASE';
        }
        return 'TRANSFORMING';
    }
  }

  private computeHandDistance(hand1: Hand, hand2: Hand): number {
    const p1 = hand1.palmCenter;
    const p2 = hand2.palmCenter;
    
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000;
  }

  private createIdleRecognition(): GestureRecognition {
    this.pinchActive = false;
    for (const [k, v] of this.stabilityCounters) {
      this.stabilityCounters.set(k, Math.max(0, v - 1));
    }
    return {
      type: 'IDLE',
      confidence: 0,
      state: 'IDLE',
      stableFrames: 0,
      pinchDistance: 0,
      timestamp: Date.now(),
    };
  }

  getFrameHistory(): GestureFrameData[] {
    return [...this.frameHistory];
  }

  getCurrentGesture(): GestureType {
    return this.currentGesture;
  }

  getStableGesture(): GestureType {
    return this.stableGesture;
  }

  reset(): void {
    this.frameHistory = [];
    this.stabilityCounters.clear();
    this.currentGesture = 'IDLE';
    this.stableGesture = 'IDLE';
    this.pinchActive = false;
    this.transitionCounter = 0;
    this.lastPinchTime = 0;
    this.lastSwipeTime = 0;
  }
}

export default GestureRecognitionEngine;

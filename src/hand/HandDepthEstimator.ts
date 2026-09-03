import type { Hand } from '../vision/types';
import { HAND_LANDMARKS } from '../vision/types';

export type DepthConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DepthResult {
  depth: number;
  confidence: number;
  confidenceLabel: DepthConfidence;
  stdZ: number;
  meanZ: number;
}

export class HandDepthEstimator {
  private interactionDistance: number = 8;
  private depthHistory: number[] = [];
  private readonly SMOOTHING_FRAMES = 8;
  private readonly DEPTH_RANGE = 0.3;

  setInteractionDistance(distance: number): void {
    this.interactionDistance = Math.max(0.1, distance);
  }

  getInteractionDistance(): number {
    return this.interactionDistance;
  }

  estimate(hand: Hand): DepthResult {
    const lm = hand.landmarks;
    if (!lm || lm.length < 21) {
      return {
        depth: this.interactionDistance,
        confidence: 0,
        confidenceLabel: 'LOW',
        stdZ: 0,
        meanZ: 0,
      };
    }

    const zValues: number[] = [];
    const landmarksToCheck = [
      lm[HAND_LANDMARKS.WRIST],
      lm[HAND_LANDMARKS.INDEX_MCP],
      lm[HAND_LANDMARKS.INDEX_PIP],
      lm[HAND_LANDMARKS.INDEX_DIP],
      lm[HAND_LANDMARKS.INDEX_TIP],
      lm[HAND_LANDMARKS.MIDDLE_MCP],
      lm[HAND_LANDMARKS.MIDDLE_PIP],
      lm[HAND_LANDMARKS.MIDDLE_DIP],
      lm[HAND_LANDMARKS.MIDDLE_TIP],
      lm[HAND_LANDMARKS.RING_MCP],
      lm[HAND_LANDMARKS.RING_PIP],
      lm[HAND_LANDMARKS.RING_DIP],
      lm[HAND_LANDMARKS.RING_TIP],
      lm[HAND_LANDMARKS.PINKY_MCP],
      lm[HAND_LANDMARKS.PINKY_PIP],
      lm[HAND_LANDMARKS.PINKY_DIP],
      lm[HAND_LANDMARKS.PINKY_TIP],
      lm[HAND_LANDMARKS.THUMB_TIP],
    ];

    for (const lm of landmarksToCheck) {
      if (lm && typeof lm.z === 'number' && !isNaN(lm.z)) {
        zValues.push(lm.z);
      }
    }

    if (zValues.length < 5) {
      return {
        depth: this.interactionDistance,
        confidence: 0,
        confidenceLabel: 'LOW',
        stdZ: 0,
        meanZ: 0,
      };
    }

    const meanZ = zValues.reduce((a, b) => a + b, 0) / zValues.length;
    const stdZ = Math.sqrt(zValues.reduce((s, z) => s + Math.pow(z - meanZ, 2), 0) / zValues.length);

    const clampedZ = Math.max(-this.DEPTH_RANGE, Math.min(this.DEPTH_RANGE, meanZ));
    const rawDepth = this.interactionDistance + clampedZ * 5;

    this.depthHistory.push(rawDepth);
    if (this.depthHistory.length > this.SMOOTHING_FRAMES) {
      this.depthHistory.shift();
    }

    const smoothedDepth = this.depthHistory.reduce((a, b) => a + b, 0) / this.depthHistory.length;

    const confidence = Math.max(0, Math.min(1, 1 - stdZ * 20));

    let confidenceLabel: DepthConfidence;
    if (confidence < 0.3) confidenceLabel = 'LOW';
    else if (confidence < 0.7) confidenceLabel = 'MEDIUM';
    else confidenceLabel = 'HIGH';

    return {
      depth: smoothedDepth,
      confidence,
      confidenceLabel,
      stdZ,
      meanZ,
    };
  }

  reset(): void {
    this.depthHistory = [];
  }

  getConfidenceLabel(): DepthConfidence {
    if (this.depthHistory.length < 3) return 'LOW';
    if (this.depthHistory.length < this.SMOOTHING_FRAMES) return 'MEDIUM';
    return 'HIGH';
  }
}

export default HandDepthEstimator;

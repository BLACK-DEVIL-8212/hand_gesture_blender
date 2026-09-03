import * as THREE from 'three';
import type { Hand } from '../vision/types';
import { HAND_LANDMARKS } from '../vision/types';

export interface Hand3DData {
  worldPosition: THREE.Vector3;
  worldNormal: THREE.Vector3;
  screenX: number;
  screenY: number;
  ndcX: number;
  ndcY: number;
  depth: number;
  depthConfidence: number;
  orientation: { pitch: number; yaw: number; roll: number };
  pinchDistance: number;
  confidence: number;
  isValid: boolean;
}

export class Hand3DController {
  private camera: THREE.PerspectiveCamera | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  private viewportWidth: number = 1;
  private viewportHeight: number = 1;

  private interactionDistance: number = 8;

  private lastDepth: number = 8;
  private depthHistory: number[] = [];
  private readonly DEPTH_SMOOTHING_FRAMES = 5;

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  setInteractionDistance(distance: number): void {
    this.interactionDistance = Math.max(0.1, distance);
  }

  getInteractionDistance(): number {
    return this.interactionDistance;
  }

  private screenToNDC(x: number, y: number): THREE.Vector2 {
    const ndcX = (x / this.viewportWidth) * 2 - 1;
    const ndcY = -(y / this.viewportHeight) * 2 + 1;
    return new THREE.Vector2(ndcX, ndcY);
  }

  getIndexTipNDC(hand: Hand): THREE.Vector2 | null {
    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return null;
    return this.screenToNDC(tip.x * this.viewportWidth, tip.y * this.viewportHeight);
  }

  estimateDepth(hand: Hand): { depth: number; confidence: number } {
    const lm = hand.landmarks;
    if (!lm || lm.length < 21) return { depth: this.interactionDistance, confidence: 0 };

    const wrist = lm[HAND_LANDMARKS.WRIST];
    const indexTip = lm[HAND_LANDMARKS.INDEX_TIP];
    const middleTip = lm[HAND_LANDMARKS.MIDDLE_TIP];
    const ringTip = lm[HAND_LANDMARKS.RING_TIP];
    const pinkyTip = lm[HAND_LANDMARKS.PINKY_TIP];
    const indexMcp = lm[HAND_LANDMARKS.INDEX_MCP];
    const middleMcp = lm[HAND_LANDMARKS.MIDDLE_MCP];
    const ringMcp = lm[HAND_LANDMARKS.RING_MCP];
    const pinkyMcp = lm[HAND_LANDMARKS.PINKY_MCP];
    const thumbTip = lm[HAND_LANDMARKS.THUMB_TIP];

    const zValues: number[] = [];
    const landmarksToCheck = [wrist, indexTip, middleTip, ringTip, pinkyTip, indexMcp, middleMcp, ringMcp, pinkyMcp, thumbTip];
    for (const lm of landmarksToCheck) {
      if (lm && typeof lm.z === 'number' && !isNaN(lm.z)) zValues.push(lm.z);
    }

    if (zValues.length < 3) return { depth: this.interactionDistance, confidence: 0 };

    const meanZ = zValues.reduce((a, b) => a + b, 0) / zValues.length;
    const stdZ = Math.sqrt(zValues.reduce((s, z) => s + Math.pow(z - meanZ, 2), 0) / zValues.length);

    const avgZ = meanZ;
    const depthRange = 0.3;
    const clampedZ = Math.max(-depthRange, Math.min(depthRange, avgZ));
    const rawDepth = this.interactionDistance + clampedZ * 5;

    this.depthHistory.push(rawDepth);
    if (this.depthHistory.length > this.DEPTH_SMOOTHING_FRAMES) {
      this.depthHistory.shift();
    }
    const smoothedDepth = this.depthHistory.reduce((a, b) => a + b, 0) / this.depthHistory.length;
    this.lastDepth = smoothedDepth;

    const confidence = Math.max(0, Math.min(1, 1 - stdZ * 20));

    return { depth: smoothedDepth, confidence };
  }

  getHandWorldPosition(hand: Hand): THREE.Vector3 | null {
    if (!this.camera) return null;

    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return null;

    const screenX = tip.x * this.viewportWidth;
    const screenY = tip.y * this.viewportHeight;
    const ndc = this.screenToNDC(screenX, screenY);

    const depthResult = this.estimateDepth(hand);
    const depth = depthResult.depth;

    this.raycaster.setFromCamera(ndc, this.camera);
    const worldPos = this.raycaster.ray.at(depth, new THREE.Vector3());
    return worldPos;
  }

  getHandWorldPositionAtDepth(hand: Hand, targetDepth: number): THREE.Vector3 | null {
    if (!this.camera) return null;

    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return null;

    const screenX = tip.x * this.viewportWidth;
    const screenY = tip.y * this.viewportHeight;
    const ndc = this.screenToNDC(screenX, screenY);

    this.raycaster.setFromCamera(ndc, this.camera);
    const worldPos = this.raycaster.ray.at(targetDepth, new THREE.Vector3());
    return worldPos;
  }

  getHandRay(hand: Hand): { origin: THREE.Vector3; direction: THREE.Vector3 } | null {
    if (!this.camera) return null;

    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return null;

    const screenX = tip.x * this.viewportWidth;
    const screenY = tip.y * this.viewportHeight;
    const ndc = this.screenToNDC(screenX, screenY);

    this.raycaster.setFromCamera(ndc, this.camera);
    return {
      origin: this.raycaster.ray.origin.clone(),
      direction: this.raycaster.ray.direction.clone(),
    };
  }

  getHandOrientation(hand: Hand): { pitch: number; yaw: number; roll: number } {
    return { ...hand.orientation };
  }

  getPinchDistance(hand: Hand): number {
    const thumbTip = hand.landmarks[HAND_LANDMARKS.THUMB_TIP];
    const indexTip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!thumbTip || !indexTip) return 1;

    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getPalmCenterWorld(hand: Hand): THREE.Vector3 | null {
    if (!this.camera) return null;

    const palm = hand.palmCenter;
    if (!palm) return null;

    const screenX = palm.x * this.viewportWidth;
    const screenY = palm.y * this.viewportHeight;
    const ndx = this.screenToNDC(screenX, screenY);

    const depthResult = this.estimateDepth(hand);
    const depth = depthResult.depth;

    this.raycaster.setFromCamera(ndx, this.camera);
    return this.raycaster.ray.at(depth, new THREE.Vector3());
  }

  getFullHandData(hand: Hand): Hand3DData | null {
    if (!this.camera) return null;

    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return null;

    const screenX = tip.x * this.viewportWidth;
    const screenY = tip.y * this.viewportHeight;
    const ndc = this.screenToNDC(screenX, screenY);

    const depthResult = this.estimateDepth(hand);

    this.raycaster.setFromCamera(ndc, this.camera);
    const worldPos = this.raycaster.ray.at(depthResult.depth, new THREE.Vector3());
    const worldNormal = this.raycaster.ray.direction.clone().normalize();

    const pinchDist = this.getPinchDistance(hand);

    return {
      worldPosition: worldPos,
      worldNormal: worldNormal,
      screenX,
      screenY,
      ndcX: ndc.x,
      ndcY: ndc.y,
      depth: depthResult.depth,
      depthConfidence: depthResult.confidence,
      orientation: { ...hand.orientation },
      pinchDistance: pinchDist,
      confidence: hand.confidence,
      isValid: hand.isValid,
    };
  }

  getDepthConfidenceLabel(): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (this.depthHistory.length < 3) return 'LOW';
    if (this.depthHistory.length < this.DEPTH_SMOOTHING_FRAMES) return 'MEDIUM';
    return 'HIGH';
  }

  resetDepthSmoothing(): void {
    this.depthHistory = [];
    this.lastDepth = this.interactionDistance;
  }
}

export default Hand3DController;

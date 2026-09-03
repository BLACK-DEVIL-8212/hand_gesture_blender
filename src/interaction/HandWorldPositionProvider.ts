import * as THREE from 'three';
import { HAND_LANDMARKS } from '../vision/types';
import type { Hand } from '../vision/types';

export interface HandWorldPosition {
  worldPosition: THREE.Vector3;
  worldNormal: THREE.Vector3;
  screenX: number;
  screenY: number;
  depth: number;
  depthConfidence: number;
}

export class HandDepthEstimator {
  private smoothedDepth: number = 8;
  private readonly smoothingFactor: number = 0.2;
  private readonly depthScale: number = 5;
  private readonly depthRange: number = 0.3;
  private readonly baseDistance: number = 8;

  estimate(hand: Hand, fallbackDistance: number = 8): { depth: number; confidence: number } {
    const lm = hand.landmarks;
    if (!lm || lm.length < 21) {
      return { depth: fallbackDistance, confidence: 0 };
    }

    const zValues: number[] = [];
    const indices = [0, 4, 8, 12, 16, 20, 5, 9, 13, 17];
    for (const i of indices) {
      const z = lm[i]?.z;
      if (typeof z === 'number' && !isNaN(z)) {
        zValues.push(z);
      }
    }

    if (zValues.length < 3) {
      return { depth: fallbackDistance, confidence: 0 };
    }

    const meanZ = zValues.reduce((a, b) => a + b, 0) / zValues.length;
    const stdZ = Math.sqrt(
      zValues.reduce((s, z) => s + Math.pow(z - meanZ, 2), 0) / zValues.length,
    );

    const clampedZ = Math.max(-this.depthRange, Math.min(this.depthRange, meanZ));
    const rawDepth = this.baseDistance + clampedZ * this.depthScale;
    this.smoothedDepth =
      this.smoothedDepth + (rawDepth - this.smoothedDepth) * this.smoothingFactor;

    const confidence = Math.max(0, Math.min(1, 1 - stdZ * 20));

    return { depth: this.smoothedDepth, confidence };
  }

  reset(): void {
    this.smoothedDepth = this.baseDistance;
  }
}

export class HandWorldPositionProvider {
  private camera: THREE.PerspectiveCamera | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private interactionDistance: number = 8;
  private viewportWidth: number = 1;
  private viewportHeight: number = 1;
  private depthEstimator: HandDepthEstimator = new HandDepthEstimator();

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  getInteractionDistance(): number {
    return this.interactionDistance;
  }

  setInteractionDistance(distance: number): void {
    this.interactionDistance = Math.max(0.1, distance);
  }

  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  getDepthEstimator(): HandDepthEstimator {
    return this.depthEstimator;
  }

  screenToNdc(screenX: number, screenY: number, viewportWidth: number, viewportHeight: number): THREE.Vector2 {
    const ndcX = screenX * 2 - 1;
    const ndcY = -(screenY * 2 - 1);
    return new THREE.Vector2(ndcX, ndcY);
  }

  handScreenToNdc(tip: { x: number; y: number }, viewportWidth: number, viewportHeight: number): THREE.Vector2 {
    return this.screenToNdc(tip.x, tip.y, viewportWidth, viewportHeight);
  }

  getWorldPositionAtDepth(ndc: THREE.Vector2, depth: number): THREE.Vector3 | null {
    if (!this.camera) return null;

    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray.at(depth, new THREE.Vector3());
  }

  getWorldPositionByPlaneIntersection(
    ndc: THREE.Vector2,
    planeOrigin: THREE.Vector3,
    planeNormal: THREE.Vector3,
  ): THREE.Vector3 | null {
    if (!this.camera) return null;

    this.raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(planeNormal, -planeNormal.dot(planeOrigin));
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(plane, intersection);
    return hit;
  }

  estimateDepthFromHandGeometry(hand: Hand): { depth: number; confidence: number } {
    return this.depthEstimator.estimate(hand, this.interactionDistance);
  }

  getHandWorldPosition(
    hand: Hand,
    viewportWidth: number,
    viewportHeight: number,
    targetDepth?: number,
  ): HandWorldPosition | null {
    if (!this.camera) return null;

    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return null;

    const ndc = this.handScreenToNdc(tip, viewportWidth, viewportHeight);

    let depth: number;
    let confidence: number;

    if (targetDepth !== undefined) {
      depth = targetDepth;
      confidence = 1.0;
    } else {
      const est = this.estimateDepthFromHandGeometry(hand);
      depth = est.depth;
      confidence = est.confidence;
    }

    const worldPos = this.getWorldPositionAtDepth(ndc, depth);
    if (!worldPos) {
      return null;
    }

    this.raycaster.setFromCamera(ndc, this.camera);
    const worldNormal = this.raycaster.ray.direction.clone().normalize();

    return {
      worldPosition: worldPos,
      worldNormal: worldNormal,
      screenX: tip.x,
      screenY: tip.y,
      depth,
      depthConfidence: confidence,
    };
  }

  getHandWorldPositionByPlane(
    hand: Hand,
    viewportWidth: number,
    viewportHeight: number,
    planeOrigin: THREE.Vector3,
    planeNormal: THREE.Vector3,
  ): HandWorldPosition | null {
    if (!this.camera) return null;

    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return null;

    const ndc = this.handScreenToNdc(tip, viewportWidth, viewportHeight);
    const worldPos = this.getWorldPositionByPlaneIntersection(ndc, planeOrigin, planeNormal);

    if (!worldPos) return null;

    const est = this.estimateDepthFromHandGeometry(hand);
    this.raycaster.setFromCamera(ndc, this.camera);

    return {
      worldPosition: worldPos,
      worldNormal: this.raycaster.ray.direction.clone().normalize(),
      screenX: tip.x,
      screenY: tip.y,
      depth: worldPos.distanceTo(this.camera.position),
      depthConfidence: est.confidence,
    };
  }

  getMidpointWorldPosition(
    hand1: Hand,
    hand2: Hand,
    viewportWidth: number,
    viewportHeight: number,
    targetDepth?: number,
  ): HandWorldPosition | null {
    if (!this.camera) return null;

    const lm1 = hand1.landmarks;
    const lm2 = hand2.landmarks;
    if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return null;

    const midX = (lm1[HAND_LANDMARKS.INDEX_TIP].x + lm2[HAND_LANDMARKS.INDEX_TIP].x) / 2;
    const midY = (lm1[HAND_LANDMARKS.INDEX_TIP].y + lm2[HAND_LANDMARKS.INDEX_TIP].y) / 2;

    const ndc = this.screenToNdc(midX, midY, viewportWidth, viewportHeight);

    if (targetDepth !== undefined) {
      const worldPos = this.getWorldPositionAtDepth(ndc, targetDepth);
      if (!worldPos) return null;

      this.raycaster.setFromCamera(ndc, this.camera);
      return {
        worldPosition: worldPos,
        worldNormal: this.raycaster.ray.direction.clone().normalize(),
        screenX: midX,
        screenY: midY,
        depth: targetDepth,
        depthConfidence: 1.0,
      };
    }

    const est1 = this.estimateDepthFromHandGeometry(hand1);
    const est2 = this.estimateDepthFromHandGeometry(hand2);
    const avgDepth = (est1.depth + est2.depth) / 2;
    const avgConfidence = Math.min(est1.confidence, est2.confidence);

    const worldPos = this.getWorldPositionAtDepth(ndc, avgDepth);
    if (!worldPos) return null;

    this.raycaster.setFromCamera(ndc, this.camera);
    return {
      worldPosition: worldPos,
      worldNormal: this.raycaster.ray.direction.clone().normalize(),
      screenX: midX,
      screenY: midY,
      depth: avgDepth,
      depthConfidence: avgConfidence,
    };
  }

  getHandDistanceWorld(hand1: Hand, hand2: Hand, viewportWidth: number, viewportHeight: number, targetDepth?: number): number | null {
    const pos1 = this.getHandWorldPosition(hand1, viewportWidth, viewportHeight, targetDepth);
    const pos2 = this.getHandWorldPosition(hand2, viewportWidth, viewportHeight, targetDepth);
    if (!pos1 || !pos2) return null;
    return pos1.worldPosition.distanceTo(pos2.worldPosition);
  }
}

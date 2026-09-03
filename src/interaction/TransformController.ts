import * as THREE from 'three';
import type { SceneObject } from '../scene/types';
import type { HandWorldPositionProvider } from './HandWorldPositionProvider';

export type TransformGesture = 'move' | 'rotate' | 'scale';

export interface TransformSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

export interface AxisConstrainedTransform {
  worldDelta: THREE.Vector3;
  projectedDelta: THREE.Vector3;
  activeAxisVector: THREE.Vector3 | null;
  axisLabel: 'X' | 'Y' | 'Z' | 'NONE';
}

export class TransformController {
  private objectManager: {
    getObject: (id: string) => SceneObject | undefined;
    setPosition: (id: string, x: number, y: number, z: number) => boolean;
    setRotation: (id: string, x: number, y: number, z: number) => boolean;
    setScale: (id: string, x: number, y: number, z: number) => boolean;
  };

  private _camera: THREE.PerspectiveCamera | null = null;
  private _raycaster: THREE.Raycaster = new THREE.Raycaster();
  private worldPositionProvider: HandWorldPositionProvider | null = null;
  private transformMode: 'move' | 'rotate' | 'scale' = 'move';
  private axisLock: 'x' | 'y' | 'z' | null = null;
  private active = false;
  private activeObjectId: string | null = null;
  private initialObjectTransform: TransformSnapshot | null = null;
  private initialHandWorldPosition: THREE.Vector3 | null = null;
  private initialHandOrientation: { pitch: number; yaw: number; roll: number } | null = null;
  private initialHandDistance: number | null = null;
  private lastHandWorldPosition: THREE.Vector3 | null = null;
  private initialHandVector: THREE.Vector3 | null = null;
  private _snapEnabled = false;
  private snapInterval = 0.5;
  private sensitivity = 1.0;
  private viewportWidth: number = 1;
  private viewportHeight: number = 1;

  constructor(objectManager: any) {
    this.objectManager = objectManager;
    void this._raycaster;
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this._camera = camera;
  }

  setWorldPositionProvider(provider: HandWorldPositionProvider): void {
    this.worldPositionProvider = provider;
  }

  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  setTransformMode(mode: 'move' | 'rotate' | 'scale'): void {
    this.transformMode = mode;
  }

  getTransformMode(): 'move' | 'rotate' | 'scale' {
    return this.transformMode;
  }

  setAxisLock(axis: 'x' | 'y' | 'z' | null): void {
    this.axisLock = axis;
  }

  getAxisLock(): 'x' | 'y' | 'z' | null {
    return this.axisLock;
  }

  getActiveAxisVector(): THREE.Vector3 | null {
    if (this.axisLock === 'x') return new THREE.Vector3(1, 0, 0);
    if (this.axisLock === 'y') return new THREE.Vector3(0, 1, 0);
    if (this.axisLock === 'z') return new THREE.Vector3(0, 0, 1);
    return null;
  }

  setSnap(enabled: boolean, interval: number = 0.5): void {
    this._snapEnabled = enabled;
    this.snapInterval = interval;
  }

  setSensitivity(value: number): void {
    this.sensitivity = value;
  }

  startTransform(
    objectId: string,
    mode: 'move' | 'rotate' | 'scale',
    axis: 'x' | 'y' | 'z' | null = null,
    initialHandWorldPos?: THREE.Vector3,
    initialHandOrientation?: { pitch: number; yaw: number; roll: number },
    initialHandDist?: number,
  ): boolean {
    const obj = this.objectManager.getObject(objectId);
    if (!obj) return false;

    this.active = true;
    this.activeObjectId = objectId;
    this.transformMode = mode;
    this.axisLock = axis;

    this.initialObjectTransform = {
      position: { ...obj.transform.position },
      rotation: { ...obj.transform.rotation },
      scale: { ...obj.transform.scale },
    };

    this.initialHandWorldPosition = initialHandWorldPos ? initialHandWorldPos.clone() : null;
    this.initialHandOrientation = initialHandOrientation ? { ...initialHandOrientation } : null;
    this.initialHandDistance = initialHandDist ?? null;
    this.lastHandWorldPosition = initialHandWorldPos ? initialHandWorldPos.clone() : null;

    return true;
  }

  startTwoHandTransform(
    objectId: string,
    initialObjectTransform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } },
    leftHand: THREE.Vector3,
    rightHand: THREE.Vector3,
    initialMidpoint: THREE.Vector3,
    initialDistance: number,
    mode: 'move' | 'rotate' | 'scale' = 'move',
    axis: 'x' | 'y' | 'z' | null = null,
  ): boolean {
    const obj = this.objectManager.getObject(objectId);
    if (!obj) return false;

    this.active = true;
    this.activeObjectId = objectId;
    this.transformMode = mode;
    this.axisLock = axis;

    this.initialObjectTransform = initialObjectTransform;
    this.initialHandWorldPosition = initialMidpoint.clone();
    this.initialHandOrientation = null;
    this.initialHandDistance = initialDistance;
    this.lastHandWorldPosition = initialMidpoint.clone();

    const handVector = new THREE.Vector3().subVectors(rightHand, leftHand);
    this.initialHandVector = handVector.clone();

    return true;
  }

  getInitialObjectTransform(): { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } } | null {
    return this.initialObjectTransform;
  }

  updateFromHand(
    handWorldPos: THREE.Vector3,
    handOrientation?: { pitch: number; yaw: number; roll: number },
    pinchDistance?: number,
  ): AxisConstrainedTransform | null {
    console.log('[TRANSFORM CONTROLLER RUNNING]', {
      active: this.active,
      activeObjectId: this.activeObjectId,
      transformMode: this.transformMode,
      axisLock: this.axisLock,
      handWorld: { x: Number(handWorldPos.x.toFixed(4)), y: Number(handWorldPos.y.toFixed(4)), z: Number(handWorldPos.z.toFixed(4)) },
    });
    if (!this.active || !this.activeObjectId) return null;

    const obj = this.objectManager.getObject(this.activeObjectId);
    if (!obj || !this.initialObjectTransform || !this.initialHandWorldPosition) return null;

    const handWorldDelta = new THREE.Vector3().subVectors(handWorldPos, this.initialHandWorldPosition);

    const axisVector = this.getActiveAxisVector();
    let projectedDelta: THREE.Vector3;
    let axisLabel: 'X' | 'Y' | 'Z' | 'NONE';
    let projectedScalar: number;

    if (axisVector && this.axisLock) {
      projectedScalar = handWorldDelta.dot(axisVector);
      projectedDelta = axisVector.clone().multiplyScalar(projectedScalar);
      axisLabel = this.axisLock.toUpperCase() as 'X' | 'Y' | 'Z';
    } else {
      projectedDelta = handWorldDelta.clone();
      projectedScalar = 0;
      axisLabel = 'NONE';
    }

    switch (this.transformMode) {
      case 'move':
        this.applyMove(projectedScalar, axisVector, this.initialObjectTransform.position, handWorldDelta);
        break;
      case 'rotate':
        this.applyRotate(handWorldPos, handWorldDelta, handOrientation);
        break;
      case 'scale':
        this.applyScale(handWorldPos, handWorldDelta, pinchDistance);
        break;
    }

    this.lastHandWorldPosition = handWorldPos.clone();

    return {
      worldDelta: handWorldDelta.clone(),
      projectedDelta: projectedDelta.clone(),
      activeAxisVector: axisVector ? axisVector.clone() : null,
      axisLabel,
    };
  }

  updateFromTwoHands(hand1World: THREE.Vector3, hand2World: THREE.Vector3): AxisConstrainedTransform | null {
    if (!this.active || !this.activeObjectId) return null;

    const obj = this.objectManager.getObject(this.activeObjectId);
    if (!obj || !this.initialObjectTransform || !this.initialHandWorldPosition || this.initialHandDistance === null) {
      return null;
    }

    const currentDistance = hand1World.distanceTo(hand2World);
    const scaleFactor = currentDistance / this.initialHandDistance;
    const clamped = Math.max(0.1, Math.min(10, scaleFactor));

    const initial = this.initialObjectTransform.scale;

    if (this.axisLock === 'x') {
      this.objectManager.setScale(this.activeObjectId!, initial.x * clamped, initial.y, initial.z);
    } else if (this.axisLock === 'y') {
      this.objectManager.setScale(this.activeObjectId!, initial.x, initial.y * clamped, initial.z);
    } else if (this.axisLock === 'z') {
      this.objectManager.setScale(this.activeObjectId!, initial.x, initial.y, initial.z * clamped);
    } else {
      this.objectManager.setScale(this.activeObjectId!, initial.x * clamped, initial.y * clamped, initial.z * clamped);
    }

    const midpoint = new THREE.Vector3().addVectors(hand1World, hand2World).multiplyScalar(0.5);
    const handWorldDelta = new THREE.Vector3().subVectors(midpoint, this.initialHandWorldPosition);

    const axisVector = this.getActiveAxisVector();
    let projectedDelta: THREE.Vector3;
    let axisLabel: 'X' | 'Y' | 'Z' | 'NONE';
    let projectedScalar: number;

    if (axisVector && this.axisLock) {
      projectedScalar = handWorldDelta.dot(axisVector);
      projectedDelta = axisVector.clone().multiplyScalar(projectedScalar);
      axisLabel = this.axisLock.toUpperCase() as 'X' | 'Y' | 'Z';
    } else {
      projectedDelta = handWorldDelta.clone();
      projectedScalar = 0;
      axisLabel = 'NONE';
    }

    if (this.transformMode === 'move' && axisVector && this.axisLock) {
      this.applyMove(projectedScalar, axisVector, this.initialObjectTransform.position, handWorldDelta);
    }

    return {
      worldDelta: handWorldDelta.clone(),
      projectedDelta: projectedDelta.clone(),
      activeAxisVector: axisVector ? axisVector.clone() : null,
      axisLabel,
    };
  }

  private applyMove(
    projectedScalar: number,
    axisVector: THREE.Vector3 | null,
    initialPosition: { x: number; y: number; z: number },
    handWorldDelta: THREE.Vector3,
  ): void {
    if (axisVector && this.axisLock) {
      this.objectManager.setPosition(
        this.activeObjectId!,
        initialPosition.x + axisVector.x * projectedScalar * this.sensitivity,
        initialPosition.y + axisVector.y * projectedScalar * this.sensitivity,
        initialPosition.z + axisVector.z * projectedScalar * this.sensitivity,
      );
    } else {
      this.objectManager.setPosition(
        this.activeObjectId!,
        initialPosition.x + handWorldDelta.x * this.sensitivity,
        initialPosition.y + handWorldDelta.y * this.sensitivity,
        initialPosition.z + handWorldDelta.z * this.sensitivity,
      );
    }
  }

  private applyRotate(
    handWorldPos: THREE.Vector3,
    handWorldDelta: THREE.Vector3,
    handOrientation?: { pitch: number; yaw: number; roll: number },
  ): void {
    if (!this.initialHandOrientation || !this.initialObjectTransform) return;

    const deltaRoll = (handOrientation?.roll ?? 0) - this.initialHandOrientation.roll;
    const deltaPitch = (handOrientation?.pitch ?? 0) - this.initialHandOrientation.pitch;
    const deltaYaw = (handOrientation?.yaw ?? 0) - this.initialHandOrientation.yaw;

    const initial = this.initialObjectTransform.rotation;

    if (this.axisLock === 'x') {
      this.objectManager.setRotation(this.activeObjectId!, initial.x + deltaPitch * 0.2, initial.y, initial.z);
    } else if (this.axisLock === 'y') {
      this.objectManager.setRotation(this.activeObjectId!, initial.x, initial.y + deltaYaw * 0.2, initial.z);
    } else if (this.axisLock === 'z') {
      this.objectManager.setRotation(this.activeObjectId!, initial.x, initial.y, initial.z + deltaRoll * 0.1);
    } else {
      this.objectManager.setRotation(
        this.activeObjectId!,
        initial.x + deltaPitch * 0.2,
        initial.y + deltaYaw * 0.2,
        initial.z + deltaRoll * 0.1,
      );
    }
  }

  private applyScale(
    handWorldPos: THREE.Vector3,
    handWorldDelta: THREE.Vector3,
    pinchDistance?: number,
  ): void {
    if (!this.initialObjectTransform || !this.initialHandDistance) return;

    let scaleDelta: number;

    if (pinchDistance !== undefined) {
      scaleDelta = pinchDistance / this.initialHandDistance;
    } else {
      scaleDelta = 1 + handWorldDelta.y * 0.1 * this.sensitivity;
    }

    const clamped = Math.max(0.01, Math.min(100, scaleDelta));
    const initial = this.initialObjectTransform.scale;

    if (this.axisLock === 'x') {
      this.objectManager.setScale(this.activeObjectId!, initial.x * clamped, initial.y, initial.z);
    } else if (this.axisLock === 'y') {
      this.objectManager.setScale(this.activeObjectId!, initial.x, initial.y * clamped, initial.z);
    } else if (this.axisLock === 'z') {
      this.objectManager.setScale(this.activeObjectId!, initial.x, initial.y, initial.z * clamped);
    } else {
      this.objectManager.setScale(
        this.activeObjectId!,
        initial.x * clamped,
        initial.y * clamped,
        initial.z * clamped,
      );
    }
  }

  endTransform(): TransformSnapshot | null {
    if (!this.active || !this.activeObjectId) return null;

    this.active = false;
    this.activeObjectId = null;
    this.initialObjectTransform = null;
    this.initialHandWorldPosition = null;
    this.initialHandOrientation = null;
    this.initialHandDistance = null;
    this.lastHandWorldPosition = null;
    this.initialHandVector = null;
    this.axisLock = null;

    return null;
  }

  cancelTransform(): void {
    this.active = false;
    this.activeObjectId = null;
    this.initialObjectTransform = null;
    this.initialHandWorldPosition = null;
    this.initialHandOrientation = null;
    this.initialHandDistance = null;
    this.lastHandWorldPosition = null;
    this.initialHandVector = null;
    this.axisLock = null;
  }

  isActive(): boolean {
    return this.active;
  }

  getActiveObjectId(): string | null {
    return this.activeObjectId;
  }

  getInitialHandPosition(): THREE.Vector3 | null {
    return this.initialHandWorldPosition;
  }

  getInitialHandDistance(): number | null {
    return this.initialHandDistance;
  }

  setInitialHandPosition(pos: THREE.Vector3): void {
    this.initialHandWorldPosition = pos.clone();
    this.lastHandWorldPosition = pos.clone();
  }

  setInitialHandDistance(dist: number): void {
    this.initialHandDistance = dist;
  }

  private snap(value: number): number {
    if (!this._snapEnabled) return value;
    return Math.round(value / this.snapInterval) * this.snapInterval;
  }

  getDebugInfo(): {
    active: boolean;
    activeObjectId: string | null;
    transformMode: 'move' | 'rotate' | 'scale';
    axisLock: 'x' | 'y' | 'z' | null;
    initialObjectTransform: TransformSnapshot | null;
    initialHandWorldPosition: THREE.Vector3 | null;
    lastHandWorldPosition: THREE.Vector3 | null;
  } {
    return {
      active: this.active,
      activeObjectId: this.activeObjectId,
      transformMode: this.transformMode,
      axisLock: this.axisLock,
      initialObjectTransform: this.initialObjectTransform,
      initialHandWorldPosition: this.initialHandWorldPosition ? this.initialHandWorldPosition.clone() : null,
      lastHandWorldPosition: this.lastHandWorldPosition ? this.lastHandWorldPosition.clone() : null,
    };
  }
}

export default TransformController;

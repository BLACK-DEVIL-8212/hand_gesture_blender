import * as THREE from 'three';
import type { Hand } from '../vision/types';
import { HAND_LANDMARKS } from '../vision/types';
import { ScreenToWorldRay } from './ScreenToWorldRay';
import { HandWorldPositionProvider } from './HandWorldPositionProvider';
import { TransformController } from './TransformController';
import type { InteractionMode } from '../vision/GestureStateMachine';

export interface HandInteractionState {
  handedness: 'Left' | 'Right';
  tracked: boolean;
  cursor: THREE.Vector3;
  isPinching: boolean;
  selectedObjectId: string | null;
  grabbedObjectId: string | null;
  previousPosition: THREE.Vector3;
  grabStartHandPosition: THREE.Vector3 | null;
  grabStartObjectPosition: { x: number; y: number; z: number } | null;
  initialHandOrientation: { pitch: number; yaw: number; roll: number } | null;
  initialObjectRotation: { x: number; y: number; z: number } | null;
  initialPinchDistance: number | null;
  initialObjectScale: { x: number; y: number; z: number } | null;
}

export interface HandInteractionDebug {
  tracked: boolean;
  pinch: boolean;
  selected: string | null;
  grabbed: string | null;
  worldPos: { x: number; y: number; z: number } | null;
}

export class TwoHandInteractionManager {
  private leftState: HandInteractionState;
  private rightState: HandInteractionState;
  private objectManager: any;
  private screenToWorldRay: ScreenToWorldRay;
  private handWorldPosProvider: HandWorldPositionProvider;
  private leftTransformController: TransformController;
  private rightTransformController: TransformController;
  private mode: InteractionMode = 'SELECT';
  private axisLock: 'x' | 'y' | 'z' | null = null;
  private viewportWidth: number = 1;
  private viewportHeight: number = 1;
  private camera: THREE.PerspectiveCamera | null = null;
  private selectableObjects: THREE.Object3D[] = [];
  private controlsEnabled: boolean = true;
  private onSelectionChange: (ids: string[]) => void;
  private onHoverChange: (id: string | null) => void;
  private onDebugUpdate: (left: HandInteractionDebug, right: HandInteractionDebug) => void;
  private onObjectGrabbed: (hand: 'Left' | 'Right', objectId: string | null) => void;
  private onObjectReleased: (hand: 'Left' | 'Right', objectId: string | null) => void;

  constructor(
    objectManager: any,
    screenToWorldRay: ScreenToWorldRay,
    handWorldPosProvider: HandWorldPositionProvider,
    onSelectionChange: (ids: string[]) => void = () => {},
    onHoverChange: (id: string | null) => void = () => {},
    onDebugUpdate: (left: HandInteractionDebug, right: HandInteractionDebug) => void = () => {},
    onObjectGrabbed: (hand: 'Left' | 'Right', objectId: string | null) => void = () => {},
    onObjectReleased: (hand: 'Left' | 'Right', objectId: string | null) => void = () => {},
  ) {
    this.objectManager = objectManager;
    this.screenToWorldRay = screenToWorldRay;
    this.handWorldPosProvider = handWorldPosProvider;
    this.onSelectionChange = onSelectionChange;
    this.onHoverChange = onHoverChange;
    this.onDebugUpdate = onDebugUpdate;
    this.onObjectGrabbed = onObjectGrabbed;
    this.onObjectReleased = onObjectReleased;
    this.leftTransformController = new TransformController(objectManager);
    this.rightTransformController = new TransformController(objectManager);
    this.leftState = this.createInitialState('Left');
    this.rightState = this.createInitialState('Right');
  }

  private createInitialState(handedness: 'Left' | 'Right'): HandInteractionState {
    return {
      handedness,
      tracked: false,
      cursor: new THREE.Vector3(),
      isPinching: false,
      selectedObjectId: null,
      grabbedObjectId: null,
      previousPosition: new THREE.Vector3(),
      grabStartHandPosition: null,
      grabStartObjectPosition: null,
      initialHandOrientation: null,
      initialObjectRotation: null,
      initialPinchDistance: null,
      initialObjectScale: null,
    };
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.leftTransformController.setCamera(camera);
    this.rightTransformController.setCamera(camera);
  }

  setWorldPositionProvider(provider: HandWorldPositionProvider): void {
    this.handWorldPosProvider = provider;
    this.leftTransformController.setWorldPositionProvider(provider);
    this.rightTransformController.setWorldPositionProvider(provider);
  }

  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.leftTransformController.setViewportSize(width, height);
    this.rightTransformController.setViewportSize(width, height);
  }

  setMode(mode: InteractionMode): void {
    this.mode = mode;
  }

  setAxisLock(axis: 'x' | 'y' | 'z' | null): void {
    this.axisLock = axis;
  }

  setSelectableObjects(objects: THREE.Object3D[]): void {
    this.selectableObjects = objects;
  }

  setControlsEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
    if (!enabled) {
      this.leftTransformController.endTransform();
      this.rightTransformController.endTransform();
      this.resetHandState(this.leftState);
      this.resetHandState(this.rightState);
    }
  }

  getState(hand: 'Left' | 'Right'): HandInteractionState {
    return hand === 'Left' ? this.leftState : this.rightState;
  }

  getLeftState(): HandInteractionState { return this.leftState; }
  getRightState(): HandInteractionState { return this.rightState; }

  update(hands: Hand[], gesture: any, isTwoHands: boolean): void {
    this.updateHand(this.leftState, hands, gesture, isTwoHands);
    this.updateHand(this.rightState, hands, gesture, isTwoHands);
    this.onDebugUpdate(this.getDebugInfo('Left'), this.getDebugInfo('Right'));
  }

  private updateHand(state: HandInteractionState, fullHandState: Hand[], gesture: any, isTwoHands: boolean): void {
    const hand = state.handedness === 'Left' ? fullHandState.find(h => h.handedness === 'Left') || null : fullHandState.find(h => h.handedness === 'Right') || null;
    if (!hand) {
      if (state.tracked) {
        this.releaseHand(state);
      }
      state.tracked = false;
      return;
    }

    state.tracked = true;
    const tip = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!tip) return;

    const ndcX = tip.x * 2 - 1;
    const ndcY = 1 - tip.y * 2;

    const worldResult = this.handWorldPosProvider.getHandWorldPosition(
      hand,
      this.viewportWidth,
      this.viewportHeight,
    );
    state.cursor = worldResult ? worldResult.worldPosition : new THREE.Vector3();

    const mode = this.mode;
    const isTransformMode = mode === 'MOVE' || mode === 'ROTATE' || mode === 'SCALE' || mode === 'EDIT';
    const isPinchGesture = gesture.type === 'PINCH' || gesture.type === 'GRAB' || gesture.type === 'FIST';

    if (isTransformMode && isPinchGesture) {
      if (gesture.state === 'PINCH_START') {
        const hitObject = this.screenToWorldRay.getObjectAtScreenFromMeshes(
          ndcX, ndcY, this.camera!, this.selectableObjects
        );
        const hitId = hitObject ? (hitObject.userData.id as string) : null;

        if (hitId && !this.objectManager.getObject(hitId)) {
          return;
        }

        if (hitId) {
          const targetId = state.selectedObjectId || hitId;
          if (state.grabbedObjectId && state.grabbedObjectId !== hitId) {
            this.releaseHand(state);
          }

          state.selectedObjectId = targetId;
          state.grabbedObjectId = targetId;
          state.grabStartHandPosition = state.cursor.clone();
          state.previousPosition.copy(state.cursor);
          
          const grabObj = this.objectManager.getObject(targetId);
          if (grabObj) {
            state.grabStartObjectPosition = { ...grabObj.transform.position };
          }

          const tc = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
          tc.setCamera(this.camera!);
          tc.setWorldPositionProvider(this.handWorldPosProvider);
          tc.setViewportSize(this.viewportWidth, this.viewportHeight);
          const transformMode: 'move' | 'rotate' | 'scale' =
            mode === 'ROTATE' ? 'rotate' : mode === 'SCALE' ? 'scale' : 'move';
          tc.setTransformMode(transformMode);
          tc.setAxisLock(this.axisLock);
          tc.startTransform(
            targetId,
            transformMode,
            this.axisLock,
            state.cursor.clone(),
            { ...hand.orientation },
            gesture.pinchDistance || 0.1,
          );

          if (this.controlsEnabled) {
            this.controlsEnabled = false;
          }
        }
      }

      if ((gesture.state === 'PINCH_HOLD' || gesture.state === 'TRANSFORMING' || gesture.type === 'PINCH') &&
          state.grabbedObjectId) {
        const obj = this.objectManager.getObject(state.grabbedObjectId);
        if (!obj || obj.locked) return;

        const tc = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
        if (!tc.isActive() && state.grabbedObjectId) {
          tc.setCamera(this.camera!);
          tc.setWorldPositionProvider(this.handWorldPosProvider);
          tc.setViewportSize(this.viewportWidth, this.viewportHeight);
          const transformMode: 'move' | 'rotate' | 'scale' =
            mode === 'ROTATE' ? 'rotate' : mode === 'SCALE' ? 'scale' : 'move';
          tc.setTransformMode(transformMode);
          tc.setAxisLock(this.axisLock);
          tc.startTransform(
            state.grabbedObjectId,
            transformMode,
            this.axisLock,
            state.cursor.clone(),
            { ...hand.orientation },
            gesture.pinchDistance || 0.1,
          );
        }

        const tcActive = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
        if (tcActive.isActive()) {
          tcActive.setAxisLock(this.axisLock);
          tcActive.updateFromHand(
            state.cursor.clone(),
            { ...hand.orientation },
            gesture.pinchDistance,
          );
        }
      }
    }

    if (gesture.state === 'PINCH_RELEASE' || !isPinchGesture) {
      if (state.grabbedObjectId) {
        const tc = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
        if (tc.isActive()) {
          tc.endTransform();
        }
        this.releaseHand(state);
      }
    }

    if (mode === 'SELECT' && gesture.state === 'PINCH_START' && isPinchGesture) {
      const hitObject = this.screenToWorldRay.getObjectAtScreenFromMeshes(
        ndcX, ndcY, this.camera!, this.selectableObjects
      );
      const hitId = hitObject ? (hitObject.userData.id as string) : null;

      if (hitId) {
        if (state.grabbedObjectId && state.grabbedObjectId !== hitId) {
          this.releaseHand(state);
        }

        state.selectedObjectId = hitId;
        state.grabbedObjectId = hitId;
        state.grabStartHandPosition = state.cursor.clone();
        state.previousPosition.copy(state.cursor);
        
        const grabObj = this.objectManager.getObject(hitId);
        if (grabObj) {
          state.grabStartObjectPosition = { ...grabObj.transform.position };
        }

        const tc = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
        tc.setCamera(this.camera!);
        tc.setWorldPositionProvider(this.handWorldPosProvider);
        tc.setViewportSize(this.viewportWidth, this.viewportHeight);
        tc.setTransformMode('move');
        tc.setAxisLock(this.axisLock);
        tc.startTransform(
          hitId,
          'move',
          this.axisLock,
          state.cursor.clone(),
          { ...hand.orientation },
          gesture.pinchDistance || 0.1,
        );

        if (this.controlsEnabled) {
          this.controlsEnabled = false;
        }
      }
    }

    if (mode === 'SELECT' && (gesture.state === 'PINCH_HOLD' || gesture.type === 'PINCH') && state.grabbedObjectId) {
      const tc = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
      if (tc.isActive()) {
        tc.setAxisLock(this.axisLock);
        tc.updateFromHand(state.cursor.clone(), { ...hand.orientation }, gesture.pinchDistance);
      }
    }

    state.isPinching = isPinchGesture && (gesture.state === 'PINCH_HOLD' || gesture.state === 'TRANSFORMING' || gesture.state === 'PINCH_START');
  }

  private releaseHand(state: HandInteractionState): void {
    const tc = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
    if (tc.isActive()) {
      tc.endTransform();
    }
    state.selectedObjectId = null;
    state.grabbedObjectId = null;
    state.grabStartHandPosition = null;
    state.grabStartObjectPosition = null;
    state.initialHandOrientation = null;
    state.initialObjectRotation = null;
    state.initialPinchDistance = null;
    state.initialObjectScale = null;
    state.isPinching = false;
  }

  resetAll(): void {
    this.releaseHand(this.leftState);
    this.releaseHand(this.rightState);
    this.leftState.tracked = false;
    this.rightState.tracked = false;
    this.leftTransformController.endTransform();
    this.rightTransformController.endTransform();
  }

  resetHandState(state: HandInteractionState): void {
    const tc = state.handedness === 'Left' ? this.leftTransformController : this.rightTransformController;
    if (tc.isActive()) {
      tc.endTransform();
    }
    state.selectedObjectId = null;
    state.grabbedObjectId = null;
    state.grabStartHandPosition = null;
    state.grabStartObjectPosition = null;
    state.initialHandOrientation = null;
    state.initialObjectRotation = null;
    state.initialPinchDistance = null;
    state.initialObjectScale = null;
    state.isPinching = false;
  }

  getTransformController(hand: 'Left' | 'Right'): TransformController {
    return hand === 'Left' ? this.leftTransformController : this.rightTransformController;
  }

  getDebugInfo(hand: 'Left' | 'Right'): HandInteractionDebug {
    const state = hand === 'Left' ? this.leftState : this.rightState;
    return {
      tracked: state.tracked,
      pinch: state.isPinching,
      selected: state.selectedObjectId,
      grabbed: state.grabbedObjectId,
      worldPos: state.tracked ? { x: state.cursor.x, y: state.cursor.y, z: state.cursor.z } : null,
    };
  }
}

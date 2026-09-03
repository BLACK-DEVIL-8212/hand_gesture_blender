import * as THREE from 'three';
import type { Hand, FingerName } from '../vision/types';
import { HAND_LANDMARKS } from '../vision/types';
import { ScreenToWorldRay } from './ScreenToWorldRay';
import { HandWorldPositionProvider } from './HandWorldPositionProvider';
import { TransformController } from './TransformController';
import type { InteractionMode } from '../vision/GestureStateMachine';
import { EditableMesh } from '../modeling/EditableMesh';
import { DeformationTools } from '../modeling/DeformationTools';
import { GeometryUndoManager } from '../modeling/GeometryUndoManager';
import type { EditTool, EditGrabState } from '../modeling/EditableMesh';

export type HandSide = 'Left' | 'Right';

export interface FingerCursor {
  finger: FingerName;
  tracked: boolean;
  landmark: { x: number; y: number; z: number } | null;
  screenPosition: { x: number; y: number } | null;
  ndcPosition: { x: number; y: number } | null;
  worldPosition: THREE.Vector3;
  worldRayOrigin: THREE.Vector3;
  worldRayDirection: THREE.Vector3;
  hoveredObjectId: string | null;
  cursor3D: THREE.Object3D | null;
  gesturePinch: boolean;
  pinchDistance: number;
}

export interface HandFingerState {
  side: HandSide;
  tracked: boolean;
  fingers: {
    thumb: FingerCursor;
    index: FingerCursor;
    middle: FingerCursor;
    ring: FingerCursor;
    pinky: FingerCursor;
  };
  gesture: {
    type: string;
    state: string;
    confidence: number;
    pinchActive: boolean;
    activeFingers: FingerName[];
  };
  selectedObjectId: string | null;
  grabbedObjectIds: string[];
  grabStartHandPosition: THREE.Vector3 | null;
  grabStartObjectPosition: { x: number; y: number; z: number } | null;
  grabStartHandOrientation: { pitch: number; yaw: number; roll: number } | null;
  currentHandOrientation: { pitch: number; yaw: number; roll: number } | null;
}

export interface FingerInteractionDebug {
  side: HandSide;
  tracked: boolean;
  fingers: {
    thumb: { tracked: boolean; worldPos: { x: number; y: number; z: number } | null; hovered: string | null };
    index: { tracked: boolean; worldPos: { x: number; y: number; z: number } | null; hovered: string | null };
    middle: { tracked: boolean; worldPos: { x: number; y: number; z: number } | null; hovered: string | null };
    ring: { tracked: boolean; worldPos: { x: number; y: number; z: number } | null; hovered: string | null };
    pinky: { tracked: boolean; worldPos: { x: number; y: number; z: number } | null; hovered: string | null };
  };
  gesture: string;
  gestureState: string;
  selected: string | null;
  grabbed: string | null;
}

const FINGER_TIP_LANDMARKS: Record<FingerName, number> = {
  thumb: HAND_LANDMARKS.THUMB_TIP,
  index: HAND_LANDMARKS.INDEX_TIP,
  middle: HAND_LANDMARKS.MIDDLE_TIP,
  ring: HAND_LANDMARKS.RING_TIP,
  pinky: HAND_LANDMARKS.PINKY_TIP,
};

const FINGER_COLORS: Record<FingerName, string> = {
  thumb: '#ff6666',
  index: '#66ff66',
  middle: '#6666ff',
  ring: '#ffff66',
  pinky: '#ff66ff',
};

export class FingerCursorManager {
  private leftState: HandFingerState;
  private rightState: HandFingerState;
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
  private cursorObjects: Map<string, THREE.Object3D> = new Map();
  private cursorGroup: THREE.Group | null = null;
  private onSelectionChange: (ids: string[]) => void;
  private onHoverChange: (id: string | null) => void;
  private onDebugUpdate: (left: FingerInteractionDebug, right: FingerInteractionDebug) => void;
  private onObjectGrabbed: (hand: HandSide, objectId: string | null) => void;
  private onObjectReleased: (hand: HandSide, objectId: string | null) => void;
  private pinchThresholdStart: number = 0.06;
  private pinchThresholdRelease: number = 0.09;
  private editableMeshes: Map<string, EditableMesh> = new Map();
  private editTool: EditTool = 'SELECT';
  private editSubMode: 'VERTEX' | 'EDGE' | 'FACE' = 'VERTEX';
  private editGrabs: Map<HandSide, EditGrabState> = new Map();
  private geometryUndoManager: GeometryUndoManager = new GeometryUndoManager();
  private editInfluenceRadius: number = 0.5;
  private editStrength: number = 0.3;
  private twoHandInitialData: Map<string, { left: THREE.Vector3; right: THREE.Vector3; midpoint: THREE.Vector3; distance: number }> = new Map();

  constructor(
    objectManager: any,
    screenToWorldRay: ScreenToWorldRay,
    handWorldPosProvider: HandWorldPositionProvider,
    onSelectionChange: (ids: string[]) => void,
    onHoverChange: (id: string | null) => void,
    onDebugUpdate: (left: FingerInteractionDebug, right: FingerInteractionDebug) => void,
    onObjectGrabbed: (hand: HandSide, objectId: string | null) => void,
    onObjectReleased: (hand: HandSide, objectId: string | null) => void,
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
    this.leftState = this.createHandState('Left');
    this.rightState = this.createHandState('Right');
  }

  private createHandState(side: HandSide): HandFingerState {
    const fingers: HandFingerState['fingers'] = {
      thumb: this.createFingerCursor('thumb'),
      index: this.createFingerCursor('index'),
      middle: this.createFingerCursor('middle'),
      ring: this.createFingerCursor('ring'),
      pinky: this.createFingerCursor('pinky'),
    };
    return {
      side,
      tracked: false,
      fingers,
      gesture: {
        type: 'IDLE',
        state: 'IDLE',
        confidence: 0,
        pinchActive: false,
        activeFingers: [],
      },
      selectedObjectId: null,
      grabbedObjectIds: [],
      grabStartHandPosition: null,
      grabStartObjectPosition: null,
      grabStartHandOrientation: null,
      currentHandOrientation: null,
    };
  }

  private createFingerCursor(finger: FingerName): FingerCursor {
    return {
      finger,
      tracked: false,
      landmark: null,
      screenPosition: null,
      ndcPosition: null,
      worldPosition: new THREE.Vector3(),
      worldRayOrigin: new THREE.Vector3(),
      worldRayDirection: new THREE.Vector3(),
      hoveredObjectId: null,
      cursor3D: null,
      gesturePinch: false,
      pinchDistance: 0,
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
      this.resetHand(this.leftState);
      this.resetHand(this.rightState);
    }
  }

  setCursorGroup(group: THREE.Group | null): void {
    this.cursorGroup = group;
  }

  getCursorGroup(): THREE.Group | null {
    return this.cursorGroup;
  }

  getState(side: HandSide): HandFingerState {
    return side === 'Left' ? this.leftState : this.rightState;
  }

  getLeftState(): HandFingerState { return this.leftState; }
  getRightState(): HandFingerState { return this.rightState; }

  getTransformController(side: HandSide): TransformController {
    return side === 'Left' ? this.leftTransformController : this.rightTransformController;
  }

  setEditableMeshes(meshes: Map<string, EditableMesh>): void {
    this.editableMeshes = meshes;
  }

  setEditTool(tool: EditTool): void {
    this.editTool = tool;
  }

  setEditSubMode(subMode: 'VERTEX' | 'EDGE' | 'FACE'): void {
    this.editSubMode = subMode;
  }

  setEditInfluenceRadius(radius: number): void {
    this.editInfluenceRadius = radius;
  }

  setEditStrength(strength: number): void {
    this.editStrength = strength;
  }

  getGeometryUndoManager(): GeometryUndoManager {
    return this.geometryUndoManager;
  }

  getEditableMesh(objectId: string): EditableMesh | undefined {
    return this.editableMeshes.get(objectId);
  }

  private findEditableHit(worldPos: THREE.Vector3, handSide: HandSide): { mesh: EditableMesh; vertexId: string | null; faceId: string | null; edgeId: string | null } | null {
    let bestMesh: EditableMesh | null = null;
    let bestVertexId: string | null = null;
    let bestFaceId: string | null = null;
    let bestEdgeId: string | null = null;
    let bestDist = Infinity;

    for (const editableMesh of this.editableMeshes.values()) {
      const localPos = editableMesh.worldToLocal(worldPos);

      if (this.editSubMode === 'VERTEX') {
        const vertex = editableMesh.meshData.findClosestVertex(localPos, this.editInfluenceRadius);
        if (vertex) {
          const vWorldPos = editableMesh.getVertexWorldPosition(vertex.id);
          if (vWorldPos) {
            const dist = vWorldPos.distanceTo(worldPos);
            if (dist < bestDist) {
              bestDist = dist;
              bestMesh = editableMesh;
              bestVertexId = vertex.id;
              bestFaceId = null;
              bestEdgeId = null;
            }
          }
        }
      } else if (this.editSubMode === 'FACE') {
        const face = editableMesh.meshData.findClosestFace(localPos, this.editInfluenceRadius);
        if (face) {
          const faceCenter = new THREE.Vector3(face.center.x, face.center.y, face.center.z);
          const worldCenter = editableMesh.localToWorld(faceCenter);
          const dist = worldCenter.distanceTo(worldPos);
          if (dist < bestDist) {
            bestDist = dist;
            bestMesh = editableMesh;
            bestVertexId = null;
            bestFaceId = face.id;
            bestEdgeId = null;
          }
        }
      } else if (this.editSubMode === 'EDGE') {
        const edge = editableMesh.meshData.findClosestEdge(localPos, this.editInfluenceRadius);
        if (edge) {
          const vA = editableMesh.meshData.getVertex(edge.vertexA);
          const vB = editableMesh.meshData.getVertex(edge.vertexB);
          if (vA && vB) {
            const midWorld = editableMesh.localToWorld(new THREE.Vector3(
              (vA.position.x + vB.position.x) / 2,
              (vA.position.y + vB.position.y) / 2,
              (vA.position.z + vB.position.z) / 2,
            ));
            const dist = midWorld.distanceTo(worldPos);
            if (dist < bestDist) {
              bestDist = dist;
              bestMesh = editableMesh;
              bestVertexId = null;
              bestFaceId = null;
              bestEdgeId = edge.id;
            }
          }
        }
      }
    }

    if (bestMesh) {
      return { mesh: bestMesh, vertexId: bestVertexId, faceId: bestFaceId, edgeId: bestEdgeId };
    }
    return null;
  }

  private handleEditPinchStart(state: HandFingerState): void {
    if (this.editTool === 'SELECT' || this.editTool === 'CUT') return;
    
    const thumb = state.fingers.thumb;
    const index = state.fingers.index;
    if (!thumb.tracked || !index.tracked) return;

    const handCenter = new THREE.Vector3(
      (thumb.worldPosition.x + index.worldPosition.x) / 2,
      (thumb.worldPosition.y + index.worldPosition.y) / 2,
      (thumb.worldPosition.z + index.worldPosition.z) / 2,
    );

    const hit = this.findEditableHit(handCenter, state.side);
    if (!hit) return;

    const { mesh, vertexId, faceId, edgeId } = hit;

    const grabState = DeformationTools.createGrabState(
      mesh,
      this.editTool,
      state.side,
      handCenter,
      this.editInfluenceRadius,
      this.editStrength,
    );

    if (!grabState) return;

    if (vertexId) {
      grabState.vertexIds = [vertexId];
    }
    if (faceId) {
      grabState.faceId = faceId;
      const face = mesh.meshData.getFace(faceId);
      if (face) {
        grabState.vertexIds = [...face.vertices];
      }
    }
    if (edgeId) {
      grabState.edgeId = edgeId;
      const edge = mesh.meshData.getEdge(edgeId);
      if (edge) {
        grabState.vertexIds = [edge.vertexA, edge.vertexB];
      }
    }

    if (grabState.vertexIds.length === 0) return;

    this.geometryUndoManager.push(mesh.id, mesh.geometry);
    this.editGrabs.set(state.side, grabState);

    this.onObjectGrabbed(state.side, mesh.id);
  }

  private handleEditPinchHold(state: HandFingerState): void {
    const grab = this.editGrabs.get(state.side);
    if (!grab || !grab.active) return;

    const editableMesh = this.editableMeshes.get(grab.meshId);
    if (!editableMesh) return;

    const thumb = state.fingers.thumb;
    const index = state.fingers.index;
    if (!thumb.tracked || !index.tracked) return;

    const currentHandPos = new THREE.Vector3(
      (thumb.worldPosition.x + index.worldPosition.x) / 2,
      (thumb.worldPosition.y + index.worldPosition.y) / 2,
      (thumb.worldPosition.z + index.worldPosition.z) / 2,
    );

    DeformationTools.updateGrab(editableMesh, grab, currentHandPos);
  }

  private handleEditPinchRelease(state: HandFingerState): void {
    const grab = this.editGrabs.get(state.side);
    if (grab && grab.active) {
      const editableMesh = this.editableMeshes.get(grab.meshId);
      if (editableMesh) {
        DeformationTools.releaseGrab(editableMesh, grab);
      }
      this.editGrabs.delete(state.side);
    }
  }

  private releaseEditGrab(state: HandFingerState): void {
    const grab = this.editGrabs.get(state.side);
    if (grab && grab.active) {
      const editableMesh = this.editableMeshes.get(grab.meshId);
      if (editableMesh) {
        DeformationTools.releaseGrab(editableMesh, grab);
      }
      this.editGrabs.delete(state.side);
    }
  }

  update(hands: Hand[]): void {
    this.updateHand(this.leftState, hands);
    this.updateHand(this.rightState, hands);
    this.updateTwoHandTransform();
    this.onDebugUpdate(this.getDebugInfo('Left'), this.getDebugInfo('Right'));
  }

  private updateHand(state: HandFingerState, allHands: Hand[]): void {
    const hand = allHands.find(h => h.handedness === state.side) || null;
    if (!hand) {
      if (state.tracked) {
        this.releaseHand(state);
      }
      state.tracked = false;
      for (const f of Object.keys(state.fingers) as FingerName[]) {
        state.fingers[f].tracked = false;
        state.fingers[f].hoveredObjectId = null;
        this.updateCursorVisibility(state.side, f, false);
      }
      return;
    }

    state.tracked = true;
    state.currentHandOrientation = hand.orientation ? { ...hand.orientation } : null;
    const isTransformMode = this.mode === 'MOVE' || this.mode === 'ROTATE' || this.mode === 'SCALE' || this.mode === 'EDIT';

    for (const finger of Object.keys(state.fingers) as FingerName[]) {
      const fingerState = state.fingers[finger];
      const landmarkIndex = FINGER_TIP_LANDMARKS[finger];
      const landmark = hand.landmarks[landmarkIndex];

      if (!landmark) {
        fingerState.tracked = false;
        fingerState.hoveredObjectId = null;
        this.updateCursorVisibility(state.side, finger, false);
        continue;
      }

      fingerState.tracked = true;
      fingerState.landmark = { x: landmark.x, y: landmark.y, z: landmark.z };

      const ndcX = landmark.x * 2 - 1;
      const ndcY = 1 - landmark.y * 2;
      fingerState.ndcPosition = { x: ndcX, y: ndcY };
      fingerState.screenPosition = { x: landmark.x * this.viewportWidth, y: landmark.y * this.viewportHeight };

      if (this.camera) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        fingerState.worldRayOrigin.copy(raycaster.ray.origin);
        fingerState.worldRayDirection.copy(raycaster.ray.direction);

        const depthResult = this.handWorldPosProvider.getHandWorldPosition(hand, this.viewportWidth, this.viewportHeight);
        const depth = depthResult ? depthResult.depth : 5;
        const worldPos = new THREE.Vector3();
        raycaster.ray.at(depth, worldPos);
        fingerState.worldPosition.copy(worldPos);

        if (fingerState.cursor3D) {
          fingerState.cursor3D.position.copy(worldPos);
          fingerState.cursor3D.visible = true;
        }
      }

      if (this.camera && this.selectableObjects.length > 0) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        const intersects = raycaster.intersectObjects(this.selectableObjects, false);
        const hitId = intersects.length > 0 ? (intersects[0].object.parent?.userData?.id as string || intersects[0].object.userData?.id as string) : null;
        fingerState.hoveredObjectId = hitId;
      }

      if (this.mode === 'EDIT' && this.camera && this.editableMeshes.size > 0) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        const worldPos = new THREE.Vector3();
        raycaster.ray.at(5, worldPos);
        
        const hit = this.findEditableHit(worldPos, state.side);
        if (hit) {
          fingerState.hoveredObjectId = hit.mesh.id;
          if (finger === 'thumb') {
            state.fingers.index.hoveredObjectId = hit.mesh.id;
          } else if (finger === 'index') {
            state.fingers.thumb.hoveredObjectId = hit.mesh.id;
          }
        }
      }

      this.updateCursorVisual(state.side, finger, fingerState);
    }

    const thumb = state.fingers.thumb;
    const index = state.fingers.index;
    if (thumb.tracked && index.tracked && thumb.landmark && index.landmark) {
      const dx = thumb.landmark.x - index.landmark.x;
      const dy = thumb.landmark.y - index.landmark.y;
      const dz = (thumb.landmark.z || 0) - (index.landmark.z || 0);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      thumb.pinchDistance = dist;
      index.pinchDistance = dist;

      if (!state.gesture.pinchActive && dist < this.pinchThresholdStart) {
        state.gesture.pinchActive = true;
        state.gesture.state = 'PINCH_START';
        if (this.mode === 'EDIT') {
          this.handleEditPinchStart(state);
        } else {
          this.handlePinchStart(state);
        }
      } else if (state.gesture.pinchActive && dist > this.pinchThresholdRelease) {
        state.gesture.pinchActive = false;
        state.gesture.state = 'PINCH_RELEASE';
        if (this.mode === 'EDIT') {
          this.handleEditPinchRelease(state);
        } else {
          this.handlePinchRelease(state);
        }
      } else if (state.gesture.pinchActive) {
        state.gesture.state = 'PINCH_HOLD';
        if (this.mode === 'EDIT') {
          this.handleEditPinchHold(state);
        } else {
          this.handlePinchHold(state);
        }
      }

      thumb.gesturePinch = state.gesture.pinchActive;
      index.gesturePinch = state.gesture.pinchActive;
    } else {
      if (state.gesture.pinchActive) {
        state.gesture.pinchActive = false;
        state.gesture.state = 'PINCH_RELEASE';
        if (this.mode === 'EDIT') {
          this.handleEditPinchRelease(state);
        } else {
          this.handlePinchRelease(state);
        }
      }
      thumb.gesturePinch = false;
      index.gesturePinch = false;
      thumb.pinchDistance = 0;
      index.pinchDistance = 0;
    }

    if (this.mode === 'EDIT') {
      if (state.gesture.pinchActive) {
        state.gesture.type = 'PINCH';
      } else if (hand.index.extended && !hand.middle.extended) {
        state.gesture.type = 'POINTING';
      } else {
        state.gesture.type = 'IDLE';
      }
    } else {
      const extendedCount = [hand.thumb.extended, hand.index.extended, hand.middle.extended, hand.ring.extended, hand.pinky.extended].filter(Boolean).length;
      if (extendedCount >= 4) {
        state.gesture.type = 'OPEN_PALM';
      } else if (extendedCount === 0) {
        state.gesture.type = 'FIST';
      } else if (state.gesture.pinchActive) {
        state.gesture.type = 'PINCH';
      } else if (hand.index.extended && !hand.middle.extended) {
        state.gesture.type = 'POINTING';
      } else {
        state.gesture.type = 'IDLE';
      }
    }
  }

  private resolveTransformMode(): 'move' | 'rotate' | 'scale' {
    if (this.mode === 'ROTATE') return 'rotate';
    if (this.mode === 'SCALE') return 'scale';
    return 'move';
  }

  private getPrimaryHandCenter(hand: Hand): THREE.Vector3 {
    const thumb = hand.landmarks[HAND_LANDMARKS.THUMB_TIP];
    const index = hand.landmarks[HAND_LANDMARKS.INDEX_TIP];
    if (!thumb || !index) return new THREE.Vector3();
    return new THREE.Vector3(
      (thumb.x + index.x) / 2,
      (thumb.y + index.y) / 2,
      (thumb.z + index.z) / 2,
    );
  }

  private handlePinchStart(state: HandFingerState): void {
    const thumb = state.fingers.thumb;
    const index = state.fingers.index;
    const targetId = thumb.hoveredObjectId || index.hoveredObjectId;

    if (targetId && !this.objectManager.getObject(targetId)) return;

    if (targetId) {
      const grabObj = this.objectManager.getObject(targetId);
      if (!grabObj) return;

      if (!state.grabbedObjectIds.includes(targetId)) {
        state.grabbedObjectIds.push(targetId);
      }
      state.selectedObjectId = targetId;
      state.grabStartHandPosition = new THREE.Vector3(
        (thumb.worldPosition.x + index.worldPosition.x) / 2,
        (thumb.worldPosition.y + index.worldPosition.y) / 2,
        (thumb.worldPosition.z + index.worldPosition.z) / 2,
      );
      state.grabStartObjectPosition = { ...grabObj.transform.position };
      state.grabStartHandOrientation = state.currentHandOrientation ? { ...state.currentHandOrientation } : { pitch: 0, yaw: 0, roll: 0 };

      const otherState = state.side === 'Left' ? this.rightState : this.leftState;
      const otherGrabbedIds = otherState.grabbedObjectIds;
      const alreadyGrabbedByOther = otherGrabbedIds.includes(targetId);

      const tc = state.side === 'Left' ? this.leftTransformController : this.rightTransformController;
      tc.setCamera(this.camera!);
      tc.setWorldPositionProvider(this.handWorldPosProvider);
      tc.setViewportSize(this.viewportWidth, this.viewportHeight);
      const transformMode = this.resolveTransformMode();
      tc.setTransformMode(transformMode);
      tc.setAxisLock(this.axisLock);

      if (alreadyGrabbedByOther) {
        const otherTc = state.side === 'Left' ? this.rightTransformController : this.leftTransformController;
        const otherInitial = otherTc.getInitialHandPosition();
        const otherHand = otherTc.getActiveObjectId() === targetId && otherInitial ? otherInitial.clone() : null;

        if (otherHand) {
          const leftHand = state.side === 'Left' ? state.grabStartHandPosition!.clone() : otherHand;
          const rightHand = state.side === 'Right' ? state.grabStartHandPosition!.clone() : otherHand;
          this.initializeTwoHandGrab(targetId, leftHand, rightHand, tc);
        } else {
          tc.startTransform(
            targetId,
            transformMode,
            this.axisLock,
            state.grabStartHandPosition.clone(),
            state.grabStartHandOrientation ?? { pitch: 0, yaw: 0, roll: 0 },
            0.1,
          );
        }
      } else {
        tc.startTransform(
          targetId,
          transformMode,
          this.axisLock,
          state.grabStartHandPosition.clone(),
          state.grabStartHandOrientation ?? { pitch: 0, yaw: 0, roll: 0 },
          0.1,
        );
      }

      this.onSelectionChange([targetId]);
      this.onObjectGrabbed(state.side, targetId);
      if (this.controlsEnabled) {
        this.controlsEnabled = false;
      }
    }
  }

  private initializeTwoHandGrab(objectId: string, leftHand: THREE.Vector3, rightHand: THREE.Vector3, primaryTc: TransformController): void {
    const midpoint = new THREE.Vector3().addVectors(leftHand, rightHand).multiplyScalar(0.5);
    const distance = leftHand.distanceTo(rightHand);

    const obj = this.objectManager.getObject(objectId);
    if (!obj) return;

    const transform = { ...obj.transform };

    this.twoHandInitialData.set(objectId, {
      left: leftHand.clone(),
      right: rightHand.clone(),
      midpoint: midpoint.clone(),
      distance,
    });

    this.leftTransformController.startTwoHandTransform(
      objectId,
      transform,
      leftHand.clone(),
      rightHand.clone(),
      midpoint.clone(),
      distance,
      this.resolveTransformMode(),
      this.axisLock,
    );

    this.rightTransformController.startTwoHandTransform(
      objectId,
      transform,
      leftHand.clone(),
      rightHand.clone(),
      midpoint.clone(),
      distance,
      this.resolveTransformMode(),
      this.axisLock,
    );

    primaryTc.setAxisLock(this.axisLock);
  }

  private handlePinchHold(state: HandFingerState): void {
    if (state.grabbedObjectIds.length === 0) return;
    const targetId = state.grabbedObjectIds[state.grabbedObjectIds.length - 1];
    const obj = this.objectManager.getObject(targetId);
    if (!obj || obj.locked) return;

    const tc = state.side === 'Left' ? this.leftTransformController : this.rightTransformController;

    if (this.isTwoHandGrabbing(targetId)) {
      return;
    }

    const transformMode = this.resolveTransformMode();

    if (!tc.isActive() && targetId) {
      tc.setCamera(this.camera!);
      tc.setWorldPositionProvider(this.handWorldPosProvider);
      tc.setViewportSize(this.viewportWidth, this.viewportHeight);
      tc.setTransformMode(transformMode);
      tc.setAxisLock(this.axisLock);
      const thumb = state.fingers.thumb;
      const index = state.fingers.index;
      const center = new THREE.Vector3(
        (thumb.worldPosition.x + index.worldPosition.x) / 2,
        (thumb.worldPosition.y + index.worldPosition.y) / 2,
        (thumb.worldPosition.z + index.worldPosition.z) / 2,
      );
      tc.startTransform(
        targetId,
        transformMode,
        this.axisLock,
        center,
        state.grabStartHandOrientation ?? { pitch: 0, yaw: 0, roll: 0 },
        0.1,
      );
    }

    if (tc.isActive()) {
      tc.setAxisLock(this.axisLock);
      const thumb = state.fingers.thumb;
      const index = state.fingers.index;
      const center = new THREE.Vector3(
        (thumb.worldPosition.x + index.worldPosition.x) / 2,
        (thumb.worldPosition.y + index.worldPosition.y) / 2,
        (thumb.worldPosition.z + index.worldPosition.z) / 2,
      );
      tc.updateFromHand(center, state.currentHandOrientation ?? { pitch: 0, yaw: 0, roll: 0 }, 0.1);
    }
  }

  private handlePinchRelease(state: HandFingerState): void {
    const releasedId = state.grabbedObjectIds.length > 0 ? state.grabbedObjectIds[state.grabbedObjectIds.length - 1] : null;
    const tc = state.side === 'Left' ? this.leftTransformController : this.rightTransformController;
    if (tc.isActive()) {
      tc.endTransform();
    }
    this.removeGrab(state, releasedId);
  }

  private releaseHand(state: HandFingerState): void {
    const releasedIds = [...state.grabbedObjectIds];
    const tc = state.side === 'Left' ? this.leftTransformController : this.rightTransformController;
    if (tc.isActive()) {
      tc.endTransform();
    }
    this.releaseEditGrab(state);
    state.selectedObjectId = null;
    state.grabbedObjectIds = [];
    state.grabStartHandPosition = null;
    state.grabStartObjectPosition = null;
    state.grabStartHandOrientation = null;
    state.currentHandOrientation = null;
    state.gesture.pinchActive = false;
    state.gesture.state = 'IDLE';
    state.gesture.type = 'IDLE';
    for (const f of Object.keys(state.fingers) as FingerName[]) {
      state.fingers[f].hoveredObjectId = null;
      state.fingers[f].gesturePinch = false;
      this.updateCursorVisibility(state.side, f, false);
    }
    for (const id of releasedIds) {
      this.onObjectReleased(state.side, id);
    }
  }

  private removeGrab(state: HandFingerState, objectId: string | null): void {
    if (!objectId) return;
    state.grabbedObjectIds = state.grabbedObjectIds.filter(id => id !== objectId);
    if (state.selectedObjectId === objectId) {
      state.selectedObjectId = state.grabbedObjectIds.length > 0 ? state.grabbedObjectIds[state.grabbedObjectIds.length - 1] : null;
    }
    state.grabStartHandPosition = null;
    state.grabStartObjectPosition = null;
    state.grabStartHandOrientation = null;
    this.onObjectReleased(state.side, objectId);
    this.transitionRemainingHand(objectId, state.side);
    if (!this.isTwoHandGrabbing(objectId)) {
      this.twoHandInitialData.delete(objectId);
    }
  }

  private transitionRemainingHand(objectId: string, releasedHandSide: HandSide): void {
    const otherSide = releasedHandSide === 'Left' ? 'Right' : 'Left';
    const otherState = otherSide === 'Left' ? this.leftState : this.rightState;
    if (!otherState.grabbedObjectIds.includes(objectId)) return;
    if (!otherState.tracked) return;

    const otherTc = otherSide === 'Left' ? this.leftTransformController : this.rightTransformController;
    const thumb = otherState.fingers.thumb;
    const index = otherState.fingers.index;
    if (thumb.tracked && index.tracked) {
      const center = new THREE.Vector3(
        (thumb.worldPosition.x + index.worldPosition.x) / 2,
        (thumb.worldPosition.y + index.worldPosition.y) / 2,
        (thumb.worldPosition.z + index.worldPosition.z) / 2,
      );
      const grabObj = this.objectManager.getObject(objectId);
      if (grabObj) {
        otherTc.setCamera(this.camera!);
        otherTc.setWorldPositionProvider(this.handWorldPosProvider);
        otherTc.setViewportSize(this.viewportWidth, this.viewportHeight);
        otherTc.setTransformMode(this.resolveTransformMode());
        otherTc.setAxisLock(this.axisLock);
        otherTc.startTransform(
          objectId,
          this.resolveTransformMode(),
          this.axisLock,
          center,
          otherState.currentHandOrientation ?? { pitch: 0, yaw: 0, roll: 0 },
          0.1,
        );
      }
    }
  }

  private getGrabbingObjectIds(): string[] {
    const ids = new Set<string>();
    for (const id of this.leftState.grabbedObjectIds) ids.add(id);
    for (const id of this.rightState.grabbedObjectIds) ids.add(id);
    return [...ids];
  }

  private isTwoHandGrabbing(objectId: string): boolean {
    return this.leftState.grabbedObjectIds.includes(objectId) && this.rightState.grabbedObjectIds.includes(objectId);
  }

  private getTwoHandData(objectId: string): { left: THREE.Vector3; right: THREE.Vector3 } | null {
    const thumbL = this.leftState.fingers.thumb;
    const indexL = this.leftState.fingers.index;
    const thumbR = this.rightState.fingers.thumb;
    const indexR = this.rightState.fingers.index;

    if (!thumbL.tracked || !indexL.tracked || !thumbR.tracked || !indexR.tracked) return null;

    const leftCenter = new THREE.Vector3(
      (thumbL.worldPosition.x + indexL.worldPosition.x) / 2,
      (thumbL.worldPosition.y + indexL.worldPosition.y) / 2,
      (thumbL.worldPosition.z + indexL.worldPosition.z) / 2,
    );
    const rightCenter = new THREE.Vector3(
      (thumbR.worldPosition.x + indexR.worldPosition.x) / 2,
      (thumbR.worldPosition.y + indexR.worldPosition.y) / 2,
      (thumbR.worldPosition.z + indexR.worldPosition.z) / 2,
    );

    return { left: leftCenter, right: rightCenter };
  }

  private updateTwoHandTransform(): void {
    const objectIds = this.getGrabbingObjectIds();
    for (const objectId of objectIds) {
      if (!this.isTwoHandGrabbing(objectId)) continue;
      this.updateTwoHandGrab(objectId);
    }
  }

  private updateTwoHandGrab(objectId: string): void {
    const data = this.getTwoHandData(objectId);
    if (!data) return;

    const obj = this.objectManager.getObject(objectId);
    if (!obj) return;

    const currentLeft = data.left;
    const currentRight = data.right;
    const currentDistance = currentLeft.distanceTo(currentRight);

    const leftInitial = this.leftTransformController.getInitialHandPosition();
    const rightInitial = this.rightTransformController.getInitialHandPosition();
    const initialDistance = this.leftTransformController.getInitialHandDistance();

    if (!leftInitial || !rightInitial || initialDistance === null) {
      const midpoint = new THREE.Vector3().addVectors(currentLeft, currentRight).multiplyScalar(0.5);
      this.leftTransformController.setInitialHandPosition(midpoint);
      this.rightTransformController.setInitialHandPosition(midpoint);
      this.leftTransformController.setInitialHandDistance(currentDistance);
      this.rightTransformController.setInitialHandDistance(currentDistance);
      return;
    }

    const scaleFactor = currentDistance / initialDistance;
    const clampedScale = Math.max(0.1, Math.min(10, scaleFactor));

    const initialScale = this.leftTransformController.getActiveObjectId() === objectId
      ? this.leftTransformController.getInitialObjectTransform()?.scale
      : this.rightTransformController.getInitialObjectTransform()?.scale;

    const mode = this.resolveTransformMode();

    if (mode === 'move' || mode === 'scale') {
      if (initialScale) {
        if (this.axisLock === 'x') {
          this.objectManager.setScale(objectId, initialScale.x * clampedScale, initialScale.y, initialScale.z);
        } else if (this.axisLock === 'y') {
          this.objectManager.setScale(objectId, initialScale.x, initialScale.y * clampedScale, initialScale.z);
        } else if (this.axisLock === 'z') {
          this.objectManager.setScale(objectId, initialScale.x, initialScale.y, initialScale.z * clampedScale);
        } else {
          this.objectManager.setScale(objectId, initialScale.x * clampedScale, initialScale.y * clampedScale, initialScale.z * clampedScale);
        }
      }
    }

    const midpoint = new THREE.Vector3().addVectors(currentLeft, currentRight).multiplyScalar(0.5);
    const handDelta = new THREE.Vector3().subVectors(midpoint, leftInitial);

    const axisVector = this.axisLock === 'x' ? new THREE.Vector3(1, 0, 0) :
                       this.axisLock === 'y' ? new THREE.Vector3(0, 1, 0) :
                       this.axisLock === 'z' ? new THREE.Vector3(0, 0, 1) : null;

    const initialPosition = this.leftTransformController.getActiveObjectId() === objectId
      ? this.leftTransformController.getInitialObjectTransform()?.position
      : this.rightTransformController.getInitialObjectTransform()?.position;

    if (mode === 'rotate') {
      const initialData = this.twoHandInitialData.get(objectId);
      if (initialData) {
        const initialVector = new THREE.Vector3().subVectors(initialData.right, initialData.left);
        const currentVector = new THREE.Vector3().subVectors(currentRight, currentLeft);
        
        let initialAngle: number;
        let currentAngle: number;
        
        if (this.axisLock === 'x') {
          initialAngle = Math.atan2(initialVector.z, initialVector.y);
          currentAngle = Math.atan2(currentVector.z, currentVector.y);
        } else if (this.axisLock === 'z') {
          initialAngle = Math.atan2(initialVector.y, initialVector.x);
          currentAngle = Math.atan2(currentVector.y, currentVector.x);
        } else {
          initialAngle = Math.atan2(initialVector.z, initialVector.x);
          currentAngle = Math.atan2(currentVector.z, currentVector.x);
        }
        
        const deltaAngle = currentAngle - initialAngle;
        const initialRotation = this.leftTransformController.getInitialObjectTransform()?.rotation;
        
        if (initialRotation) {
          if (this.axisLock === 'x') {
            this.objectManager.setRotation(objectId, initialRotation.x + deltaAngle * 0.2, initialRotation.y, initialRotation.z);
          } else if (this.axisLock === 'z') {
            this.objectManager.setRotation(objectId, initialRotation.x, initialRotation.y, initialRotation.z + deltaAngle * 0.2);
          } else {
            this.objectManager.setRotation(objectId, initialRotation.x, initialRotation.y + deltaAngle * 0.2, initialRotation.z);
           }
         }
      }
    } else if (mode === 'move' || mode === 'scale') {
      if (initialPosition) {
        if (axisVector && this.axisLock) {
          const projectedScalar = handDelta.dot(axisVector);
          this.objectManager.setPosition(
            objectId,
            initialPosition.x + axisVector.x * projectedScalar,
            initialPosition.y + axisVector.y * projectedScalar,
            initialPosition.z + axisVector.z * projectedScalar,
          );
        } else {
          this.objectManager.setPosition(
            objectId,
            initialPosition.x + handDelta.x,
            initialPosition.y + handDelta.y,
            initialPosition.z + handDelta.z,
          );
        }
      }
    }
  }

  resetAll(): void {
    this.releaseHand(this.leftState);
    this.releaseHand(this.rightState);
    this.leftState.tracked = false;
    this.rightState.tracked = false;
  }

  resetHand(state: HandFingerState): void {
    this.releaseHand(state);
    state.tracked = false;
  }

  private updateCursorVisibility(side: HandSide, finger: FingerName, visible: boolean): void {
    const key = `${side}-${finger}`;
    const cursor = this.cursorObjects.get(key);
    if (cursor) {
      cursor.visible = visible;
    }
  }

  private updateCursorVisual(side: HandSide, finger: FingerName, fingerState: FingerCursor): void {
    const key = `${side}-${finger}`;
    let cursor = this.cursorObjects.get(key);

    if (!cursor && this.cursorGroup) {
      cursor = this.createCursorMesh(finger, side);
      this.cursorGroup.add(cursor);
      this.cursorObjects.set(key, cursor);
      fingerState.cursor3D = cursor;
    }

    if (cursor) {
      cursor.visible = fingerState.tracked;
      fingerState.cursor3D = cursor;
      const mesh = cursor as THREE.Mesh;
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.set(FINGER_COLORS[finger]);
      }
    }
  }

  private createCursorMesh(finger: FingerName, side: HandSide): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `${side}-${finger}-cursor`;

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshBasicMaterial({ color: FINGER_COLORS[finger], transparent: true, opacity: 0.9, depthTest: false })
    );
    sphere.renderOrder = 999;
    sphere.material.depthTest = false;
    group.add(sphere);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.18, 16),
      new THREE.MeshBasicMaterial({ color: FINGER_COLORS[finger], transparent: true, opacity: 0.6, depthTest: false })
    );
    ring.renderOrder = 998;
    ring.material.depthTest = false;
    group.add(ring);

    const labelSprite = this.createLabelSprite(`${side === 'Left' ? 'L' : 'R'} ${finger.charAt(0).toUpperCase()}`);
    labelSprite.position.y = 0.2;
    labelSprite.renderOrder = 1000;
    group.add(labelSprite);

    group.visible = false;
    return group;
  }

  private createLabelSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.roundRect(0, 0, 128, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.3, 0.15, 1);
    return sprite;
  }

  getDebugInfo(side: HandSide): FingerInteractionDebug {
    const state = side === 'Left' ? this.leftState : this.rightState;
    const fingerDebug = (f: FingerName) => ({
      tracked: state.fingers[f].tracked,
      worldPos: state.fingers[f].tracked ? { x: state.fingers[f].worldPosition.x, y: state.fingers[f].worldPosition.y, z: state.fingers[f].worldPosition.z } : null,
      hovered: state.fingers[f].hoveredObjectId,
    });

    return {
      side,
      tracked: state.tracked,
      fingers: {
        thumb: fingerDebug('thumb'),
        index: fingerDebug('index'),
        middle: fingerDebug('middle'),
        ring: fingerDebug('ring'),
        pinky: fingerDebug('pinky'),
      },
      gesture: state.gesture.type,
      gestureState: state.gesture.state,
      selected: state.selectedObjectId,
      grabbed: state.grabbedObjectIds.length > 0 ? state.grabbedObjectIds[state.grabbedObjectIds.length - 1] : null,
    };
  }

  getSelectableObjects(): THREE.Object3D[] {
    return this.selectableObjects;
  }
}

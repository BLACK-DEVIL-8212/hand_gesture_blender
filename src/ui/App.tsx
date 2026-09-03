import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { HandTrackingEngine } from '../vision/HandTrackingEngine';
import { GestureRecognitionEngine } from '../vision/GestureRecognitionEngine';
import { GestureStateMachine } from '../vision/GestureStateMachine';
import { ScreenToWorldRay } from '../interaction/ScreenToWorldRay';
import { HandWorldPositionProvider } from '../interaction/HandWorldPositionProvider';
import { TransformController } from '../interaction/TransformController';
import { FingerCursorManager } from '../interaction/FingerCursorManager';
import { Hand3DController } from '../hand/Hand3DController';
import { HAND_LANDMARKS } from '../vision/types';
import type { HandState, Hand } from '../vision/types';
import type { InteractionMode } from '../vision/GestureStateMachine';
import type { SceneObject } from '../scene/types';
import type { SubMode, Vertex, Face } from '../modeling/MeshData';
import { MeshEditor } from '../modeling/MeshEditor';
import { useEditorStore, createDefaultScene } from '../store/editor';
import { setHandStateForRender } from './Scene3D';
import {
  TopBar,
  LeftToolbar,
  PropertiesPanel,
  ObjectOutliner,
  StatusPanel,
  RadialMenu,
  DebugOverlay,
  HandTrackingPanel,
  HandPreview,
  ElectronTitleBar,
  EditModeControls,
} from './components';
import { Scene3DCanvas } from './Scene3D';
import './App.css';

declare global {
  interface Window {
    __HAND_DEBUG__: {
      handWorldPos?: { x: number; y: number; z: number };
      screenTip?: { x: number; y: number; z: number };
      ndc?: { x: number; y: number };
      canvasPos?: { x: number; y: number };
      canvasRect?: { left: number; top: number; width: number; height: number };
      depth?: number;
      depthConfidence?: number;
      depthConfidenceLabel?: 'LOW' | 'MEDIUM' | 'HIGH';
      worldDelta?: { x: number; y: number; z: number };
      projectedDelta?: { x: number; y: number; z: number };
      activeAxis?: string;
      objectPosition?: { x: number; y: number; z: number };
      selectedCount?: number;
      hitObject?: string | null;
      meshVertexCount?: number;
      rayOrigin?: { x: number; y: number; z: number };
      rayDirection?: { x: number; y: number; z: number };
      leftSelected?: string | null;
      leftGrabbed?: string | null;
      rightSelected?: string | null;
      rightGrabbed?: string | null;
    };
  }
}

function App() {
  const [appReady, setAppReady] = useState(false);
  const [showRadialMenu, setShowRadialMenu] = useState(false);

  const handTrackingRef = useRef<HandTrackingEngine | null>(null);
  const gestureEngineRef = useRef(new GestureRecognitionEngine());
  const stateMachineRef = useRef(new GestureStateMachine());
  const rayCasterRef = useRef(new ScreenToWorldRay());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const handWorldPosProviderRef = useRef(new HandWorldPositionProvider());
  const hand3dControllerRef = useRef<Hand3DController>(new Hand3DController());
  const transformControllerRef = useRef<TransformController | null>(null);

  const handStateRef = useRef<HandState | null>(null);
  const currentHoverIdRef = useRef<string | null>(null);
  const selectableObjectsRef = useRef<THREE.Object3D[]>([]);
  const lastCameraPanRef = useRef<{ x: number; y: number } | null>(null);
  const initialHandDistanceRef = useRef<number | null>(null);
  const undoStackRef = useRef<any[]>([]);
  const redoStackRef = useRef<any[]>([]);

  const selectedVertexIdsRef = useRef<Set<string>>(new Set());
  const selectedEdgeIdsRef = useRef<Set<string>>(new Set());
  const selectedFaceIdsRef = useRef<Set<string>>(new Set());
  const vertexGrabOffsetRef = useRef<THREE.Vector3 | null>(null);
  const faceExtrudeRef = useRef<{ faceId: string; startPos: THREE.Vector3 } | null>(null);
  const knifePathRef = useRef<THREE.Vector3[]>([])

  const lastGestureStateRef = useRef<string | null>(null);
  const lastGestureTypeRef = useRef<string | null>(null);
  const lastHitIdRef = useRef<string | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);
  const lastTransformModeRef = useRef<string | null>(null);
  const lastActiveAxisRef = useRef<string | null>(null);

  const interactionManagerRef = useRef<FingerCursorManager | null>(null);

  const [pipelineDebug, setPipelineDebug] = useState({
    cameraEnabled: false,
    cameraStatus: 'off' as 'off' | 'starting' | 'active' | 'error',
    mediaPipeReady: false,
    landmarkCount: 0,
    leftHandDetected: false,
    rightHandDetected: false,
    indexTip: null as { x: number; y: number; z: number } | null,
    thumbTip: null as { x: number; y: number; z: number } | null,
    palmCenter: null as { x: number; y: number; z: number } | null,
    pinchDistance: 0,
    isPinching: false,
    gesture: 'IDLE',
    gestureConfidence: 0,
    gestureState: 'IDLE' as string,
    handWorldPos: null as { x: number; y: number; z: number } | null,
    rayActive: false,
    rayHitId: null as string | null,
    selectedObjectId: null as string | null,
    activeAxis: 'NONE' as string,
    transformActive: false,
    transformMode: 'NONE' as string,
    objectPosition: null as { x: number; y: number; z: number } | null,
    objectName: null as string | null,
    trackingFPS: 0,
  });

  const store = useEditorStore.getState();
  const mode = useEditorStore((s) => s.mode);
  const axisLock = useEditorStore((s) => s.axisLock);
  const cameraStatus = useEditorStore((s) => s.cameraStatus);
  const cameraEnabled = useEditorStore((s) => s.cameraEnabled);
  const debugMode = useEditorStore((s) => s.debugMode);
  const showCameraPreview = useEditorStore((s) => s.showCameraPreview);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editSubMode = useEditorStore((s) => s.editSubMode);
  const brushSettings = useEditorStore((s) => s.brushSettings);
  const editTool = useEditorStore((s) => s.editTool);
  const currentGesture = useEditorStore((s) => s.currentGesture);
  const gestureConfidence = useEditorStore((s) => s.gestureConfidence);
  const handCount = useEditorStore((s) => s.handCount);
  const leftHandConfidence = useEditorStore((s) => s.leftHandConfidence);
  const rightHandConfidence = useEditorStore((s) => s.rightHandConfidence);
  const fps = useEditorStore((s) => s.fps);
  const recording = useEditorStore((s) => s.recording);

  const setCameraStatus = useEditorStore((s) => s.setCameraStatus);
  const setCameraEnabled = useEditorStore((s) => s.setCameraEnabled);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const setEditTool = useEditorStore((s) => s.setEditTool);

  const handleHandFrame = useCallback((state: HandState) => {
    handStateRef.current = state;
    setHandStateForRender(state);

    const store = useEditorStore.getState();
    if (!state.tracked || state.handCount === 0) {
      store.setHandInfo(0, 0, 0);
      if (currentHoverIdRef.current) {
        store.setHoverId(null);
        currentHoverIdRef.current = null;
      }
      if (interactionManagerRef.current) {
        interactionManagerRef.current.resetAll();
      }
      if (transformControllerRef.current?.isActive()) {
        transformControllerRef.current.endTransform();
      }
      return;
    }

    const gesture = gestureEngineRef.current.recognize(state.hands);
    void stateMachineRef.current.update(gesture);

    store.setGestureInfo(gesture.type, gesture.confidence);
    store.setHandInfo(
      state.handCount,
      state.leftHand?.confidence || 0,
      state.rightHand?.confidence || 0,
    );

    const camera = cameraRef.current;
    if (camera) {
      rayCasterRef.current.setScreenSize(window.innerWidth, window.innerHeight);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (!handWorldPosProviderRef.current) {
        handWorldPosProviderRef.current = new HandWorldPositionProvider();
      }
      handWorldPosProviderRef.current.setCamera(camera);
      handWorldPosProviderRef.current.setViewportSize(window.innerWidth, window.innerHeight);

      if (!interactionManagerRef.current) {
        interactionManagerRef.current = new FingerCursorManager(
          store.objectManager,
          rayCasterRef.current,
          handWorldPosProviderRef.current,
          (ids) => { store.setSelectedIds(ids); },
          (id) => { store.setHoverId(id); currentHoverIdRef.current = id; },
          (leftDebug, rightDebug) => {
            if (debugMode) {
              console.log('[LEFT HAND]', leftDebug);
              console.log('[RIGHT HAND]', rightDebug);
            }
          },
          (hand, objectId) => {
            console.log(`[${hand.toUpperCase()} GRAB]`, objectId);
          },
          (hand, objectId) => {
            console.log(`[${hand.toUpperCase()} RELEASE]`, objectId);
          },
        );
      }

      const manager = interactionManagerRef.current;
      manager.setCamera(camera);
      manager.setWorldPositionProvider(handWorldPosProviderRef.current);
      manager.setViewportSize(viewportWidth, viewportHeight);
      manager.setMode(stateMachineRef.current.getMode());
      manager.setAxisLock(useEditorStore.getState().axisLock);
      manager.setSelectableObjects(selectableObjectsRef.current);

      const objects = store.objectManager.getAllObjects();
      for (const obj of objects) {
        rayCasterRef.current.registerObjectData(
          obj.id,
          { x: obj.transform.position.x, y: obj.transform.position.y, z: obj.transform.position.z },
          { x: Math.max(obj.transform.scale.x, 0.01), y: Math.max(obj.transform.scale.y, 0.01), z: Math.max(obj.transform.scale.z, 0.01) },
        );
      }

      manager.update(state.hands);

      const leftState = manager.getLeftState();
      const rightState = manager.getRightState();

      const leftHand = state.leftHand;
      const rightHand = state.rightHand;
      const primaryHand = rightHand || leftHand || state.hands[0];
      const tip = primaryHand?.landmarks[HAND_LANDMARKS.INDEX_TIP];
      const thumb = primaryHand?.landmarks[HAND_LANDMARKS.THUMB_TIP];
      const palm = primaryHand?.palmCenter;
      let hoverHitId: string | null = null;
      let worldPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
      let currentAxisLock: any = null;
      if (tip && primaryHand) {
        const ndcX = tip.x * 2 - 1;
        const ndcY = 1 - tip.y * 2;
        const handWorldResult = handWorldPosProviderRef.current.getHandWorldPosition(
          primaryHand,
          viewportWidth,
          viewportHeight,
        );
        worldPos = handWorldResult ? handWorldResult.worldPosition : new THREE.Vector3(0, 0, 0);
        rayCasterRef.current.setObjectWorldPosition('cursor', { x: worldPos.x, y: worldPos.y, z: worldPos.z });

        const mode = stateMachineRef.current.getMode();
        const isTransformMode = mode === 'MOVE' || mode === 'ROTATE' || mode === 'SCALE' || mode === 'EDIT';
        currentAxisLock = useEditorStore.getState().axisLock;

         hoverHitId = null;
           if (mode === 'SELECT' || isTransformMode || mode === 'CREATE' || mode === 'CAMERA') {
            const hitObject = rayCasterRef.current.getObjectAtScreenFromMeshes(ndcX, ndcY, camera, selectableObjectsRef.current);
            hoverHitId = hitObject ? (hitObject.userData.id as string) : null;
          }

         if (mode === 'SELECT' || isTransformMode || mode === 'CREATE' || mode === 'CAMERA') {
           if (hoverHitId !== currentHoverIdRef.current) {
             store.setHoverId(hoverHitId);
             currentHoverIdRef.current = hoverHitId;
           }
         }

         console.log('[PIPELINE]', {
           gestureType: gesture.type,
           gestureState: gesture.state,
           mode,
           isTransformMode,
            hitId: hoverHitId,
            leftSelected: leftState.selectedObjectId,
            leftGrabbed: leftState.grabbedObjectIds.length > 0 ? leftState.grabbedObjectIds[leftState.grabbedObjectIds.length - 1] : null,
            rightSelected: rightState.selectedObjectId,
            rightGrabbed: rightState.grabbedObjectIds.length > 0 ? rightState.grabbedObjectIds[rightState.grabbedObjectIds.length - 1] : null,
            transformActive: manager.getTransformController('Left').isActive() || manager.getTransformController('Right').isActive(),
           worldPos: worldPos ? { x: Number(worldPos.x.toFixed(4)), y: Number(worldPos.y.toFixed(4)), z: Number(worldPos.z.toFixed(4)) } : null,
           axisLock: currentAxisLock,
         });

        const selectedObj = leftState.selectedObjectId || rightState.selectedObjectId;
        const selectedObjData = selectedObj ? store.objectManager.getObject(selectedObj) : null;
        const leftGrabbedObj = leftState.grabbedObjectIds.length > 0 ? store.objectManager.getObject(leftState.grabbedObjectIds[leftState.grabbedObjectIds.length - 1]) : null;
        const rightGrabbedObj = rightState.grabbedObjectIds.length > 0 ? store.objectManager.getObject(rightState.grabbedObjectIds[rightState.grabbedObjectIds.length - 1]) : null;

        console.log('[4 SELECTION]', {
          leftSelected: !!leftState.selectedObjectId,
          leftObjectName: leftGrabbedObj?.name || 'None',
          leftUuid: leftState.selectedObjectId || 'None',
          rightSelected: !!rightState.selectedObjectId,
          rightObjectName: rightGrabbedObj?.name || 'None',
          rightUuid: rightState.selectedObjectId || 'None',
        });

        console.log('[5 GESTURE]', {
          state: gesture.state,
          gesture: gesture.type,
          pinch: gesture.type === 'PINCH' || gesture.type === 'GRAB' || gesture.type === 'FIST',
        });

        if (debugMode) {
          const activeAxis = currentAxisLock ? currentAxisLock.toUpperCase() : 'NONE';
          const transformModeLabel = isTransformMode ? mode : 'NONE';

          if (lastGestureStateRef.current !== gesture.state || lastGestureTypeRef.current !== gesture.type) {
            if (gesture.state === 'PINCH_START') {
              console.log('[GESTURE] PINCH START');
            } else if (gesture.state === 'PINCH_HOLD') {
              console.log('[GESTURE] PINCH HOLD');
            } else if (gesture.state === 'PINCH_RELEASE') {
              console.log('[GESTURE] PINCH RELEASE');
            } else if (gesture.type === 'POINTING') {
              console.log('[GESTURE] POINT');
            } else if (gesture.type === 'FIST') {
              console.log('[GESTURE] FIST');
            }
            if (gesture.state === 'PINCH_START' && hoverHitId) {
              console.log('[RAYCAST] hit:', hoverHitId);
            }
          }

          setPipelineDebug({
            cameraEnabled,
            cameraStatus: cameraStatus as any,
            mediaPipeReady: cameraStatus === 'active',
            landmarkCount: primaryHand.landmarks.length,
            leftHandDetected: !!state.leftHand,
            rightHandDetected: !!state.rightHand,
            indexTip: tip ? { x: tip.x, y: tip.y, z: tip.z } : null,
            thumbTip: thumb ? { x: thumb.x, y: thumb.y, z: thumb.z } : null,
            palmCenter: palm ? { x: palm.x, y: palm.y, z: palm.z } : null,
            pinchDistance: gesture.pinchDistance || 0,
            isPinching: gesture.type === 'PINCH' || gesture.type === 'GRAB' || gesture.type === 'FIST',
            gesture: gesture.type,
            gestureConfidence: gesture.confidence,
            gestureState: gesture.state,
            handWorldPos: worldPos ? { x: worldPos.x, y: worldPos.y, z: worldPos.z } : null,
            rayActive: !!worldPos && hoverHitId !== null,
            rayHitId: hoverHitId,
            selectedObjectId: leftState.selectedObjectId || rightState.selectedObjectId,
            activeAxis,
            transformActive: manager.getTransformController('Left').isActive() || manager.getTransformController('Right').isActive(),
            transformMode: transformModeLabel,
            objectPosition: selectedObjData ? { x: selectedObjData.transform.position.x, y: selectedObjData.transform.position.y, z: selectedObjData.transform.position.z } : null,
            objectName: selectedObjData ? selectedObjData.name : null,
            trackingFPS: handTrackingRef.current?.getFPS() || 0,
          });

          window.__HAND_DEBUG__ = {
            ...window.__HAND_DEBUG__,
            handWorldPos: worldPos ? { x: worldPos.x, y: worldPos.y, z: worldPos.z } : undefined,
            screenTip: tip ? { x: tip.x, y: tip.y, z: tip.z } : undefined,
            ndc: tip ? { x: ndcX, y: ndcY } : undefined,
            hitObject: hoverHitId,
            leftSelected: leftState.selectedObjectId,
            leftGrabbed: leftState.grabbedObjectIds.length > 0 ? leftState.grabbedObjectIds[leftState.grabbedObjectIds.length - 1] : null,
            rightSelected: rightState.selectedObjectId,
            rightGrabbed: rightState.grabbedObjectIds.length > 0 ? rightState.grabbedObjectIds[rightState.grabbedObjectIds.length - 1] : null,
          };

          lastGestureStateRef.current = gesture.state;
          lastGestureTypeRef.current = gesture.type;
          lastHitIdRef.current = hoverHitId;
          lastSelectedIdRef.current = leftState.selectedObjectId || rightState.selectedObjectId;
          lastTransformModeRef.current = transformModeLabel;
          lastActiveAxisRef.current = activeAxis;
        }

         if (mode === 'CREATE') {
          if ((gesture.type === 'PINCH' || gesture.type === 'GRAB' || gesture.type === 'FIST') && gesture.state === 'PINCH_START' && hoverHitId) {
          const obj = useEditorStore.getState().objectManager.createObject('cube', {
            name: 'Cube',
            transform: {
              position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
            },
          });
          store.setSelectedIds([obj.id]);
          stateMachineRef.current.setSelectedObjectId(obj.id);
          stateMachineRef.current.setMode('MOVE');
          useEditorStore.getState().setMode('MOVE');
          if (!transformControllerRef.current) {
            transformControllerRef.current = new TransformController(useEditorStore.getState().objectManager);
          }
          const tcCreate = transformControllerRef.current;
          tcCreate.setCamera(camera);
          tcCreate.setWorldPositionProvider(handWorldPosProviderRef.current);
          tcCreate.setViewportSize(viewportWidth, viewportHeight);
          tcCreate.setTransformMode('move');
          tcCreate.setAxisLock(currentAxisLock);

          tcCreate.startTransform(
            obj.id,
            'move',
            currentAxisLock,
            worldPos.clone(),
            { ...primaryHand.orientation },
            0.1,
          );
           if (controlsRef.current) controlsRef.current.enabled = false;
         }
       }

        if (mode === 'CAMERA') {
         if (!state.hasTwoHands) {
           if (gesture.type === 'OPEN_PALM') {
             const panX = primaryHand.palmCenter.x - (lastCameraPanRef.current?.x ?? primaryHand.palmCenter.x);
             const panY = primaryHand.palmCenter.y - (lastCameraPanRef.current?.y ?? primaryHand.palmCenter.y);
             if (controlsRef.current) {
               controlsRef.current.pan(new THREE.Vector3(-panX * 20, -panY * 20, 0));
             }
             lastCameraPanRef.current = { x: primaryHand.palmCenter.x, y: primaryHand.palmCenter.y };
           } else {
             lastCameraPanRef.current = null;
           }
         }

         if (state.hasTwoHands && gesture.handDistance !== undefined && initialHandDistanceRef.current !== null && initialHandDistanceRef.current > 0) {
           const ratio = gesture.handDistance / initialHandDistanceRef.current;
           const zoomFactor = 1 / ratio;
           
           const cam = cameraRef.current;
           const controls = controlsRef.current;
           if (cam && controls) {
             const target = controls.target;
             const direction = new THREE.Vector3().subVectors(cam.position, target).normalize();
             const currentDistance = cam.position.distanceTo(target);
             const minDistance = 2;
             const maxDistance = 200;
             
             const newDistance = THREE.MathUtils.clamp(currentDistance * zoomFactor, minDistance, maxDistance);
             cam.position.copy(target).addScaledVector(direction, newDistance);
             controls.update();
           }
         } else {
           initialHandDistanceRef.current = null;
         }
        }

        if (store.recording) {
         useEditorStore.getState().recordedData.push({
           timestamp: Date.now(),
           gesture,
           handState: state,
         });
         if (useEditorStore.getState().recordedData.length > 300) {
           useEditorStore.getState().recordedData.shift();
         }
       }
     }
   }

   store.setFPS(handTrackingRef.current?.getFPS() || 0);
 }, [setSelectedIds, debugMode, cameraStatus, cameraEnabled]);

  useEffect(() => {
    const init = async () => {
      await createDefaultScene();
      setAppReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!appReady) return;
    setCameraStatus('off');
    return () => {
      if (handTrackingRef.current) {
        handTrackingRef.current.dispose();
        handTrackingRef.current = null;
      }
    };
  }, [appReady, setCameraStatus]);

  const startHandTracking = useCallback(async () => {
    if (handTrackingRef.current) {
      await handTrackingRef.current.stop();
      handTrackingRef.current = null;
    }
    
    let ht: HandTrackingEngine | null = null;
    try {
      ht = new HandTrackingEngine({
        maxHands: 2,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
        smoothingMethod: 'one-euro',
        smoothingFactor: 0.5,
      });

      setCameraStatus('starting');
      await ht.initialize();
      await ht.start();
      setCameraStatus('active');
      setCameraEnabled(true);
      handTrackingRef.current = ht;
      ht = null;

      handTrackingRef.current.onFrame((state: HandState) => {
        handleHandFrame(state);
      });
    } catch (e) {
      if (ht) {
        await ht.stop();
      } else if (handTrackingRef.current) {
        await handTrackingRef.current.stop();
        handTrackingRef.current = null;
      }
      setCameraStatus('error');
      setCameraEnabled(false);
      console.error('Failed to start hand tracking:', e);
    }
  }, [setCameraStatus, setCameraEnabled, handleHandFrame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      }
      if (['g', 'r', 's'].includes(e.key.toLowerCase())) {
        const modeMap: Record<string, InteractionMode> = {
          g: 'MOVE', r: 'ROTATE', s: 'SCALE',
        };
        const newMode = modeMap[e.key.toLowerCase()];
        if (newMode) {
          e.preventDefault();
          stateMachineRef.current.setMode(newMode);
          useEditorStore.getState().setMode(newMode);
          if (interactionManagerRef.current) {
            interactionManagerRef.current.setMode(newMode);
          }
        }
      }
      if (['x', 'y', 'z'].includes(e.key.toLowerCase())) {
        const axisMap: Record<string, 'x' | 'y' | 'z'> = {
          x: 'x', y: 'y', z: 'z',
        };
        const axis = axisMap[e.key.toLowerCase()];
        if (axis) {
          e.preventDefault();
          const current = useEditorStore.getState().axisLock;
          stateMachineRef.current.setAxisLock(current === axis ? null : axis);
          useEditorStore.getState().setAxisLock(current === axis ? null : axis);
          if (interactionManagerRef.current) {
            interactionManagerRef.current.setAxisLock(current === axis ? null : axis);
          }
        }
      }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          focusSelected();
        } else {
          frameAll();
        }
      }
      if (e.key === 'a' && e.ctrlKey) {
        e.preventDefault();
        stateMachineRef.current.setMode('CREATE');
        useEditorStore.getState().setMode('CREATE');
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentMode = stateMachineRef.current.getMode();
        const newMode = currentMode === 'EDIT' ? 'SELECT' : 'EDIT';
        stateMachineRef.current.setMode(newMode);
        useEditorStore.getState().setMode(newMode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const manager = interactionManagerRef.current;
    if (!manager) return;
    const store = useEditorStore.getState();
    manager.setEditTool(store.editTool);
    manager.setEditSubMode(store.editSubMode);
    manager.setEditInfluenceRadius(store.brushSettings.radius);
    manager.setEditStrength(store.brushSettings.strength);
  }, [mode, editSubMode, brushSettings, editTool]);

  const handleUndo = useCallback(() => {
    const cmd = undoStackRef.current.pop();
    if (!cmd) return;
    redoStackRef.current.push(cmd);
    const obj = useEditorStore.getState().objectManager.getObject(cmd.objId);
    if (obj) {
      if (cmd.type === 'transform') {
        obj.transform.position = cmd.fromPos;
        obj.transform.rotation = cmd.fromRot;
        obj.transform.scale = cmd.fromScale;
      } else if (cmd.type === 'move') {
        obj.transform.position = cmd.from;
      }
    }
  }, []);

  const handleRedo = useCallback(() => {
    const cmd = redoStackRef.current.pop();
    if (!cmd) return;
    undoStackRef.current.push(cmd);
    const obj = useEditorStore.getState().objectManager.getObject(cmd.objId);
    if (obj) {
      if (cmd.type === 'transform') {
        obj.transform.position = cmd.toPos;
        obj.transform.rotation = cmd.toRot;
        obj.transform.scale = cmd.toScale;
      } else if (cmd.type === 'move') {
        obj.transform.position = cmd.to;
      }
    }
  }, []);

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedIds) {
      useEditorStore.getState().objectManager.removeObject(id);
    }
    setSelectedIds([]);
    if (interactionManagerRef.current) {
      interactionManagerRef.current.resetAll();
    }
    if (transformControllerRef.current?.isActive()) {
      transformControllerRef.current.endTransform();
    }
  }, [selectedIds, setSelectedIds]);

  const handleModeChange = useCallback((newMode: InteractionMode) => {
    stateMachineRef.current.setMode(newMode);
    useEditorStore.getState().setMode(newMode);
    currentHoverIdRef.current = null;
    lastCameraPanRef.current = null;
    initialHandDistanceRef.current = null;
    if (interactionManagerRef.current) {
      interactionManagerRef.current.resetAll();
      interactionManagerRef.current.setMode(newMode);
      const store = useEditorStore.getState();
      interactionManagerRef.current.setEditTool(store.editTool);
      interactionManagerRef.current.setEditSubMode(store.editSubMode);
      const brushSettings = store.brushSettings;
      interactionManagerRef.current.setEditInfluenceRadius(brushSettings.radius);
      interactionManagerRef.current.setEditStrength(brushSettings.strength);
    }
    if (transformControllerRef.current?.isActive()) {
      transformControllerRef.current.endTransform();
    }
  }, []);

  const handleAddObject = useCallback((type: SceneObject['type']) => {
    const obj = useEditorStore.getState().objectManager.createObject(type);
    setSelectedIds([obj.id]);
  }, [setSelectedIds]);

  const toggleCamera = useCallback(() => {
    if (cameraEnabled || cameraStatus === 'error') {
      if (handTrackingRef.current) {
        handTrackingRef.current.stop();
        handTrackingRef.current = null;
      }
      setCameraEnabled(false);
      setCameraStatus('off');
      if (cameraStatus === 'error') {
        startHandTracking();
      }
    } else {
      startHandTracking();
    }
  }, [cameraEnabled, cameraStatus, startHandTracking]);

  const frameAll = useCallback(() => {
    const store = useEditorStore.getState();
    const objects = store.objectManager.getAllObjects();
    if (objects.length === 0 || !cameraRef.current || !controlsRef.current) return;

    const box = new THREE.Box3();
    for (const obj of objects) {
      const t = obj.transform as any;
      box.min.x = Math.min(box.min.x, t.position.x - 1);
      box.min.y = Math.min(box.min.y, t.position.y - 1);
      box.min.z = Math.min(box.min.z, t.position.z - 1);
      box.max.x = Math.max(box.max.x, t.position.x + 1);
      box.max.y = Math.max(box.max.y, t.position.y + 1);
      box.max.z = Math.max(box.max.z, t.position.z + 1);
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim / (2 * Math.tan((cameraRef.current.fov * Math.PI / 180) / 2));

    const cam = cameraRef.current;
    cam.position.set(center.x, center.y + distance * 0.5, center.z + distance);
    controlsRef.current.target.set(center.x, center.y, center.z);
    controlsRef.current.update();
  }, []);

  const focusSelected = useCallback(() => {
    const store = useEditorStore.getState();
    const selectedIds = store.selectedIds;
    if (selectedIds.length === 0 || !cameraRef.current || !controlsRef.current) return;

    const box = new THREE.Box3();
    for (const id of selectedIds) {
      const obj = store.objectManager.getObject(id);
      if (obj) {
        const t = obj.transform as any;
        box.min.x = Math.min(box.min.x, t.position.x - 0.5);
        box.min.y = Math.min(box.min.y, t.position.y - 0.5);
        box.min.z = Math.min(box.min.z, t.position.z - 0.5);
        box.max.x = Math.max(box.max.x, t.position.x + 0.5);
        box.max.y = Math.max(box.max.y, t.position.y + 0.5);
        box.max.z = Math.max(box.max.z, t.position.z + 0.5);
      }
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;
    const distance = maxDim / (2 * Math.tan((cameraRef.current.fov * Math.PI / 180) / 2));
    const offset = distance * 0.3;

    const cam = cameraRef.current;
    const dir = new THREE.Vector3().subVectors(cam.position, center).normalize();
    cam.position.copy(center).add(dir.multiplyScalar(offset));
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, []);

  const handleSave = useCallback(() => {
    const scene = useEditorStore.getState().objectManager.toJSON();
    const project = {
      metadata: {
        name: 'HandControl Project',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      scene,
      settings: {},
    };
    const content = JSON.stringify(project, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.my3d';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.my3d, .json';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const project = JSON.parse(text);
        if (project.scene) {
          useEditorStore.getState().objectManager.clear();
          useEditorStore.getState().selectionManager.clear();
          for (const obj of project.scene.objects || []) {
            useEditorStore.getState().objectManager.createObject(obj.type, obj);
          }
        }
      } catch (err) {
        console.error('Failed to open project:', err);
      }
    };
    input.click();
  }, []);

  return (
    <div className="app">
      <ElectronTitleBar />
      <TopBar
        onNewScene={() => createDefaultScene()}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAddObject={() => setShowRadialMenu(true)}
        onSettings={() => {}}
        mode={mode}
        onModeChange={handleModeChange}
        canUndo={undoStackRef.current.length > 0}
        canRedo={redoStackRef.current.length > 0}
      />

      <div className="main-content">
        <div className="toolbar-left">
          <LeftToolbar
            mode={mode}
            onModeChange={handleModeChange}
            onAddObject={handleAddObject}
          onAxisLock={(axis) => {
            stateMachineRef.current.setAxisLock(axis);
            useEditorStore.getState().setAxisLock(axis);
            if (interactionManagerRef.current) {
              interactionManagerRef.current.setAxisLock(axis);
            }
          }}
          axisLock={axisLock}
          onFrameAll={frameAll}
          onFocusSelected={focusSelected}
        />
        </div>

        <div className="viewport-container">
          {!cameraEnabled && cameraStatus === 'off' && (
            <div className="camera-prompt">
              <div className="camera-prompt__content">
                <div className="camera-prompt__icon">📷</div>
                <h3>Enable Hand Tracking</h3>
                <p>Use your hands to control the 3D viewport</p>
                <button className="camera-prompt__btn" onClick={toggleCamera}>
                  Start Camera
                </button>
              </div>
            </div>
          )}

          <div className="canvas-wrapper">
            <Canvas
              camera={{ position: [10, 8, 12], fov: 60, near: 0.1, far: 1000 }}
              gl={{ preserveDrawingBuffer: true, antialias: true }}
              onCreated={({ camera, gl, controls }) => {
                cameraRef.current = camera as THREE.PerspectiveCamera;
                controlsRef.current = controls;
                if (handWorldPosProviderRef.current) {
                  handWorldPosProviderRef.current.setCamera(camera as THREE.PerspectiveCamera);
                }
              }}
            >
              <Scene3DCanvas
                rayCaster={rayCasterRef.current}
                onCameraReady={(cam) => {
                  cameraRef.current = cam;
                  if (handWorldPosProviderRef.current) {
                    handWorldPosProviderRef.current.setCamera(cam);
                  }
                  if (interactionManagerRef.current) {
                    interactionManagerRef.current.setCamera(cam);
                  }
                }}
                controlsRef={controlsRef}
                selectableObjectsRef={selectableObjectsRef}
                fingerCursorManager={interactionManagerRef.current}
              />
            </Canvas>
          </div>

          <HandTrackingPanel
            cameraEnabled={cameraEnabled}
            cameraStatus={cameraStatus}
            onToggleCamera={toggleCamera}
            handCount={handCount}
            leftHandConfidence={leftHandConfidence}
            rightHandConfidence={rightHandConfidence}
            mode={mode}
            currentGesture={currentGesture}
            gestureConfidence={gestureConfidence}
          />

          <HandPreview
            handTrackingEngine={handTrackingRef.current}
            cameraEnabled={cameraEnabled}
          />
        </div>

        <div className="right-panel">
          <EditModeControls mode={mode} onModeChange={handleModeChange} />
          <div className="object-outliner-container">
            <ObjectOutliner
              objects={useEditorStore.getState().objectManager.getAllObjects()}
              selectedIds={selectedIds}
              onObjectSelect={(id) => {
                setSelectedIds([id]);
                stateMachineRef.current.setSelectedObjectId(id);
              }}
              onObjectDelete={handleDeleteSelected}
              onObjectDuplicate={(id) => {
                const obj = useEditorStore.getState().objectManager.duplicateObject(id);
                if (obj) setSelectedIds([obj.id]);
              }}
            />
          </div>
          <div className="properties-panel-container">
            <PropertiesPanel
              selectedObjects={selectedIds.length > 0
                ? selectedIds.map(id => useEditorStore.getState().objectManager.getObject(id)).filter((o): o is SceneObject => o !== undefined)
                : []
              }
              onUpdatePosition={(id, x, y, z) => {
                const obj = useEditorStore.getState().objectManager.getObject(id);
                if (obj) obj.transform.position = { x, y, z };
              }}
              onUpdateRotation={(id, x, y, z) => {
                const obj = useEditorStore.getState().objectManager.getObject(id);
                if (obj) obj.transform.rotation = { x, y, z };
              }}
              onUpdateScale={(id, x, y, z) => {
                const obj = useEditorStore.getState().objectManager.getObject(id);
                if (obj) obj.transform.scale = { x, y, z };
              }}
              onUpdateMaterial={(id, material) => {
                const obj = useEditorStore.getState().objectManager.getObject(id);
                if (obj) obj.material = { ...obj.material, ...material };
              }}
              onUpdateName={(id, name) => {
                const obj = useEditorStore.getState().objectManager.getObject(id);
                if (obj) obj.name = name;
              }}
            />
          </div>
        </div>
      </div>

      <div className="bottom-panel">
        <StatusPanel
          gesture={currentGesture}
          gestureConfidence={gestureConfidence}
          mode={mode}
          axisLock={axisLock}
          selectedObject={selectedIds.length > 0
            ? useEditorStore.getState().objectManager.getObject(selectedIds[0])?.name || null
            : null
          }
          handCount={handCount}
          leftHandConfidence={leftHandConfidence}
          rightHandConfidence={rightHandConfidence}
          cameraStatus={cameraStatus}
          fps={fps}
          pinchDistance={handStateRef.current?.hands[0] && (handStateRef.current.hands[0].handedness === 'Right' ? handStateRef.current.hands.find(h => h.handedness === 'Right') : handStateRef.current.hands[0])?.landmarks
            ? (() => {
                const hand = handStateRef.current!.hands.find(h => h.handedness === 'Right') || handStateRef.current!.hands[0];
                if (!hand) return undefined;
                const thumbTip = hand.landmarks[4];
                const indexTip = hand.landmarks[8];
                if (!thumbTip || !indexTip) return undefined;
                const dx = thumbTip.x - indexTip.x;
                const dy = thumbTip.y - indexTip.y;
                const dz = (thumbTip.z || 0) - (indexTip.z || 0);
                return Math.sqrt(dx * dx + dy * dy + dz * dz);
              })()
            : undefined}
          handPosition={handStateRef.current?.hands[0]?.landmarks[HAND_LANDMARKS.INDEX_TIP]
            ? {
                x: handStateRef.current.hands.find(h => h.handedness === 'Right')?.landmarks[HAND_LANDMARKS.INDEX_TIP].x ?? 0,
                y: handStateRef.current.hands.find(h => h.handedness === 'Right')?.landmarks[HAND_LANDMARKS.INDEX_TIP].y ?? 0,
                z: handStateRef.current.hands.find(h => h.handedness === 'Right')?.landmarks[HAND_LANDMARKS.INDEX_TIP].z ?? 0,
              }
            : null}
        />
      </div>

      {showRadialMenu && (
        <RadialMenu
          visible={showRadialMenu}
          centerX={window.innerWidth / 2}
          centerY={window.innerHeight / 2}
          onSelect={(type) => {
            handleAddObject(type);
            setShowRadialMenu(false);
          }}
          onClose={() => setShowRadialMenu(false)}
        />
      )}

      {debugMode && (
        <DebugOverlay
          handState={handStateRef.current}
          gesture={currentGesture}
          gestureConfidence={gestureConfidence}
          mode={mode}
          selectedIds={selectedIds}
          handCount={handCount}
          leftHandConfidence={leftHandConfidence}
          rightHandConfidence={rightHandConfidence}
          fps={fps}
          cameraStatus={cameraStatus}
          axisLock={axisLock}
          transformDebugInfo={typeof window !== 'undefined' ? window.__HAND_DEBUG__ : null}
          pipelineDebug={pipelineDebug}
        />
      )}
    </div>
  );
}

export default App;

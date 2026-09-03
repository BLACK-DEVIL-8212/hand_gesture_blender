import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ObjectManager } from '../scene/ObjectManager';
import { SelectionManager } from '../scene/SelectionManager';
import type { InteractionMode } from '../vision/GestureStateMachine';
import type { SubMode } from '../modeling/MeshData';
import type { MeshEditor } from '../modeling/MeshEditor';
import type { EditTool } from '../modeling/EditableMesh';
import EventBus from '../core/EventBus';

export type TransformMode = 'move' | 'rotate' | 'scale';
export type SculptMode = 'GRAB' | 'PUSH' | 'PULL' | 'SMOOTH';
export type CutMode = 'KNIFE' | 'BOOLEAN';

export interface BrushSettings {
  radius: number;
  strength: number;
}

export interface EditorState {
  objectManager: ObjectManager;
  selectionManager: SelectionManager;
  selectedIds: string[];
  hoverId: string | null;
  mode: InteractionMode;
  axisLock: 'x' | 'y' | 'z' | null;
  debugMode: boolean;
  cameraEnabled: boolean;
  cameraStatus: 'off' | 'starting' | 'active' | 'error';
  currentGesture: string;
  gestureConfidence: number;
  handCount: number;
  leftHandConfidence: number;
  rightHandConfidence: number;
  fps: number;
  showCameraPreview: boolean;
  showHandSkeleton: boolean;
  wireframeMode: boolean;
  gridVisible: boolean;
  axesVisible: boolean;
  lightingEnabled: boolean;
  backgroundColor: string;
  recording: boolean;
  recordedData: any[];
  isPlaying: boolean;
  playbackData: any[] | null;
  calibrationCompleted: boolean;
  canUndo: boolean;
  canRedo: boolean;
  editSubMode: SubMode;
  brushSettings: BrushSettings;
  cutMode: CutMode;
  meshEditors: Map<string, MeshEditor>;
  extrudeDistance: number;
  editTool: EditTool;
}

export interface EditorActions {
  setSelectedIds: (ids: string[]) => void;
  setHoverId: (id: string | null) => void;
  setMode: (mode: InteractionMode) => void;
  setAxisLock: (axis: 'x' | 'y' | 'z' | null) => void;
  setDebugMode: (debug: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setCameraStatus: (status: 'off' | 'starting' | 'active' | 'error') => void;
  setGestureInfo: (gesture: string, confidence: number) => void;
  setHandInfo: (count: number, leftConfidence: number, rightConfidence: number) => void;
  setFPS: (fps: number) => void;
  setShowCameraPreview: (show: boolean) => void;
  setShowHandSkeleton: (show: boolean) => void;
  setWireframeMode: (wireframe: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setAxesVisible: (visible: boolean) => void;
  setLightingEnabled: (enabled: boolean) => void;
  setBackgroundColor: (color: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  clearRecordedData: () => void;
  setPlaybackData: (data: any[] | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCalibrationCompleted: (completed: boolean) => void;
  setCanUndo: (can: boolean) => void;
  setCanRedo: (can: boolean) => void;
  setEditSubMode: (subMode: SubMode) => void;
  setBrushSettings: (settings: BrushSettings) => void;
  setCutMode: (mode: CutMode) => void;
  registerMeshEditor: (id: string, editor: MeshEditor) => void;
  setExtrudeDistance: (distance: number) => void;
  setEditTool: (tool: EditTool) => void;
}

export type EditorStore = EditorState & EditorActions;

const eventBus = new EventBus();

export const useEditorStore = create<EditorStore>()(
  subscribeWithSelector((set) => {
    const objectManager = new ObjectManager();
    const selectionManager = new SelectionManager(objectManager, eventBus);
    
    return {
      objectManager,
      selectionManager,
      selectedIds: [],
      hoverId: null,
      mode: 'SELECT' as InteractionMode,
      axisLock: null,
      debugMode: false,
      cameraEnabled: false,
      cameraStatus: 'off' as const,
      currentGesture: 'IDLE',
      gestureConfidence: 0,
      handCount: 0,
      leftHandConfidence: 0,
      rightHandConfidence: 0,
      fps: 0,
      showCameraPreview: true,
      showHandSkeleton: true,
      wireframeMode: false,
      gridVisible: true,
      axesVisible: true,
      lightingEnabled: true,
      backgroundColor: '#1a1a2e',
      recording: false,
      recordedData: [],
      isPlaying: false,
      playbackData: null,
      calibrationCompleted: false,
      canUndo: false,
      canRedo: false,
      editSubMode: 'VERTEX' as SubMode,
      brushSettings: { radius: 0.5, strength: 0.3 } as BrushSettings,
      cutMode: 'KNIFE' as CutMode,
      meshEditors: new Map() as Map<string, MeshEditor>,
      extrudeDistance: 0.5,
      editTool: 'SELECT' as EditTool,
      
      setSelectedIds: (ids) => set({ selectedIds: ids }),
      setHoverId: (id) => set({ hoverId: id }),
      setMode: (mode) => set({ mode }),
      setAxisLock: (axis) => set({ axisLock: axis }),
      setDebugMode: (debug) => set({ debugMode: debug }),
      setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
      setCameraStatus: (status) => set({ cameraStatus: status }),
      setGestureInfo: (gesture, confidence) =>
        set({ currentGesture: gesture, gestureConfidence: confidence }),
      setHandInfo: (count, leftHandConfidence, rightHandConfidence) =>
        set({ handCount: count, leftHandConfidence, rightHandConfidence }),
      setFPS: (fps) => set({ fps }),
      setShowCameraPreview: (show) => set({ showCameraPreview: show }),
      setShowHandSkeleton: (show) => set({ showHandSkeleton: show }),
      setWireframeMode: (wireframe) => set({ wireframeMode: wireframe }),
      setGridVisible: (visible) => set({ gridVisible: visible }),
      setAxesVisible: (visible) => set({ axesVisible: visible }),
      setLightingEnabled: (enabled) => set({ lightingEnabled: enabled }),
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      startRecording: () => set({ recording: true, recordedData: [] }),
      stopRecording: () => set({ recording: false }),
      clearRecordedData: () => set({ recordedData: [] }),
      setPlaybackData: (data) => set({ playbackData: data }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setCalibrationCompleted: (completed) => set({ calibrationCompleted: completed }),
      setCanUndo: (can) => set({ canUndo: can }),
      setCanRedo: (can) => set({ canRedo: can }),
      setEditSubMode: (subMode) => set({ editSubMode: subMode }),
      setBrushSettings: (settings) => set({ brushSettings: settings }),
      setCutMode: (mode) => set({ cutMode: mode }),
      registerMeshEditor: (id, editor) =>
        set((state) => {
          const newMap = new Map(state.meshEditors);
          newMap.set(id, editor);
          return { meshEditors: newMap };
        }),
      setExtrudeDistance: (distance: number) => set({ extrudeDistance: distance }),
      setEditTool: (tool: EditTool) => set({ editTool: tool }),
    };
  })
);

export function createDefaultScene() {
  const store = useEditorStore.getState();
  store.objectManager.clear();
  store.selectionManager.clear();
  
  store.objectManager.createObject('cube', {
    name: 'Cube',
    transform: {
      position: { x: -3.5, y: 0.5, z: -2 },
      rotation: { x: 0, y: 0.3, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  });
  store.objectManager.createObject('sphere', {
    name: 'Sphere',
    transform: {
      position: { x: 0, y: 0.7, z: -3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  });
  store.objectManager.createObject('cylinder', {
    name: 'Cylinder',
    transform: {
      position: { x: 3.5, y: 0.75, z: -1 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1.5, z: 1 },
    },
  });
  store.objectManager.createObject('cone', {
    name: 'Cone',
    transform: {
      position: { x: 3.5, y: 0.75, z: 2 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  });
  store.objectManager.createObject('torus', {
    name: 'Torus',
    transform: {
      position: { x: -3.5, y: 0.7, z: 2 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  });
  store.objectManager.createObject('plane', {
    name: 'Ground',
    transform: {
      position: { x: 0, y: -1, z: 0 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
      scale: { x: 30, y: 30, z: 1 },
    },
  });
}

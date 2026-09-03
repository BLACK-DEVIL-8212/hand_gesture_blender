import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEditorStore } from '../store/editor';
import { HAND_LANDMARKS } from '../vision/types';
import type { HandState } from '../vision/types';
import { ScreenToWorldRay, HandDepthEstimator, FingerCursorManager } from '../interaction';
import { EditableMesh } from '../modeling/EditableMesh';
import { GeometryUndoManager } from '../modeling/GeometryUndoManager';

export type HandStateCallback = (state: HandState | null) => void;

const HAND_STATE_REFS = new Set<(state: HandState | null) => void>();
let handStateCurrent: HandState | null = null;

export function setHandStateForRender(state: HandState | null) {
  handStateCurrent = state;
  for (const cb of HAND_STATE_REFS) {
    cb(state);
  }
}

const FINGER_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17], [17, 6], [1, 5],
];

function SceneObject3D({ objId }: { objId: string }) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const outlineRef = useRef<THREE.LineSegments>(null!);

  const store = useEditorStore.getState();
  const isSelected = useEditorStore((s) => s.selectedIds.includes(objId));
  const isHover = useEditorStore((s) => s.hoverId === objId);
  const wireframeMode = useEditorStore((s) => s.wireframeMode);

  const obj = store.objectManager.getObject(objId);
  if (!obj) return null;

  const color = isSelected ? '#00ffff' : isHover ? '#ffff00' : obj.material.baseColor;

  const geometry = useMemo(() => {
    switch (obj.type) {
      case 'cube': return new THREE.BoxGeometry(1, 1, 1);
      case 'sphere': return new THREE.SphereGeometry(0.7, 32, 32);
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
      case 'cone': return new THREE.ConeGeometry(0.5, 1.5, 32);
      case 'torus': return new THREE.TorusGeometry(0.7, 0.25, 16, 100);
      case 'plane': return new THREE.PlaneGeometry(2, 2);
      case 'light': return new THREE.SphereGeometry(0.3, 16, 16);
      case 'camera': return new THREE.ConeGeometry(0.3, 0.6, 4);
      default: return new THREE.BoxGeometry(1, 1, 1);
    }
  }, [obj.type]);

  const material = useMemo(() => {
    if (obj.type === 'light') return new THREE.MeshBasicMaterial({ color: '#ffff00' });
    if (obj.type === 'camera') return new THREE.MeshStandardMaterial({ color: '#aaaaaa', wireframe: wireframeMode });
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: obj.material.metalness,
      roughness: obj.material.roughness,
      transparent: obj.material.transparent,
      opacity: obj.material.opacity,
      wireframe: wireframeMode,
      side: THREE.DoubleSide,
    });
  }, [obj, color, wireframeMode]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.material = material;
    }
    if (outlineRef.current) {
      const mat = outlineRef.current.material as THREE.LineBasicMaterial;
      mat.color.set(isSelected ? '#00ffff' : '#ffff00');
      mat.opacity = isSelected ? 0.9 : 0.7;
    }
  }, [isSelected, isHover, material, color]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.visible = obj.visible;
      groupRef.current.name = obj.name;
      groupRef.current.userData.id = objId;
    }
  }, [obj.name, obj.visible, objId]);

  useFrame(() => {
    const store = useEditorStore.getState();
    const obj = store.objectManager.getObject(objId);
    if (!obj || !groupRef.current) return;

    const t = obj.transform as any;
    groupRef.current.position.set(t.position.x, t.position.y, t.position.z);
    groupRef.current.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
    groupRef.current.scale.set(t.scale.x, t.scale.y, t.scale.z);

    if (outlineRef.current) {
      outlineRef.current.position.set(t.position.x, t.position.y, t.position.z);
      outlineRef.current.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
      outlineRef.current.scale.set(t.scale.x, t.scale.y, t.scale.z).multiplyScalar(1.05);
    }
  });

  return (
    <group ref={groupRef} name={obj.name} userData={{ id: objId }}>
      <mesh ref={meshRef} geometry={geometry} material={material} castShadow={obj.castShadow} receiveShadow={obj.receiveShadow} />
      {(isSelected || isHover) && (
        <lineSegments ref={outlineRef} renderOrder={1}>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial transparent opacity={isSelected ? 0.9 : 0.7} depthTest={false} />
        </lineSegments>
      )}
    </group>
  );
}

function AxisGizmo({ objId }: { objId: string }) {
  const ref = useRef<THREE.Group>(null!);
  const xAxisRef = useRef<THREE.Mesh>(null!);
  const yAxisRef = useRef<THREE.Mesh>(null!);
  const zAxisRef = useRef<THREE.Mesh>(null!);
  const xConeRef = useRef<THREE.Mesh>(null!);
  const yConeRef = useRef<THREE.Mesh>(null!);
  const zConeRef = useRef<THREE.Mesh>(null!);
  const isSelected = useEditorStore((s) => s.selectedIds.includes(objId));
  const axisLock = useEditorStore((s) => s.axisLock);
  const mode = useEditorStore((s) => s.mode);
  const obj = useEditorStore.getState().objectManager.getObject(objId);
  const t = obj ? (obj.transform as any) : null;

  useFrame(() => {
    if (!ref.current || !isSelected || !t) {
      if (ref.current) ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    ref.current.position.set(t.position.x, t.position.y, t.position.z);
    ref.current.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);

    const isTransformMode = mode === 'MOVE' || mode === 'ROTATE' || mode === 'SCALE' || mode === 'EDIT';
    if (xAxisRef.current && yAxisRef.current && zAxisRef.current && xConeRef.current && yConeRef.current && zConeRef.current) {
      const xMat = xAxisRef.current.material as THREE.MeshBasicMaterial;
      const yMat = yAxisRef.current.material as THREE.MeshBasicMaterial;
      const zMat = zAxisRef.current.material as THREE.MeshBasicMaterial;
      const xConeMat = xConeRef.current.material as THREE.MeshBasicMaterial;
      const yConeMat = yConeRef.current.material as THREE.MeshBasicMaterial;
      const zConeMat = zConeRef.current.material as THREE.MeshBasicMaterial;

      xMat.opacity = isTransformMode && axisLock === 'x' ? 1.0 : 0.3;
      yMat.opacity = isTransformMode && axisLock === 'y' ? 1.0 : 0.3;
      zMat.opacity = isTransformMode && axisLock === 'z' ? 1.0 : 0.3;

      xMat.color.set(isTransformMode && axisLock === 'x' ? '#ff6666' : '#ff3333');
      yMat.color.set(isTransformMode && axisLock === 'y' ? '#66ff66' : '#33ff33');
      zMat.color.set(isTransformMode && axisLock === 'z' ? '#6666ff' : '#3333ff');

      xConeMat.opacity = isTransformMode && axisLock === 'x' ? 1.0 : 0.3;
      yConeMat.opacity = isTransformMode && axisLock === 'y' ? 1.0 : 0.3;
      zConeMat.opacity = isTransformMode && axisLock === 'z' ? 1.0 : 0.3;

      xConeMat.color.set(isTransformMode && axisLock === 'x' ? '#ff6666' : '#ff3333');
      yConeMat.color.set(isTransformMode && axisLock === 'y' ? '#66ff66' : '#33ff33');
      zConeMat.color.set(isTransformMode && axisLock === 'z' ? '#6666ff' : '#3333ff');
    }
  });

  if (!isSelected || !obj || !t) return null;

  const showGizmo = mode === 'MOVE' || mode === 'ROTATE' || mode === 'SCALE' || mode === 'EDIT';
  if (!showGizmo) return null;

  const gizmoSize = Math.min(Math.max(t.scale.x, t.scale.y, t.scale.z) + 0.8, 3.0);

  return (
    <group ref={ref} visible={true} position={[t.position.x, t.position.y, t.position.z]} rotation={[t.rotation.x, t.rotation.y, t.rotation.z]}>
      <mesh ref={xAxisRef} position={[gizmoSize, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0, 0.08, gizmoSize * 0.8, 8]} />
        <meshBasicMaterial color="#ff3333" transparent opacity={0.3} depthTest={false} />
      </mesh>
      <mesh ref={yAxisRef} position={[0, gizmoSize, 0]}>
        <cylinderGeometry args={[0, 0.08, gizmoSize * 0.8, 8]} />
        <meshBasicMaterial color="#33ff33" transparent opacity={0.3} depthTest={false} />
      </mesh>
      <mesh ref={zAxisRef} position={[0, 0, gizmoSize]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0, 0.08, gizmoSize * 0.8, 8]} />
        <meshBasicMaterial color="#3333ff" transparent opacity={0.3} depthTest={false} />
      </mesh>
      <mesh ref={xConeRef} position={[axisLock === 'x' ? gizmoSize * 1.2 : 0, 0, 0]}>
        <coneGeometry args={[0.12, 0.3, 8]} />
        <meshBasicMaterial color="#ff3333" transparent opacity={0.3} depthTest={false} />
      </mesh>
      <mesh ref={yConeRef} position={[0, axisLock === 'y' ? gizmoSize * 1.2 : 0, 0]}>
        <coneGeometry args={[0.12, 0.3, 8]} />
        <meshBasicMaterial color="#33ff33" transparent opacity={0.3} depthTest={false} />
      </mesh>
      <mesh ref={zConeRef} position={[0, 0, axisLock === 'z' ? gizmoSize * 1.2 : 0]}>
        <coneGeometry args={[0.12, 0.3, 8]} />
        <meshBasicMaterial color="#3333ff" transparent opacity={0.3} depthTest={false} />
      </mesh>
    </group>
  );
}

function AdaptiveGrid({ camera, visible }: { camera: THREE.PerspectiveCamera | null; visible: boolean }) {
  const gridRef = useRef<THREE.GridHelper>(null!);
  const sectionRef = useRef<THREE.GridHelper>(null!);
  const scene = useThree((state) => state.scene);
  const currentSize = useRef<number>(0);
  const currentDivisions = useRef<number>(0);
  const currentSectionDivisions = useRef<number>(0);
  
  useFrame(() => {
    if (!camera || !gridRef.current || !sectionRef.current) return;
    
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(fov / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;
    
    const targetWorldSize = Math.max(visibleWidth, visibleHeight) * 1.2;
    
    let cellSize = 1;
    if (targetWorldSize > 100) cellSize = 10;
    else if (targetWorldSize > 40) cellSize = 5;
    else if (targetWorldSize > 15) cellSize = 2;
    else cellSize = 1;
    
    const divisions = Math.max(2, Math.floor(targetWorldSize / cellSize));
    const size = divisions * cellSize;
    const sectionDivisions = Math.max(1, Math.floor(divisions / 5));
    
    if (currentSize.current !== size || currentDivisions.current !== divisions) {
      scene.remove(gridRef.current);
      gridRef.current.dispose();
      gridRef.current = new THREE.GridHelper(size, divisions, 0x444466, 0x2a2a3a);
      gridRef.current.position.y = -1;
      scene.add(gridRef.current);
      currentSize.current = size;
      currentDivisions.current = divisions;
    }
    
    if (currentSize.current !== size || currentSectionDivisions.current !== sectionDivisions) {
      scene.remove(sectionRef.current);
      sectionRef.current.dispose();
      sectionRef.current = new THREE.GridHelper(size, sectionDivisions, 0x666688, 0x666688);
      sectionRef.current.position.y = -0.99;
      scene.add(sectionRef.current);
      currentSectionDivisions.current = sectionDivisions;
    }
  });
  
  useEffect(() => {
    if (!camera || !visible) return;
    
    if (gridRef.current) {
      scene.remove(gridRef.current);
      gridRef.current.dispose();
    }
    if (sectionRef.current) {
      scene.remove(sectionRef.current);
      sectionRef.current.dispose();
    }
    
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(fov / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;
    const targetWorldSize = Math.max(visibleWidth, visibleHeight) * 1.2;
    
    let cellSize = 1;
    if (targetWorldSize > 100) cellSize = 10;
    else if (targetWorldSize > 40) cellSize = 5;
    else if (targetWorldSize > 15) cellSize = 2;
    else cellSize = 1;
    
    const divisions = Math.max(2, Math.floor(targetWorldSize / cellSize));
    const size = divisions * cellSize;
    const sectionDivisions = Math.max(1, Math.floor(divisions / 5));
    
    gridRef.current = new THREE.GridHelper(size, divisions, 0x444466, 0x2a2a3a);
    gridRef.current.position.y = -1;
    scene.add(gridRef.current);
    currentSize.current = size;
    currentDivisions.current = divisions;
    
    sectionRef.current = new THREE.GridHelper(size, sectionDivisions, 0x666688, 0x666688);
    sectionRef.current.position.y = -0.99;
    scene.add(sectionRef.current);
    currentSectionDivisions.current = sectionDivisions;
    
    return () => {
      if (gridRef.current) {
        scene.remove(gridRef.current);
        gridRef.current.dispose();
      }
      if (sectionRef.current) {
        scene.remove(sectionRef.current);
        sectionRef.current.dispose();
      }
    };
  }, [camera, visible, scene]);
  
  if (!visible || !camera) return null;
  
  return null;
}

function AdaptiveAxes({ camera, visible }: { camera: THREE.PerspectiveCamera | null; visible: boolean }) {
  const axesRef = useRef<THREE.AxesHelper>(null!);
  const scene = useThree((state) => state.scene);
  const currentSize = useRef<number>(0);
  
  useFrame(() => {
    if (!camera || !axesRef.current) return;
    
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(fov / 2) * distance;
    const targetSize = visibleHeight * 0.15;
    
    const size = Math.max(1, Math.min(20, Math.round(targetSize)));
    
    if (currentSize.current !== size) {
      scene.remove(axesRef.current);
      axesRef.current.dispose();
      axesRef.current = new THREE.AxesHelper(size);
      (axesRef.current.material as any).color = 0xffffff;
      scene.add(axesRef.current);
      currentSize.current = size;
    }
  });
  
  useEffect(() => {
    if (!camera || !visible) return;
    
    if (axesRef.current) {
      scene.remove(axesRef.current);
      axesRef.current.dispose();
    }
    
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(fov / 2) * distance;
    const targetSize = visibleHeight * 0.15;
    const size = Math.max(1, Math.min(20, Math.round(targetSize)));
    
    axesRef.current = new THREE.AxesHelper(size);
    (axesRef.current.material as any).color = 0xffffff;
    scene.add(axesRef.current);
    currentSize.current = size;
    
    return () => {
      if (axesRef.current) {
        scene.remove(axesRef.current);
        axesRef.current.dispose();
      }
    };
  }, [camera, visible, scene]);
  
   if (!visible || !camera) return null;
   
   return null;
}

function HandSkeletonRenderer() {
  const groupRef = useRef<THREE.Group>(null!);
  const lineSegmentsRef = useRef<THREE.LineSegments>(null!);
  const pointsRef = useRef<THREE.Points>(null!);
  const cam = useThree((state) => state.camera);
  const raycasterRef = useRef(new THREE.Raycaster());
  const depthEstimatorRef = useRef(new HandDepthEstimator());

  useFrame(() => {
    const state = handStateCurrent;
    if (!groupRef.current) return;

    const shouldShow = !!state && state.hands.length > 0;
    if (groupRef.current.visible !== shouldShow) {
      groupRef.current.visible = shouldShow;
    }
    if (!shouldShow) return;

    const pts: number[] = [];
    const spherePts: number[] = [];

    for (const hand of state.hands) {
      const depthResult = depthEstimatorRef.current.estimate(hand, 5);
      const depth = depthResult.depth;

      const worldLandmarks: THREE.Vector3[] = [];

      for (const lm of hand.landmarks) {
        if (!lm) {
          worldLandmarks.push(new THREE.Vector3());
          continue;
        }
        const ndcX = lm.x * 2 - 1;
        const ndcY = 1 - lm.y * 2;
        raycasterRef.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
        const worldPos = new THREE.Vector3();
        raycasterRef.current.ray.at(depth, worldPos);
        worldLandmarks.push(worldPos);
      }

      for (const [a, b] of FINGER_CONNECTIONS) {
        const la = worldLandmarks[a];
        const lb = worldLandmarks[b];
        if (la && lb) {
          pts.push(la.x, la.y, la.z);
          pts.push(lb.x, lb.y, lb.z);
        }
      }

      for (const wp of worldLandmarks) {
        spherePts.push(wp.x, wp.y, wp.z);
      }
    }

    const lineGeo = lineSegmentsRef.current.geometry as THREE.BufferGeometry;
    const pointGeo = pointsRef.current.geometry as THREE.BufferGeometry;

    const lineAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
    const pointAttr = pointGeo.getAttribute('position') as THREE.BufferAttribute;

    if (lineAttr) {
      (lineAttr as any).array = new Float32Array(pts);
      (lineAttr as any).count = pts.length / 3;
      lineAttr.needsUpdate = true;
      lineGeo.computeBoundingSphere();
    }

    if (pointAttr) {
      (pointAttr as any).array = new Float32Array(spherePts);
      (pointAttr as any).count = spherePts.length / 3;
      pointAttr.needsUpdate = true;
      pointGeo.computeBoundingSphere();
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <lineSegments ref={lineSegmentsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ff6600" transparent opacity={0.6} />
      </lineSegments>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(3), 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ff6600" size={0.08} transparent opacity={0.8} />
      </points>
    </group>
  );
}

function VirtualCursorRenderer({ rayCaster, fingerCursorManager }: { rayCaster: ScreenToWorldRay; fingerCursorManager: FingerCursorManager | null | undefined }) {
  const groupRef = useRef<THREE.Group>(null!);
  const cam = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useFrame(() => {
    if (!groupRef.current || !fingerCursorManager) return;

    const state = handStateCurrent;
    if (!state || state.hands.length === 0) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;

    if (!fingerCursorManager.getCursorGroup()) {
      fingerCursorManager.setCursorGroup(groupRef.current);
    }

    fingerCursorManager.update(state.hands);
  });

  useEffect(() => {
    if (fingerCursorManager && groupRef.current) {
      fingerCursorManager.setCursorGroup(groupRef.current);
    }
    return () => {
      if (fingerCursorManager) {
        fingerCursorManager.setCursorGroup(null);
      }
    };
  }, [fingerCursorManager]);

  return (
    <group ref={groupRef} visible={false} name="finger-cursors" />
  );
}

export function Scene3DCanvas({
  rayCaster,
  onCameraReady,
  controlsRef,
  selectableObjectsRef,
  fingerCursorManager,
}: {
  rayCaster: ScreenToWorldRay;
  onCameraReady: (cam: THREE.PerspectiveCamera) => void;
  controlsRef: React.MutableRefObject<any>;
  selectableObjectsRef?: React.MutableRefObject<THREE.Object3D[]>;
  fingerCursorManager?: FingerCursorManager | null;
}) {
  const { camera, gl, scene, size } = useThree();

  const backgroundColor = useEditorStore((s) => s.backgroundColor);
  const lightingEnabled = useEditorStore((s) => s.lightingEnabled);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const axesVisible = useEditorStore((s) => s.axesVisible);
  const showHandSkeleton = useEditorStore((s) => s.showHandSkeleton);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const mode = useEditorStore((s) => s.mode);
  const editSubMode = useEditorStore((s) => s.editSubMode);
  const wireframeMode = useEditorStore((s) => s.wireframeMode);

  const editableMeshesRef = useRef<Map<string, EditableMesh>>(new Map());
  const geometryUndoManagerRef = useRef(new GeometryUndoManager());
  const objects = useEditorStore.getState().objectManager.getAllObjects();

  useEffect(() => {
    const store = useEditorStore.getState();
    const currentIds = new Set(objects.map(o => o.id));
    const editableMeshes = editableMeshesRef.current;

    for (const obj of objects) {
      if (!editableMeshes.has(obj.id)) {
        let geometry: THREE.BufferGeometry;
        switch (obj.type) {
          case 'cube': geometry = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2); break;
          case 'sphere': geometry = new THREE.SphereGeometry(0.7, 16, 12); break;
          case 'cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16, 8); break;
          case 'cone': geometry = new THREE.ConeGeometry(0.5, 1.5, 16, 8); break;
          case 'torus': geometry = new THREE.TorusGeometry(0.7, 0.25, 12, 24); break;
          case 'plane': geometry = new THREE.PlaneGeometry(2, 2, 4, 4); break;
          default: geometry = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
        }
        const editableMesh = new EditableMesh(obj.id, geometry, obj.name);
        editableMesh.mesh.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
        editableMesh.mesh.rotation.set(obj.transform.rotation.x, obj.transform.rotation.y, obj.transform.rotation.z);
        editableMesh.mesh.scale.set(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
        editableMesh.updateMatrix();
        editableMeshes.set(obj.id, editableMesh);
        scene.add(editableMesh.mesh);
        editableMesh.setScene(scene);
      }
    }

    for (const [id, editableMesh] of editableMeshes) {
      if (!currentIds.has(id)) {
        scene.remove(editableMesh.mesh);
        editableMesh.setScene(null);
        editableMesh.dispose();
        editableMeshes.delete(id);
      }
    }
  }, [objects.length, selectedIds.length, scene]);

  useFrame(() => {
    const store = useEditorStore.getState();
    const editableMeshes = editableMeshesRef.current;
    
    for (const obj of store.objectManager.getAllObjects()) {
      const editableMesh = editableMeshes.get(obj.id);
      if (!editableMesh) continue;
      
      const t = obj.transform as any;
      editableMesh.mesh.position.set(t.position.x, t.position.y, t.position.z);
      editableMesh.mesh.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
      editableMesh.mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
      editableMesh.updateMatrix();
      
      const isEditMode = mode === 'EDIT';
      editableMesh.showEditElements(isEditMode);
      
      if (isEditMode) {
        editableMesh.mesh.visible = true;
        const mat = editableMesh.mesh.material as THREE.MeshStandardMaterial;
        mat.wireframe = true;
        mat.opacity = 0.3;
        mat.transparent = true;
      } else {
        const mat = editableMesh.mesh.material as THREE.MeshStandardMaterial;
        mat.wireframe = wireframeMode;
        mat.opacity = 1;
        mat.transparent = obj.material.transparent;
      }
    }

    for (const [id, editableMesh] of editableMeshes) {
      if (!store.objectManager.getObject(id)) {
        scene.remove(editableMesh.mesh);
        editableMesh.setScene(null);
        editableMesh.dispose();
        editableMeshes.delete(id);
      }
    }

    if (fingerCursorManager && editableMeshes.size > 0) {
      fingerCursorManager.setEditableMeshes(editableMeshes);
      fingerCursorManager.setEditTool(store.editTool);
      fingerCursorManager.setEditSubMode(editSubMode);
      const brushSettings = store.brushSettings;
      fingerCursorManager.setEditInfluenceRadius(brushSettings.radius);
      fingerCursorManager.setEditStrength(brushSettings.strength);
    }
  });

  useEffect(() => {
    scene.background = new THREE.Color(backgroundColor);
    gl.setClearColor(new THREE.Color(backgroundColor));
  }, [backgroundColor, scene, gl]);

  useEffect(() => {
    gl.shadowMap.enabled = lightingEnabled;
    gl.shadowMap.type = THREE.PCFShadowMap;
  }, [lightingEnabled, gl]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    onCameraReady(cam);
  }, [camera, onCameraReady]);

  useEffect(() => {
    rayCaster.setScreenSize(size.width, size.height);
  }, [size, rayCaster]);

  const objectIds = useMemo(() => objects.map(o => o.id), [objects.length, selectedIds.length]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const store = useEditorStore.getState();
    const objectIds = new Set<string>();
    for (const obj of store.objectManager.getAllObjects()) {
      objectIds.add(obj.id);
      const t = obj.transform as any;
      rayCaster.registerObjectData(obj.id,
        { x: t.position.x, y: t.position.y, z: t.position.z },
        { x: Math.max(t.scale.x, 0.01), y: Math.max(t.scale.y, 0.01), z: Math.max(t.scale.z, 0.01) }
      );
    }
    for (const existingId of rayCaster.getVisibleObjects()) {
      if (!objectIds.has(existingId) && existingId !== 'cursor') {
        rayCaster.unregisterObject(existingId);
      }
    }
  });

  useFrame(() => {
    if (!selectableObjectsRef) return;
    const meshes: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.parent && child.parent.userData && typeof child.parent.userData.id === 'string' && child.parent.userData.id) {
        meshes.push(child);
      }
    });
    selectableObjectsRef.current = meshes;
  });

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(10, 8, 12);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  return (
    <>
      <ambientLight intensity={lightingEnabled ? 0.4 : 0.2} />
      <directionalLight position={[10, 20, 15]} intensity={lightingEnabled ? 3 : 0.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={[0x878787, 0x404060, 0.5]} />

      <AdaptiveGrid camera={camera as THREE.PerspectiveCamera} visible={gridVisible} />
      <AdaptiveAxes camera={camera as THREE.PerspectiveCamera} visible={axesVisible} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0a0a1a" depthWrite={false} />
      </mesh>

      {objectIds.map((id) => (
        <React.Fragment key={id}>
          <SceneObject3D objId={id} />
          <AxisGizmo objId={id} />
        </React.Fragment>
      ))}

      <OrbitControls 
        ref={controlsRef} 
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={1.2}
        panSpeed={0.8}
        rotateSpeed={0.8}
        minDistance={2}
        maxDistance={200}
        target={[0, 0, 0]}
      />

      {showHandSkeleton && <HandSkeletonRenderer />}
      <VirtualCursorRenderer rayCaster={rayCaster} fingerCursorManager={fingerCursorManager} />
    </>
  );
}

import type { Vector3, Euler } from 'three';

export type ObjectType =
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'plane'
  | 'capsule'
  | 'monkey'
  | 'empty'
  | 'light'
  | 'camera'
  | 'group';

export type LightType = 'point' | 'directional' | 'ambient' | 'spot';

export interface ObjectMaterial {
  id: string;
  name: string;
  baseColor: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
  transparent: boolean;
  opacity: number;
}

export interface ObjectTransform {
  position: Vector3 | { x: number; y: number; z: number };
  rotation: Euler | { x: number; y: number; z: number };
  scale: Vector3 | { x: number; y: number; z: number };
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  transform: ObjectTransform;
  visible: boolean;
  locked: boolean;
  parent: string | null;
  material: ObjectMaterial;
  castShadow: boolean;
  receiveShadow: boolean;
  userData: Record<string, unknown>;
  children: string[];
  createdAt: number;
  created: number;
}

export interface SceneLight extends SceneObject {
  lightType: LightType;
  intensity: number;
  distance: number;
  color: string;
  decay: number;
}

export interface SceneCamera extends SceneObject {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  isPrimary: boolean;
}

export interface SceneGraph {
  id: string;
  name: string;
  objects: Record<string, SceneObject>;
  rootIds: string[];
  cameraId: string | null;
  environment: {
    backgroundColor: string;
    fogEnabled: boolean;
    fogColor: string;
    fogNear: number;
    fogFar: number;
  };
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface SceneSnapshot {
  id: string;
  name: string;
  objects: SceneObject[];
  cameraId: string | null;
  environment: SceneGraph['environment'];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

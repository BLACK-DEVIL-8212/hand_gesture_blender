import type {
  SceneObject,
  SceneGraph,
  ObjectMaterial,
  ObjectType,
} from './types';
import logger from '../core/Logger';

function generateId(): string {
  return 'obj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

export class ObjectManager {
  private objects: Map<string, SceneObject> = new Map();
  private rootIds: string[] = [];
  private nextNameIndex: Map<ObjectType, number> = new Map();

  createObject(
    type: ObjectType,
    overrides: Partial<SceneObject> = {}
  ): SceneObject {
    const name = overrides.name || this.generateName(type);
    const id = overrides.id || generateId();
    
    const obj: SceneObject = {
      id,
      name,
      type,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      visible: overrides.visible ?? true,
      locked: overrides.locked ?? false,
      parent: overrides.parent ?? null,
      material: overrides.material || this.createDefaultMaterial(name),
      castShadow: overrides.castShadow ?? true,
      receiveShadow: overrides.receiveShadow ?? true,
      userData: { ...(overrides.userData || {}) },
      children: [],
      createdAt: Date.now(),
      created: Date.now(),
    };
    
    this.objects.set(id, obj);
    if (!obj.parent) {
      this.rootIds.push(id);
    }
    
    logger.debug(`Object created: ${name} (${id})`);
    return obj;
  }

  private generateName(type: ObjectType): string {
    const baseName = this.getTypeName(type);
    const count = (this.nextNameIndex.get(type) || 0) + 1;
    this.nextNameIndex.set(type, count);
    return `${baseName}.${count}`;
  }

  private getTypeName(type: ObjectType): string {
    switch (type) {
      case 'cube': return 'Cube';
      case 'sphere': return 'Sphere';
      case 'cylinder': return 'Cylinder';
      case 'cone': return 'Cone';
      case 'torus': return 'Torus';
      case 'plane': return 'Plane';
      case 'capsule': return 'Capsule';
      case 'monkey': return 'Monkey';
      case 'empty': return 'Empty';
      case 'light': return 'Light';
      case 'camera': return 'Camera';
      case 'group': return 'Group';
      default: return 'Object';
    }
  }

  private createDefaultMaterial(name: string): ObjectMaterial {
    const colors: Record<string, string> = {
      Cube: '#4A90D9',
      Sphere: '#E74C3C',
      Cylinder: '#9B59B6',
      Cone: '#F39C12',
      Torus: '#1ABC9C',
      Plane: '#3498DB',
      Capsule: '#9B59B6',
      Monkey: '#F1C40F',
      Empty: '#95A5A6',
      Light: '#F1C40F',
      Camera: '#95A5A6',
      Group: '#95A5A6',
    };
    
    return {
      id: generateId(),
      name: 'Material',
      baseColor: colors[name.split('.')[0]] || '#888888',
      metalness: 0.1,
      roughness: 0.7,
      emissive: '#000000',
      emissiveIntensity: 0,
      transparent: false,
      opacity: 1,
    };
  }

  getObject(id: string): SceneObject | undefined {
    return this.objects.get(id);
  }

  getObjectByName(name: string): SceneObject | undefined {
    for (const obj of this.objects.values()) {
      if (obj.name === name) return obj;
    }
    return undefined;
  }

  getAllObjects(): SceneObject[] {
    return Array.from(this.objects.values());
  }

  getRootObjects(): SceneObject[] {
    return this.rootIds
      .map(id => this.objects.get(id))
      .filter((obj): obj is SceneObject => obj !== undefined);
  }

  removeObject(id: string): boolean {
    const obj = this.objects.get(id);
    if (!obj) return false;
    
    for (const childId of obj.children) {
      this.setParent(childId, null);
    }
    
    if (obj.parent) {
      const parent = this.objects.get(obj.parent);
      if (parent) {
        parent.children = parent.children.filter(c => c !== id);
      }
    }
    
    this.objects.delete(id);
    this.rootIds = this.rootIds.filter(rid => rid !== id);
    
    logger.debug(`Object removed: ${obj.name} (${id})`);
    return true;
  }

  duplicateObject(id: string): SceneObject | undefined {
    const original = this.objects.get(id);
    if (!original) return undefined;
    
    const newId = generateId();
    const newName = original.name.replace(/(\.\d+)?$/, '') + '.' + (this.nextNameIndex.get(original.type) || 1);
    
    const copy: SceneObject = {
      ...original,
      id: newId,
      name: newName,
      children: [],
      parent: null,
      createdAt: Date.now(),
      created: Date.now(),
      material: { ...original.material, id: generateId() },
      userData: { ...original.userData },
      transform: {
        position: { ...original.transform.position },
        rotation: { ...original.transform.rotation },
        scale: { ...original.transform.scale },
      },
    };
    
    this.objects.set(newId, copy);
    this.rootIds.push(newId);
    this.nextNameIndex.set(original.type, this.nextNameIndex.get(original.type) || 0 + 1);
    
    logger.debug(`Object duplicated: ${original.name} → ${newName}`);
    return copy;
  }

  setParent(childId: string, parentId: string | null): boolean {
    const child = this.objects.get(childId);
    if (!child) return false;
    
    if (child.parent) {
      const oldParent = this.objects.get(child.parent);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(c => c !== childId);
      }
    }
    
    if (parentId === null || parentId === childId) {
      child.parent = null;
      if (!this.rootIds.includes(childId)) {
        this.rootIds.push(childId);
      }
      return true;
    }
    
    const parent = this.objects.get(parentId);
    if (!parent) {
      child.parent = null;
      return false;
    }
    
    if (parent.type === 'light' || parent.type === 'camera') {
      return false;
    }
    
    child.parent = parentId;
    if (!parent.children.includes(childId)) {
      parent.children.push(childId);
    }
    
    this.rootIds = this.rootIds.filter(rid => rid !== childId);
    return true;
  }

  getChildren(id: string): SceneObject[] {
    const obj = this.objects.get(id);
    if (!obj) return [];
    return obj.children
      .map(cid => this.objects.get(cid))
      .filter((obj): obj is SceneObject => obj !== undefined);
  }

  getDescendants(id: string): SceneObject[] {
    const result: SceneObject[] = [];
    const stack = this.getChildren(id);
    while (stack.length > 0) {
      const obj = stack.pop()!;
      result.push(obj);
      stack.push(...this.getChildren(obj.id));
    }
    return result;
  }

  setPosition(id: string, x: number, y: number, z: number): boolean {
    const obj = this.objects.get(id);
    if (!obj || obj.locked) return false;
    obj.transform.position = { x, y, z };
    return true;
  }

  setRotation(id: string, x: number, y: number, z: number): boolean {
    const obj = this.objects.get(id);
    if (!obj || obj.locked) return false;
    obj.transform.rotation = { x, y, z };
    return true;
  }

  setScale(id: string, x: number, y: number, z: number): boolean {
    const obj = this.objects.get(id);
    if (!obj || obj.locked) return false;
    obj.transform.scale = { x, y: y, z: z };
    return true;
  }

  getWorldPosition(id: string): { x: number; y: number; z: number } {
    const obj = this.objects.get(id);
    if (!obj) return { x: 0, y: 0, z: 0 };
    
    const local = obj.transform.position;
    if (!obj.parent) {
      return { x: local.x, y: local.y, z: local.z };
    }
    
    const parentPos = this.getWorldPosition(obj.parent);
    const parent = this.objects.get(obj.parent);
    if (!parent) return { x: local.x, y: local.y, z: local.z };
    
    const ps = parent.transform.scale;
    
    const rx = local.x * ps.x;
    const ry = local.y * ps.y;
    const rz = local.z * ps.z;
    
    return {
      x: parentPos.x + rx,
      y: parentPos.y + ry,
      z: parentPos.z + rz,
    };
  }

  toJSON(): SceneGraph {
    const objects: Record<string, SceneObject> = {};
    for (const [id, obj] of this.objects) {
      objects[id] = {
        ...obj,
        transform: {
          position: { ...obj.transform.position },
          rotation: { ...obj.transform.rotation },
          scale: { ...obj.transform.scale },
        },
      };
    }
    
    return {
      id: 'scene_' + Date.now(),
      name: 'Scene',
      objects,
      rootIds: [...this.rootIds],
      cameraId: null,
      environment: {
        backgroundColor: '#1a1a2e',
        fogEnabled: false,
        fogColor: '#000000',
        fogNear: 10,
        fogFar: 100,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {},
    };
  }

  fromJSON(data: SceneGraph): void {
    this.objects.clear();
    this.rootIds = [];
    this.nextNameIndex.clear();
    
    for (const [id, obj] of Object.entries(data.objects)) {
      this.objects.set(id, {
        ...obj,
        transform: {
          position: { ...obj.transform.position },
          rotation: { ...obj.transform.rotation },
          scale: { ...obj.transform.scale },
        },
      });
      
      if (obj.parent === null) {
        this.rootIds.push(id);
      }
      
      const count = (this.nextNameIndex.get(obj.type) || 0) + 1;
      this.nextNameIndex.set(obj.type, count);
    }
    
    if (data.rootIds) {
      this.rootIds = [...data.rootIds];
    }
    
    logger.info(`Scene loaded with ${this.objects.size} objects`);
  }

  clear(): void {
    this.objects.clear();
    this.rootIds = [];
    this.nextNameIndex.clear();
  }
}

export default ObjectManager;

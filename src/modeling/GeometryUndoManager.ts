import * as THREE from 'three';

export interface GeometrySnapshot {
  objectId: string;
  timestamp: number;
  positions: Float32Array;
  normals: Float32Array | null;
  indices: Uint32Array | null;
}

export class GeometryUndoManager {
  private undoStack: GeometrySnapshot[] = [];
  private redoStack: GeometrySnapshot[] = [];
  private maxStackSize: number = 50;

  push(objectId: string, geometry: THREE.BufferGeometry): void {
    const positions = geometry.attributes.position.array as Float32Array;
    const normals = geometry.attributes.normal ? (geometry.attributes.normal.array as Float32Array) : null;
    const indices = geometry.index ? new Uint32Array(geometry.index.array) : null;
    
    const snapshot: GeometrySnapshot = {
      objectId,
      timestamp: Date.now(),
      positions: new Float32Array(positions),
      normals: normals ? new Float32Array(normals) : null,
      indices: indices ? new Uint32Array(indices) : null,
    };
    
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo(objectId: string, geometry: THREE.BufferGeometry): boolean {
    const snapshot = this.undoStack.pop();
    if (!snapshot || snapshot.objectId !== objectId) {
      return false;
    }
    
    this.redoStack.push(snapshot);
    
    geometry.attributes.position.array.set(snapshot.positions);
    geometry.attributes.position.needsUpdate = true;
    
    if (snapshot.normals && geometry.attributes.normal) {
      geometry.attributes.normal.array.set(snapshot.normals);
      geometry.attributes.normal.needsUpdate = true;
    }
    
    if (snapshot.indices && geometry.index) {
      geometry.index.array.set(snapshot.indices);
      geometry.index.needsUpdate = true;
    }
    
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    return true;
  }

  redo(objectId: string, geometry: THREE.BufferGeometry): boolean {
    const snapshot = this.redoStack.pop();
    if (!snapshot || snapshot.objectId !== objectId) {
      return false;
    }
    
    this.undoStack.push(snapshot);
    
    geometry.attributes.position.array.set(snapshot.positions);
    geometry.attributes.position.needsUpdate = true;
    
    if (snapshot.normals && geometry.attributes.normal) {
      geometry.attributes.normal.array.set(snapshot.normals);
      geometry.attributes.normal.needsUpdate = true;
    }
    
    if (snapshot.indices && geometry.index) {
      geometry.index.array.set(snapshot.indices);
      geometry.index.needsUpdate = true;
    }
    
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    return true;
  }

  canUndo(objectId: string): boolean {
    if (this.undoStack.length === 0) return false;
    return this.undoStack[this.undoStack.length - 1].objectId === objectId;
  }

  canRedo(objectId: string): boolean {
    if (this.redoStack.length === 0) return false;
    return this.redoStack[this.redoStack.length - 1].objectId === objectId;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

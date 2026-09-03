import * as THREE from 'three';
import { EditableMesh } from './EditableMesh';
import type { EditGrabState, EditTool } from './EditableMesh';
import { MeshData } from './MeshData';
import type { Vertex } from './MeshData';

export interface DeformationResult {
  success: boolean;
  affectedVertices: number;
  tool: EditTool;
}

export class DeformationTools {
  static applyPull(
    editableMesh: EditableMesh,
    grabState: EditGrabState,
    handDelta: THREE.Vector3
  ): DeformationResult {
    const { meshData } = editableMesh;
    const localDelta = editableMesh.worldToLocal(handDelta.clone());
    const grabLocal = editableMesh.worldToLocal(grabState.grabWorldPos.clone());
    
    const verticesInRadius = meshData.getVerticesInRadius(grabLocal, grabState.influenceRadius);
    let affectedCount = 0;
    
    for (const { vertex, weight } of verticesInRadius) {
      if (grabState.originalPositions.has(vertex.id)) {
        const original = grabState.originalPositions.get(vertex.id)!;
        vertex.position.x = original.x + localDelta.x * weight * grabState.strength;
        vertex.position.y = original.y + localDelta.y * weight * grabState.strength;
        vertex.position.z = original.z + localDelta.z * weight * grabState.strength;
        affectedCount++;
      }
    }
    
    if (affectedCount > 0) {
      meshData.recalculateNormals();
      editableMesh.applyGeometryChanges();
    }
    
    return { success: affectedCount > 0, affectedVertices: affectedCount, tool: 'PULL' };
  }

  static applyPush(
    editableMesh: EditableMesh,
    grabState: EditGrabState,
    handDelta: THREE.Vector3
  ): DeformationResult {
    const { meshData } = editableMesh;
    const localDelta = editableMesh.worldToLocal(handDelta.clone());
    const grabLocal = editableMesh.worldToLocal(grabState.grabWorldPos.clone());
    
    const verticesInRadius = meshData.getVerticesInRadius(grabLocal, grabState.influenceRadius);
    let affectedCount = 0;
    
    for (const { vertex, weight } of verticesInRadius) {
      if (grabState.originalPositions.has(vertex.id)) {
        const original = grabState.originalPositions.get(vertex.id)!;
        vertex.position.x = original.x - localDelta.x * weight * grabState.strength;
        vertex.position.y = original.y - localDelta.y * weight * grabState.strength;
        vertex.position.z = original.z - localDelta.z * weight * grabState.strength;
        affectedCount++;
      }
    }
    
    if (affectedCount > 0) {
      meshData.recalculateNormals();
      editableMesh.applyGeometryChanges();
    }
    
    return { success: affectedCount > 0, affectedVertices: affectedCount, tool: 'PUSH' };
  }

  static applyBend(
    editableMesh: EditableMesh,
    grabState: EditGrabState,
    handDelta: THREE.Vector3
  ): DeformationResult {
    const { meshData } = editableMesh;
    const localDelta = editableMesh.worldToLocal(handDelta.clone());
    const grabLocal = editableMesh.worldToLocal(grabState.grabWorldPos.clone());
    const bounds = meshData.getBounds();
    const height = bounds.size.y;
    
    if (height < 0.001) {
      return { success: false, affectedVertices: 0, tool: 'BEND' };
    }
    
    const verticesInRadius = meshData.getVerticesInRadius(grabLocal, grabState.influenceRadius);
    let affectedCount = 0;
    
    for (const { vertex, weight } of verticesInRadius) {
      if (grabState.originalPositions.has(vertex.id)) {
        const original = grabState.originalPositions.get(vertex.id)!;
        const originalVec = new THREE.Vector3(original.x, original.y, original.z);
        
        const normalizedY = (original.y - bounds.min.y) / height;
        const bendFactor = normalizedY * weight * grabState.strength;
        
        vertex.position.x = original.x + localDelta.x * bendFactor;
        vertex.position.z = original.z + localDelta.z * bendFactor;
        affectedCount++;
      }
    }
    
    if (affectedCount > 0) {
      meshData.recalculateNormals();
      editableMesh.applyGeometryChanges();
    }
    
    return { success: affectedCount > 0, affectedVertices: affectedCount, tool: 'BEND' };
  }

  static applyTwist(
    editableMesh: EditableMesh,
    grabState: EditGrabState,
    handRotationDelta: { pitch: number; yaw: number; roll: number }
  ): DeformationResult {
    const { meshData } = editableMesh;
    const bounds = meshData.getBounds();
    const height = bounds.size.y;
    
    if (height < 0.001) {
      return { success: false, affectedVertices: 0, tool: 'TWIST' };
    }
    
    const grabLocal = editableMesh.worldToLocal(grabState.grabWorldPos.clone());
    const verticesInRadius = meshData.getVerticesInRadius(grabLocal, grabState.influenceRadius);
    let affectedCount = 0;
    
    const twistAngle = handRotationDelta.roll * grabState.strength;
    
    for (const { vertex, weight } of verticesInRadius) {
      if (grabState.originalPositions.has(vertex.id)) {
        const original = grabState.originalPositions.get(vertex.id)!;
        const normalizedY = (original.y - bounds.min.y) / height;
        const angle = twistAngle * normalizedY * weight;
        
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = original.x - bounds.center.x;
        const dz = original.z - bounds.center.z;
        
        vertex.position.x = bounds.center.x + dx * cos - dz * sin;
        vertex.position.z = bounds.center.z + dx * sin + dz * cos;
        affectedCount++;
      }
    }
    
    if (affectedCount > 0) {
      meshData.recalculateNormals();
      editableMesh.applyGeometryChanges();
    }
    
    return { success: affectedCount > 0, affectedVertices: affectedCount, tool: 'TWIST' };
  }

  static applyStretch(
    editableMesh: EditableMesh,
    grabState: EditGrabState,
    handDelta: THREE.Vector3
  ): DeformationResult {
    const { meshData } = editableMesh;
    const localDelta = editableMesh.worldToLocal(handDelta.clone());
    const grabLocal = editableMesh.worldToLocal(grabState.grabWorldPos.clone());
    
    const verticesInRadius = meshData.getVerticesInRadius(grabLocal, grabState.influenceRadius);
    let affectedCount = 0;
    
    const stretchAxis = new THREE.Vector3(0, 1, 0);
    const stretchAmount = localDelta.dot(stretchAxis) * grabState.strength;
    
    for (const { vertex, weight } of verticesInRadius) {
      if (grabState.originalPositions.has(vertex.id)) {
        const original = grabState.originalPositions.get(vertex.id)!;
        const originalVec = new THREE.Vector3(original.x, original.y, original.z);
        const toGrab = new THREE.Vector3().subVectors(originalVec, grabLocal);
        const alongAxis = toGrab.dot(stretchAxis);
        const influence = weight * (alongAxis / (grabState.influenceRadius + 0.001));
        const clampedInfluence = Math.max(0, Math.min(1, influence));
        
        vertex.position.x = original.x + stretchAxis.x * stretchAmount * clampedInfluence;
        vertex.position.y = original.y + stretchAxis.y * stretchAmount * clampedInfluence;
        vertex.position.z = original.z + stretchAxis.z * stretchAmount * clampedInfluence;
        affectedCount++;
      }
    }
    
    if (affectedCount > 0) {
      meshData.recalculateNormals();
      editableMesh.applyGeometryChanges();
    }
    
    return { success: affectedCount > 0, affectedVertices: affectedCount, tool: 'STRETCH' };
  }

  static applyCompress(
    editableMesh: EditableMesh,
    grabState: EditGrabState,
    handDelta: THREE.Vector3
  ): DeformationResult {
    const { meshData } = editableMesh;
    const localDelta = editableMesh.worldToLocal(handDelta.clone());
    const grabLocal = editableMesh.worldToLocal(grabState.grabWorldPos.clone());
    
    const verticesInRadius = meshData.getVerticesInRadius(grabLocal, grabState.influenceRadius);
    let affectedCount = 0;
    
    const compressAxis = new THREE.Vector3(0, 1, 0);
    const compressAmount = -localDelta.dot(compressAxis) * grabState.strength;
    
    for (const { vertex, weight } of verticesInRadius) {
      if (grabState.originalPositions.has(vertex.id)) {
        const original = grabState.originalPositions.get(vertex.id)!;
        const originalVec = new THREE.Vector3(original.x, original.y, original.z);
        const toGrab = new THREE.Vector3().subVectors(originalVec, grabLocal);
        const alongAxis = toGrab.dot(compressAxis);
        const influence = weight * (alongAxis / (grabState.influenceRadius + 0.001));
        const clampedInfluence = Math.max(0, Math.min(1, influence));
        
        vertex.position.x = original.x + compressAxis.x * compressAmount * clampedInfluence;
        vertex.position.y = original.y + compressAxis.y * compressAmount * clampedInfluence;
        vertex.position.z = original.z + compressAxis.z * compressAmount * clampedInfluence;
        affectedCount++;
      }
    }
    
    if (affectedCount > 0) {
      meshData.recalculateNormals();
      editableMesh.applyGeometryChanges();
    }
    
    return { success: affectedCount > 0, affectedVertices: affectedCount, tool: 'COMPRESS' };
  }

  static applySmooth(
    editableMesh: EditableMesh,
    grabState: EditGrabState
  ): DeformationResult {
    const { meshData } = editableMesh;
    const grabLocal = editableMesh.worldToLocal(grabState.grabWorldPos.clone());
    
    const verticesInRadius = meshData.getVerticesInRadius(grabLocal, grabState.influenceRadius);
    let affectedCount = 0;
    
    const original = meshData.clone();
    
    for (const { vertex, weight } of verticesInRadius) {
      const origV = original.getVertex(vertex.id);
      if (!origV) continue;
      
      const neighbors = this.findNeighborVertices(meshData, vertex.id);
      if (neighbors.length === 0) continue;
      
      let avgX = 0, avgY = 0, avgZ = 0;
      for (const neighbor of neighbors) {
        avgX += neighbor.position.x;
        avgY += neighbor.position.y;
        avgZ += neighbor.position.z;
      }
      avgX /= neighbors.length;
      avgY /= neighbors.length;
      avgZ /= neighbors.length;
      
      vertex.position.x = origV.position.x + (avgX - origV.position.x) * weight * grabState.strength * 0.5;
      vertex.position.y = origV.position.y + (avgY - origV.position.y) * weight * grabState.strength * 0.5;
      vertex.position.z = origV.position.z + (avgZ - origV.position.z) * weight * grabState.strength * 0.5;
      affectedCount++;
    }
    
    if (affectedCount > 0) {
      meshData.recalculateNormals();
      editableMesh.applyGeometryChanges();
    }
    
    return { success: affectedCount > 0, affectedVertices: affectedCount, tool: 'SMOOTH' };
  }

  private static findNeighborVertices(meshData: MeshData, vertexId: string): Vertex[] {
    const neighborSet = new Set<string>();
    const neighbors: Vertex[] = [];
    
    for (const edge of meshData.edges.values()) {
      if (edge.vertexA === vertexId) {
        neighborSet.add(edge.vertexB);
      } else if (edge.vertexB === vertexId) {
        neighborSet.add(edge.vertexA);
      }
    }
    
    for (const id of neighborSet) {
      const v = meshData.getVertex(id);
      if (v) neighbors.push(v);
    }
    
    return neighbors;
  }

  static createGrabState(
    editableMesh: EditableMesh,
    tool: EditTool,
    hand: 'Left' | 'Right',
    worldPos: THREE.Vector3,
    influenceRadius: number,
    strength: number
  ): EditGrabState | null {
    const localPos = editableMesh.worldToLocal(worldPos);
    const originalPositions = new Map<string, { x: number; y: number; z: number }>();
    
    const verticesInRadius = editableMesh.meshData.getVerticesInRadius(localPos, influenceRadius);
    for (const { vertex } of verticesInRadius) {
      originalPositions.set(vertex.id, { ...vertex.position });
    }
    
    if (originalPositions.size === 0) {
      const closestVertex = editableMesh.findClosestVertex(worldPos, influenceRadius);
      if (closestVertex) {
        originalPositions.set(closestVertex.id, { ...closestVertex.position });
      }
    }
    
    if (originalPositions.size === 0) {
      return null;
    }
    
    return {
      active: true,
      hand,
      tool,
      meshId: editableMesh.id,
      vertexIds: Array.from(originalPositions.keys()),
      faceId: null,
      edgeId: null,
      grabWorldPos: worldPos.clone(),
      grabLocalPos: localPos.clone(),
      startHandPos: worldPos.clone(),
      startObjectPos: { x: 0, y: 0, z: 0 },
      originalPositions,
      influenceRadius,
      strength,
    };
  }

  static updateGrab(
    editableMesh: EditableMesh,
    grabState: EditGrabState,
    currentHandPos: THREE.Vector3
  ): DeformationResult {
    const handDelta = new THREE.Vector3().subVectors(currentHandPos, grabState.startHandPos);
    
    switch (grabState.tool) {
      case 'PULL':
        return this.applyPull(editableMesh, grabState, handDelta);
      case 'PUSH':
        return this.applyPush(editableMesh, grabState, handDelta);
      case 'BEND':
        return this.applyBend(editableMesh, grabState, handDelta);
      case 'TWIST':
        return this.applyTwist(editableMesh, grabState, { pitch: 0, yaw: 0, roll: handDelta.x * 2 });
      case 'STRETCH':
        return this.applyStretch(editableMesh, grabState, handDelta);
      case 'SMOOTH':
        return this.applySmooth(editableMesh, grabState);
      default:
        return { success: false, affectedVertices: 0, tool: grabState.tool };
    }
  }

  static releaseGrab(editableMesh: EditableMesh, grabState: EditGrabState): void {
    grabState.active = false;
    grabState.originalPositions.clear();
  }
}

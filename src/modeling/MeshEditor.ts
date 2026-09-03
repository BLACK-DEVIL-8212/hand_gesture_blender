import * as THREE from 'three';
import MeshData, { type Vertex, type Edge, type Face } from './MeshData';

export class MeshEditor {
  public meshData: MeshData;
  public objectId: string;
  public objectName: string;

  constructor(objectId: string, objectName: string = 'Object') {
    this.meshData = new MeshData();
    this.objectId = objectId;
    this.objectName = objectName;
  }

  loadFromGeometry(geometry: THREE.BufferGeometry): void {
    this.meshData.fromBufferGeometry(geometry);
  }

  getBufferGeometry(): THREE.BufferGeometry {
    return this.meshData.toBufferGeometry();
  }

  private getVertexPos(id: string): THREE.Vector3 {
    const v = this.meshData.getVertex(id);
    if (!v) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(v.position.x, v.position.y, v.position.z);
  }

  moveVertex(vertexId: string, newPosition: { x: number; y: number; z: number }): boolean {
    const v = this.meshData.getVertex(vertexId);
    if (!v) return false;
    v.position = { ...newPosition };
    this.meshData.recalculateNormals();
    return true;
  }

  moveVertices(vertexIds: string[], delta: THREE.Vector3): void {
    for (const id of vertexIds) {
      const v = this.meshData.getVertex(id);
      if (v) {
        v.position.x += delta.x;
        v.position.y += delta.y;
        v.position.z += delta.z;
      }
    }
    this.meshData.recalculateNormals();
  }

  extrudeFace(faceId: string, offset: THREE.Vector3): { newVertices: string[]; newFaces: string[] } {
    const face = this.meshData.getFace(faceId);
    if (!face) return { newVertices: [], newFaces: [] };

    const oldVertexIds = [...face.vertices];
    const newVertexIds: string[] = [];

    for (const vid of oldVertexIds) {
      const v = this.meshData.getVertex(vid);
      if (!v) continue;
      const newPos = {
        x: v.position.x + offset.x,
        y: v.position.y + offset.y,
        z: v.position.z + offset.z,
      };
      const newV = this.meshData.addVertex(newPos, { ...v.normal });
      newVertexIds.push(newV.id);
    }

    const newFaceIds: string[] = [];

    if (newVertexIds.length >= 3) {
      const newFace = this.meshData.addFace(newVertexIds, { ...face.normal });
      newFaceIds.push(newFace.id);

      for (let i = 0; i < oldVertexIds.length; i++) {
        const vA = oldVertexIds[i];
        const vB = oldVertexIds[(i + 1) % oldVertexIds.length];
        const vC = newVertexIds[(i + 1) % newVertexIds.length];
        const vD = newVertexIds[i];
        const sideFace = this.meshData.addFace([vA, vB, vC, vD]);
        newFaceIds.push(sideFace.id);
      }
    }

    this.meshData.recalculateNormals();
    return { newVertices: newVertexIds, newFaces: newFaceIds };
  }

  extrudeFaceInNormal(faceId: string, distance: number): { newVertices: string[]; newFaces: string[] } {
    const face = this.meshData.getFace(faceId);
    if (!face) return { newVertices: [], newFaces: [] };

    const offset = new THREE.Vector3(face.normal.x, face.normal.y, face.normal.z).multiplyScalar(distance);
    return this.extrudeFace(faceId, offset);
  }

  insetFace(faceId: string, amount: number): string[] {
    const face = this.meshData.getFace(faceId);
    if (!face) return [];

    const center = new THREE.Vector3(face.center.x, face.center.y, face.center.z);
    const newVertexIds: string[] = [];

    for (const vid of face.vertices) {
      const v = this.meshData.getVertex(vid);
      if (!v) continue;
      const vPos = new THREE.Vector3(v.position.x, v.position.y, v.position.z);
      const dir = new THREE.Vector3().subVectors(vPos, center).normalize();
      const newPos = new THREE.Vector3().addVectors(center, dir.clone().multiplyScalar(amount));
      const newV = this.meshData.addVertex(
        { x: newPos.x, y: newPos.y, z: newPos.z },
        { ...v.normal }
      );
      newVertexIds.push(newV.id);
    }

    if (newVertexIds.length >= 3) {
      const newFace = this.meshData.addFace(newVertexIds, { ...face.normal });

      for (let i = 0; i < face.vertices.length; i++) {
        const vA = face.vertices[i];
        const vB = face.vertices[(i + 1) % face.vertices.length];
        const vC = newVertexIds[(i + 1) % newVertexIds.length];
        const vD = newVertexIds[i];
        this.meshData.addFace([vA, vB, vC, vD]);
      }
    }

    this.meshData.recalculateNormals();
    return newVertexIds;
  }

  subdivide(): void {
    const original = this.meshData.clone();
    this.meshData.clear();

    const newVertices: Map<string, string> = new Map();
    const edgeMidpoints: Map<string, string> = new Map();

    for (const [oldId, v] of original.vertices) {
      const newV = this.meshData.addVertex(
        { x: v.position.x, y: v.position.y, z: v.position.z },
        { ...v.normal }
      );
      newVertices.set(oldId, newV.id);
    }

    for (const [oldEdgeId, edge] of original.edges) {
      const vA = original.getVertex(edge.vertexA);
      const vB = original.getVertex(edge.vertexB);
      if (!vA || !vB) continue;
      const mid = new THREE.Vector3(
        (vA.position.x + vB.position.x) / 2,
        (vA.position.y + vB.position.y) / 2,
        (vA.position.z + vB.position.z) / 2
      );
      const newV = this.meshData.addVertex({ x: mid.x, y: mid.y, z: mid.z }, { ...vA.normal });
      edgeMidpoints.set(oldEdgeId, newV.id);
    }

    const getMidpoint = (oldV1: string, oldV2: string): string | undefined => {
      const oldEdge = original.getEdgeBetween(oldV1, oldV2);
      if (!oldEdge) return undefined;
      return edgeMidpoints.get(oldEdge.id);
    };

    for (const face of original.faces.values()) {
      if (face.vertices.length === 4) {
        const v0 = newVertices.get(face.vertices[0])!;
        const v1 = newVertices.get(face.vertices[1])!;
        const v2 = newVertices.get(face.vertices[2])!;
        const v3 = newVertices.get(face.vertices[3])!;

        const e01 = getMidpoint(face.vertices[0], face.vertices[1]);
        const e12 = getMidpoint(face.vertices[1], face.vertices[2]);
        const e23 = getMidpoint(face.vertices[2], face.vertices[3]);
        const e30 = getMidpoint(face.vertices[3], face.vertices[0]);

        if (e01 && e12 && e23 && e30) {
          this.meshData.addFace([v0, e01, v2, e23]);
          this.meshData.addFace([e01, v1, e12, v2]);
          this.meshData.addFace([e30, v2, e23, v3]);
          this.meshData.addFace([e30, e01, v2, e23]);
        } else {
          this.meshData.addFace([v0, v1, v2, v3]);
        }
      } else {
        const n = face.vertices.length;
        const newVs = face.vertices.map(vid => newVertices.get(vid)).filter((v): v is string => v !== undefined);
        const midVs: (string | undefined)[] = [];
        for (let i = 0; i < n; i++) {
          midVs.push(getMidpoint(face.vertices[i], face.vertices[(i + 1) % n]));
        }
        for (let i = 0; i < n - 2; i++) {
          const ring: string[] = [newVs[0]];
          const mi = midVs[i];
          const mi1 = midVs[i + 1];
          if (mi !== undefined) ring.push(mi);
          ring.push(newVs[i + 1]);
          if (mi1 !== undefined) ring.push(mi1);
          if (ring.length >= 3) {
            this.meshData.addFace(ring);
          }
        }
      }
    }

    this.meshData.recalculateNormals();
  }

  subdivideCatmull(): void {
    this.subdivide();
  }

  applySculpt(
    brushWorldPos: THREE.Vector3,
    brushRadius: number,
    strength: number,
    mode: 'GRAB' | 'PUSH' | 'PULL' | 'SMOOTH',
    cameraPos?: THREE.Vector3,
  ): void {
    const objCenter = this.meshData.getBounds().center;
    const localBrushPos = brushWorldPos.clone();

    if (mode === 'GRAB' && cameraPos) {
      const brushDir = new THREE.Vector3().subVectors(localBrushPos, objCenter).normalize();
      for (const [id, v] of this.meshData.vertices) {
        const pos = new THREE.Vector3(v.position.x, v.position.y, v.position.z);
        const dist = pos.distanceTo(localBrushPos);
        if (dist <= brushRadius) {
          const weight = dist < 0.001 ? 1 : Math.pow(1 - dist / brushRadius, 2);
          v.position.x += brushDir.x * strength * weight;
          v.position.y += brushDir.y * strength * weight;
          v.position.z += brushDir.z * strength * weight;
        }
      }
    } else if (mode === 'PUSH' || mode === 'PULL') {
      for (const [id, v] of this.meshData.vertices) {
        const pos = new THREE.Vector3(v.position.x, v.position.y, v.position.z);
        const dist = pos.distanceTo(localBrushPos);
        if (dist <= brushRadius) {
          const weight = dist < 0.001 ? 1 : Math.pow(1 - dist / brushRadius, 2);
          const normal = new THREE.Vector3(v.normal.x, v.normal.y, v.normal.z);
          const dir = mode === 'PULL' ? 1 : -1;
          v.position.x += normal.x * strength * weight * dir;
          v.position.y += normal.y * strength * weight * dir;
          v.position.z += normal.z * strength * weight * dir;
        }
      }
    } else if (mode === 'SMOOTH') {
      const original = this.meshData.clone();
      for (const [id, v] of this.meshData.vertices) {
        const pos = new THREE.Vector3(v.position.x, v.position.y, v.position.z);
        const dist = pos.distanceTo(localBrushPos);
        if (dist <= brushRadius) {
          const weight = dist < 0.001 ? 1 : Math.pow(1 - dist / brushRadius, 2);
          const origV = original.getVertex(id);
          if (origV) {
            const avgNormal = new THREE.Vector3(origV.normal.x, origV.normal.y, origV.normal.z);
            v.position.x += avgNormal.x * strength * weight * 0.5;
            v.position.y += avgNormal.y * strength * weight * 0.5;
            v.position.z += avgNormal.z * strength * weight * 0.5;
          }
        }
      }
    }

    this.meshData.recalculateNormals();
  }

  getSelectedVertices(): Vertex[] {
    const result: Vertex[] = [];
    for (const v of this.meshData.vertices.values()) {
      if (v.selected) result.push(v);
    }
    return result;
  }

  selectVerticesInRadius(center: THREE.Vector3, radius: number): string[] {
    const selected: string[] = [];
    for (const [id, v] of this.meshData.vertices) {
      const pos = new THREE.Vector3(v.position.x, v.position.y, v.position.z);
      if (pos.distanceTo(center) <= radius) {
        v.selected = true;
        selected.push(id);
      }
    }
    return selected;
  }

  clearVertexSelection(): void {
    for (const v of this.meshData.vertices.values()) {
      v.selected = false;
    }
  }
}

export default MeshEditor;

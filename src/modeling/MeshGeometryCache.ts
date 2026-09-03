import * as THREE from 'three';

export interface VertexWorldData {
  id: string;
  localPos: THREE.Vector3;
  worldPos: THREE.Vector3;
  normal: THREE.Vector3;
  objId: string;
}

export interface FaceWorldData {
  id: string;
  worldCenter: THREE.Vector3;
  worldNormal: THREE.Vector3;
  objId: string;
  vertexIds: string[];
}

export class MeshGeometryCache {
  private vertexData: Map<string, VertexWorldData> = new Map();
  private faceData: Map<string, FaceWorldData> = new Map();
  private objectVertices: Map<string, VertexWorldData[]> = new Map();
  private objectFaces: Map<string, FaceWorldData[]> = new Map();

  clearObject(objId: string): void {
    const verts = this.objectVertices.get(objId);
    if (verts) {
      for (const v of verts) {
        this.vertexData.delete(v.id);
      }
    }
    const faces = this.objectFaces.get(objId);
    if (faces) {
      for (const f of faces) {
        this.faceData.delete(f.id);
      }
    }
    this.objectVertices.delete(objId);
    this.objectFaces.delete(objId);
  }

  setVertexData(objId: string, vertexId: string, localPos: THREE.Vector3, worldPos: THREE.Vector3, normal: THREE.Vector3): void {
    const data: VertexWorldData = { id: vertexId, localPos, worldPos, normal, objId };
    this.vertexData.set(vertexId, data);
    let verts = this.objectVertices.get(objId);
    if (!verts) {
      verts = [];
      this.objectVertices.set(objId, verts);
    }
    verts.push(data);
  }

  setFaceData(objId: string, faceId: string, worldCenter: THREE.Vector3, worldNormal: THREE.Vector3, vertexIds: string[]): void {
    const data: FaceWorldData = { id: faceId, worldCenter, worldNormal, objId, vertexIds };
    this.faceData.set(faceId, data);
    let faces = this.objectFaces.get(objId);
    if (!faces) {
      faces = [];
      this.objectFaces.set(objId, faces);
    }
    faces.push(data);
  }

  updateVertexWorldPos(objId: string, vertexId: string, worldPos: THREE.Vector3): void {
    const v = this.vertexData.get(vertexId);
    if (v) {
      v.worldPos.copy(worldPos);
    }
  }

  updateVertexWorldPositions(objId: string, objectWorldPos: THREE.Vector3, objectScale: THREE.Vector3): void {
    const verts = this.objectVertices.get(objId);
    if (!verts) return;
    for (const v of verts) {
      v.worldPos.set(
        v.localPos.x * objectScale.x + objectWorldPos.x,
        v.localPos.y * objectScale.y + objectWorldPos.y,
        v.localPos.z * objectScale.z + objectWorldPos.z,
      );
    }
  }

  findClosestVertex(worldPos: THREE.Vector3, maxDistance: number = 0.5): VertexWorldData | null {
    let closest: VertexWorldData | null = null;
    let minDist = maxDistance;
    for (const v of this.vertexData.values()) {
      const dist = v.worldPos.distanceTo(worldPos);
      if (dist < minDist) {
        minDist = dist;
        closest = v;
      }
    }
    return closest;
  }

  findClosestFace(worldPos: THREE.Vector3, maxDistance: number = 1.0): FaceWorldData | null {
    let closest: FaceWorldData | null = null;
    let minDist = maxDistance;
    for (const f of this.faceData.values()) {
      const dist = f.worldCenter.distanceTo(worldPos);
      if (dist < minDist) {
        minDist = dist;
        closest = f;
      }
    }
    return closest;
  }

  getVerticesForObject(objId: string): VertexWorldData[] {
    return this.objectVertices.get(objId) || [];
  }

  getFacesForObject(objId: string): FaceWorldData[] {
    return this.objectFaces.get(objId) || [];
  }

  clear(): void {
    this.vertexData.clear();
    this.faceData.clear();
    this.objectVertices.clear();
    this.objectFaces.clear();
  }

  rebuildFromGeometry(objId: string, geometry: THREE.BufferGeometry, objectPos: THREE.Vector3, objectScale: THREE.Vector3, objectQuat: THREE.Quaternion): void {
    this.clearObject(objId);

    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const indices = geometry.index ? geometry.index.array : null;

    const vertList: VertexWorldData[] = [];

    if (indices) {
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i] as number;
        const localX = positions.getX(idx);
        const localY = positions.getY(idx);
        const localZ = positions.getZ(idx);

        const localPos = new THREE.Vector3(localX * objectScale.x, localY * objectScale.y, localZ * objectScale.z);
        const worldPos = localPos.clone().applyQuaternion(objectQuat).add(objectPos);

        const nX = normals ? normals.getX(idx) : 0;
        const nY = normals ? normals.getY(idx) : 1;
        const nZ = normals ? normals.getZ(idx) : 0;
        const normal = new THREE.Vector3(nX, nY, nZ).applyQuaternion(objectQuat).normalize();

        const vertexId = `${objId}_v${vertList.length}`;
        const data: VertexWorldData = { id: vertexId, localPos, worldPos, normal, objId };
        vertList.push(data);
        this.vertexData.set(vertexId, data);
      }
    } else {
      for (let i = 0; i < positions.count; i++) {
        const localX = positions.getX(i);
        const localY = positions.getY(i);
        const localZ = positions.getZ(i);

        const localPos = new THREE.Vector3(localX * objectScale.x, localY * objectScale.y, localZ * objectScale.z);
        const worldPos = localPos.clone().applyQuaternion(objectQuat).add(objectPos);

        const nX = normals ? normals.getX(i) : 0;
        const nY = normals ? normals.getY(i) : 1;
        const nZ = normals ? normals.getZ(i) : 0;
        const normal = new THREE.Vector3(nX, nY, nZ).applyQuaternion(objectQuat).normalize();

        const vertexId = `${objId}_v${vertList.length}`;
        const data: VertexWorldData = { id: vertexId, localPos, worldPos, normal, objId };
        vertList.push(data);
        this.vertexData.set(vertexId, data);
      }
    }

    this.objectVertices.set(objId, vertList);
  }

  rebuildFaces(objId: string, geometry: THREE.BufferGeometry, objectPos: THREE.Vector3, objectScale: THREE.Vector3, objectQuat: THREE.Quaternion): void {
    this.objectFaces.delete(objId);

    const positions = geometry.attributes.position;
    const indices = geometry.index ? geometry.index.array : null;
    const verts = this.objectVertices.get(objId) || [];

    if (!indices) return;

    const faceList: FaceWorldData[] = [];

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] as number;
      const i1 = indices[i + 1] as number;
      const i2 = indices[i + 2] as number;

      const v0 = verts[Math.floor(i0 / 3)] || verts[i0];
      const v1 = verts[Math.floor(i1 / 3)] || verts[i1];
      const v2 = verts[Math.floor(i2 / 3)] || verts[i2];

      if (!v0 || !v1 || !v2) continue;

      const center = new THREE.Vector3()
        .addVectors(v0.worldPos, v0.worldPos)
        .add(v1.worldPos)
        .add(v2.worldPos)
        .multiplyScalar(0.333);

      const edge1 = new THREE.Vector3().subVectors(v1.worldPos, v0.worldPos);
      const edge2 = new THREE.Vector3().subVectors(v2.worldPos, v0.worldPos);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

      const faceId = `${objId}_f${faceList.length}`;
      const data: FaceWorldData = {
        id: faceId,
        worldCenter: center,
        worldNormal: normal,
        objId,
        vertexIds: [v0.id, v1.id, v2.id],
      };
      faceList.push(data);
      this.faceData.set(faceId, data);
    }

    this.objectFaces.set(objId, faceList);
  }
}

export default MeshGeometryCache;

import * as THREE from 'three';

export interface Vertex {
  id: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  selected?: boolean;
  originalIndex?: number;
}

export interface Edge {
  id: string;
  vertexA: string;
  vertexB: string;
  selected?: boolean;
  faces: string[];
}

export interface Face {
  id: string;
  vertices: string[];
  normal: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
  selected?: boolean;
  edges: string[];
}

export type Mode = 'OBJECT' | 'EDIT' | 'SCULPT' | 'CUT';
export type SubMode = 'VERTEX' | 'EDGE' | 'FACE';

export interface ExtrudeResult {
  newVertices: Vertex[];
  newFaces: Face[];
  newEdges: Edge[];
}

export class MeshData {
  public vertices: Map<string, Vertex> = new Map();
  public edges: Map<string, Edge> = new Map();
  public faces: Map<string, Face> = new Map();
  public vertexCounter: number = 0;
  public edgeCounter: number = 0;
  public faceCounter: number = 0;

  private vertexIdMap: Map<number, string> = new Map();

  clear(): void {
    this.vertices.clear();
    this.edges.clear();
    this.faces.clear();
    this.vertexCounter = 0;
    this.edgeCounter = 0;
    this.faceCounter = 0;
    this.vertexIdMap.clear();
  }

  addVertex(position: { x: number; y: number; z: number }, normal: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }): Vertex {
    const id = `v_${this.vertexCounter++}`;
    const v: Vertex = { id, position: { ...position }, normal: { ...normal } };
    this.vertices.set(id, v);
    return v;
  }

  addVertexAt(index: number, position: { x: number; y: number; z: number }): Vertex {
    const v = this.addVertex(position);
    this.vertexIdMap.set(index, v.id);
    return v;
  }

  getVertex(id: string): Vertex | undefined {
    return this.vertices.get(id);
  }

  setVertexPosition(id: string, position: { x: number; y: number; z: number }): boolean {
    const v = this.vertices.get(id);
    if (!v) return false;
    v.position = { ...position };
    return true;
  }

  addEdge(vertexA: string, vertexB: string): Edge {
    const id = `e_${this.edgeCounter++}`;
    const edge: Edge = { id, vertexA, vertexB, faces: [] };
    this.edges.set(id, edge);
    return edge;
  }

  getEdge(id: string): Edge | undefined {
    return this.edges.get(id);
  }

  getEdgeBetween(vA: string, vB: string): Edge | undefined {
    for (const edge of this.edges.values()) {
      if ((edge.vertexA === vA && edge.vertexB === vB) || (edge.vertexA === vB && edge.vertexB === vA)) {
        return edge;
      }
    }
    return undefined;
  }

  addFace(vertexIds: string[], normal?: { x: number; y: number; z: number }): Face {
    const id = `f_${this.faceCounter++}`;
    const computedNormal = normal || this.computeFaceNormal(vertexIds);
    const center = this.computeFaceCenter(vertexIds);
    const face: Face = { id, vertices: [...vertexIds], normal: computedNormal, center, edges: [] };
    this.faces.set(id, face);

    for (let i = 0; i < vertexIds.length; i++) {
      const vA = vertexIds[i];
      const vB = vertexIds[(i + 1) % vertexIds.length];
      let edge = this.getEdgeBetween(vA, vB);
      if (!edge) {
        edge = this.addEdge(vA, vB);
      }
      edge.faces.push(id);
      if (!face.edges.includes(edge.id)) {
        face.edges.push(edge.id);
      }
    }

    return face;
  }

  getFace(id: string): Face | undefined {
    return this.faces.get(id);
  }

  private computeFaceNormal(vertexIds: string[]): { x: number; y: number; z: number } {
    if (vertexIds.length < 3) return { x: 0, y: 1, z: 0 };
    const v0 = this.vertices.get(vertexIds[0]);
    const v1 = this.vertices.get(vertexIds[1]);
    const v2 = this.vertices.get(vertexIds[2]);
    if (!v0 || !v1 || !v2) return { x: 0, y: 1, z: 0 };

    const a = new THREE.Vector3(v0.position.x, v0.position.y, v0.position.z);
    const b = new THREE.Vector3(v1.position.x, v1.position.y, v1.position.z);
    const c = new THREE.Vector3(v2.position.x, v2.position.y, v2.position.z);

    const normal = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    return { x: normal.x, y: normal.y, z: normal.z };
  }

  private computeFaceCenter(vertexIds: string[]): { x: number; y: number; z: number } {
    if (vertexIds.length === 0) return { x: 0, y: 0, z: 0 };
    let x = 0, y = 0, z = 0;
    for (const vid of vertexIds) {
      const v = this.vertices.get(vid);
      if (v) {
        x += v.position.x;
        y += v.position.y;
        z += v.position.z;
      }
    }
    const n = vertexIds.length;
    return { x: x / n, y: y / n, z: z / n };
  }

  updateFaceNormal(faceId: string): void {
    const face = this.faces.get(faceId);
    if (!face) return;
    face.normal = this.computeFaceNormal(face.vertices);
    face.center = this.computeFaceCenter(face.vertices);
  }

  recalculateNormals(): void {
    for (const face of this.faces.values()) {
      this.updateFaceNormal(face.id);
    }
    for (const vertex of this.vertices.values()) {
      const normal = new THREE.Vector3(0, 0, 0);
      let count = 0;
      for (const face of this.faces.values()) {
        if (face.vertices.includes(vertex.id)) {
          normal.x += face.normal.x;
          normal.y += face.normal.y;
          normal.z += face.normal.z;
          count++;
        }
      }
      if (count > 0) {
        normal.divideScalar(count).normalize();
        vertex.normal = { x: normal.x, y: normal.y, z: normal.z };
      }
    }
  }

  getVerticesInRadius(center: THREE.Vector3, radius: number): { vertex: Vertex; distance: number; weight: number }[] {
    const result: { vertex: Vertex; distance: number; weight: number }[] = [];
    for (const vertex of this.vertices.values()) {
      const v = new THREE.Vector3(vertex.position.x, vertex.position.y, vertex.position.z);
      const dist = v.distanceTo(center);
      if (dist <= radius) {
        result.push({
          vertex,
          distance: dist,
          weight: dist < 0.001 ? 1 : 1 - dist / radius,
        });
      }
    }
    return result;
  }

  findClosestVertex(position: THREE.Vector3, maxDistance: number = 0.5): Vertex | null {
    let closest: Vertex | null = null;
    let minDist = maxDistance;
    for (const vertex of this.vertices.values()) {
      const v = new THREE.Vector3(vertex.position.x, vertex.position.y, vertex.position.z);
      const dist = v.distanceTo(position);
      if (dist < minDist) {
        minDist = dist;
        closest = vertex;
      }
    }
    return closest;
  }

  findClosestFace(position: THREE.Vector3, maxDistance: number = 1.0): Face | null {
    let closest: Face | null = null;
    let minDist = maxDistance;
    for (const face of this.faces.values()) {
      const c = new THREE.Vector3(face.center.x, face.center.y, face.center.z);
      const dist = c.distanceTo(position);
      if (dist < minDist) {
        minDist = dist;
        closest = face;
      }
    }
    return closest;
  }

  findClosestEdge(position: THREE.Vector3, maxDistance: number = 0.5): Edge | null {
    let closest: Edge | null = null;
    let minDist = maxDistance;
    for (const edge of this.edges.values()) {
      const vA = this.getVertex(edge.vertexA);
      const vB = this.getVertex(edge.vertexB);
      if (!vA || !vB) continue;
      const a = new THREE.Vector3(vA.position.x, vA.position.y, vA.position.z);
      const b = new THREE.Vector3(vB.position.x, vB.position.y, vB.position.z);
      const dist = this.pointToSegmentDistance(position, a, b);
      if (dist < minDist) {
        minDist = dist;
        closest = edge;
      }
    }
    return closest;
  }

  private pointToSegmentDistance(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(p, a);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
    const closest = a.clone().add(ab.multiplyScalar(t));
    return p.distanceTo(closest);
  }

  toBufferGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    const vertexArray = Array.from(this.vertices.values());
    const vertexIndexMap = new Map<string, number>();

    vertexArray.forEach((v, i) => {
      positions.push(v.position.x, v.position.y, v.position.z);
      normals.push(v.normal.x, v.normal.y, v.normal.z);
      vertexIndexMap.set(v.id, i);
    });

    for (const face of this.faces.values()) {
      if (face.vertices.length >= 3) {
        for (let i = 1; i < face.vertices.length - 1; i++) {
          const i0 = vertexIndexMap.get(face.vertices[0]);
          const i1 = vertexIndexMap.get(face.vertices[i]);
          const i2 = vertexIndexMap.get(face.vertices[i + 1]);
          if (i0 !== undefined && i1 !== undefined && i2 !== undefined) {
            indices.push(i0, i1, i2);
          }
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  fromBufferGeometry(geometry: THREE.BufferGeometry): void {
    this.clear();

    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    for (let i = 0; i < positions.count; i++) {
      const pos = {
        x: positions.getX(i),
        y: positions.getY(i),
        z: positions.getZ(i),
      };
      const normal = normals
        ? { x: normals.getX(i), y: normals.getY(i), z: normals.getZ(i) }
        : { x: 0, y: 1, z: 0 };
      const v = this.addVertex(pos, normal);
      this.vertexIdMap.set(i, v.id);
    }

    if (geometry.index) {
      const indices = geometry.index.array;
      for (let i = 0; i < indices.length; i += 3) {
        const va = this.vertexIdMap.get(indices[i] as number);
        const vb = this.vertexIdMap.get(indices[i + 1] as number);
        const vc = this.vertexIdMap.get(indices[i + 2] as number);
        if (va && vb && vc) {
          this.addFace([va, vb, vc]);
        }
      }
    } else {
      for (let i = 0; i < positions.count; i += 3) {
        const va = this.vertexIdMap.get(i);
        const vb = this.vertexIdMap.get(i + 1);
        const vc = this.vertexIdMap.get(i + 2);
        if (va && vb && vc) {
          this.addFace([va, vb, vc]);
        }
      }
    }

    this.recalculateNormals();
  }

  clone(): MeshData {
    const clone = new MeshData();
    clone.vertexCounter = this.vertexCounter;
    clone.edgeCounter = this.edgeCounter;
    clone.faceCounter = this.faceCounter;

    for (const [id, v] of this.vertices) {
      clone.vertices.set(id, { ...v, position: { ...v.position }, normal: { ...v.normal } });
    }
    for (const [id, e] of this.edges) {
      clone.edges.set(id, { ...e, faces: [...e.faces] });
    }
    for (const [id, f] of this.faces) {
      clone.faces.set(id, { ...f, vertices: [...f.vertices], normal: { ...f.normal }, center: { ...f.center }, edges: [...f.edges] });
    }
    return clone;
  }

  getBounds(): { min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3; size: THREE.Vector3 } {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const v of this.vertices.values()) {
      min.min(new THREE.Vector3(v.position.x, v.position.y, v.position.z));
      max.max(new THREE.Vector3(v.position.x, v.position.y, v.position.z));
    }
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    const size = new THREE.Vector3().subVectors(max, min);
    return { min, max, center, size };
  }
}

export default MeshData;

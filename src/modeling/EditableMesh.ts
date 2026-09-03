import * as THREE from 'three';
import type { Vertex, Edge, Face } from './MeshData';
import { MeshData } from './MeshData';
import { MeshEditor } from './MeshEditor';

export type EditTool = 'SELECT' | 'MOVE' | 'PULL' | 'PUSH' | 'BEND' | 'TWIST' | 'EXTRUDE' | 'CUT' | 'SMOOTH' | 'STRETCH' | 'COMPRESS';

export interface EditGrabState {
  active: boolean;
  hand: 'Left' | 'Right';
  tool: EditTool;
  meshId: string;
  vertexIds: string[];
  faceId: string | null;
  edgeId: string | null;
  grabWorldPos: THREE.Vector3;
  grabLocalPos: THREE.Vector3;
  startHandPos: THREE.Vector3;
  startObjectPos: { x: number; y: number; z: number };
  originalPositions: Map<string, { x: number; y: number; z: number }>;
  influenceRadius: number;
  strength: number;
}

export class EditableMesh {
  public readonly id: string;
  public readonly meshData: MeshData;
  public readonly meshEditor: MeshEditor;
  public mesh: THREE.Mesh;
  public geometry: THREE.BufferGeometry;
  public originalGeometry: THREE.BufferGeometry;
  public objectMatrix: THREE.Matrix4;
  public objectMatrixInverse: THREE.Matrix4;
  public verticesGroup: THREE.Group | null = null;
  public edgesGroup: THREE.Group | null = null;
  public facesGroup: THREE.Group | null = null;
  public selectionGroup: THREE.Group | null = null;
  private vertexMeshes: Map<string, THREE.Mesh> = new Map();
  private edgeMeshes: Map<string, THREE.Line> = new Map();
  private faceMeshes: Map<string, THREE.Mesh> = new Map();
  private scene: THREE.Scene | null = null;
  private dirty: boolean = false;

  constructor(id: string, geometry: THREE.BufferGeometry, name: string = 'EditableMesh') {
    this.id = id;
    this.meshData = new MeshData();
    this.meshEditor = new MeshEditor(id, name);
    this.objectMatrix = new THREE.Matrix4();
    this.objectMatrixInverse = new THREE.Matrix4();
    
    this.ensureEditableGeometry(geometry);
    this.geometry = geometry;
    this.originalGeometry = geometry.clone();
    
    this.meshData.fromBufferGeometry(geometry);
    this.meshEditor.loadFromGeometry(geometry);
    
    const material = new THREE.MeshStandardMaterial({
      color: '#4A90D9',
      metalness: 0.1,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.editableMeshId = id;
    this.mesh.userData.isEditable = true;
    
    this.updateMatrix();
  }

  private ensureEditableGeometry(geometry: THREE.BufferGeometry): void {
    if (!geometry.isBufferGeometry) return;
    
    const posAttr = geometry.attributes.position;
    if (!posAttr) return;
    
    const vertexCount = posAttr.count;
    
    if (geometry.index) {
      const indexArray = geometry.index.array;
      const nonIndexedPositions: number[] = [];
      
      for (let i = 0; i < indexArray.length; i++) {
        const idx = indexArray[i];
        nonIndexedPositions.push(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
      }
      
      const newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.Float32BufferAttribute(nonIndexedPositions, 3));
      
      if (geometry.attributes.normal) {
        const nonIndexedNormals: number[] = [];
        for (let i = 0; i < indexArray.length; i++) {
          const idx = indexArray[i];
          const normalAttr = geometry.attributes.normal;
          nonIndexedNormals.push(normalAttr.getX(idx), normalAttr.getY(idx), normalAttr.getZ(idx));
        }
        newGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nonIndexedNormals, 3));
      }
      
      geometry.dispose();
      geometry = newGeo;
    }
    
    if (vertexCount < 50) {
      this.subdivideGeometry(geometry, 1);
    }
  }

  private subdivideGeometry(geometry: THREE.BufferGeometry, iterations: number): void {
    for (let iter = 0; iter < iterations; iter++) {
      const posAttr = geometry.attributes.position;
      const normalAttr = geometry.attributes.normal;
      const positions = posAttr.array as Float32Array;
      const normals = normalAttr ? (normalAttr.array as Float32Array) : null;
      
      const vertexCount = posAttr.count;
      const newPositions: number[] = [];
      const newNormals: number[] = [];
      
      for (let i = 0; i < vertexCount; i += 3) {
        const v0 = new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        const v1 = new THREE.Vector3(positions[(i + 1) * 3], positions[(i + 1) * 3 + 1], positions[(i + 1) * 3 + 2]);
        const v2 = new THREE.Vector3(positions[(i + 2) * 3], positions[(i + 2) * 3 + 1], positions[(i + 2) * 3 + 2]);
        
        const n0 = normals ? new THREE.Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) : new THREE.Vector3(0, 1, 0);
        const n1 = normals ? new THREE.Vector3(normals[(i + 1) * 3], normals[(i + 1) * 3 + 1], normals[(i + 1) * 3 + 2]) : new THREE.Vector3(0, 1, 0);
        const n2 = normals ? new THREE.Vector3(normals[(i + 2) * 3], normals[(i + 2) * 3 + 1], normals[(i + 2) * 3 + 2]) : new THREE.Vector3(0, 1, 0);
        
        const m01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5);
        const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
        const m20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5);
        const nm01 = new THREE.Vector3().addVectors(n0, n1).normalize();
        const nm12 = new THREE.Vector3().addVectors(n1, n2).normalize();
        const nm20 = new THREE.Vector3().addVectors(n2, n0).normalize();
        
        const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
        const nCenter = new THREE.Vector3().add(n0).add(n1).add(n2).normalize();
        
        const addVertex = (v: THREE.Vector3, n: THREE.Vector3) => {
          newPositions.push(v.x, v.y, v.z);
          newNormals.push(n.x, n.y, n.z);
        };
        
        addVertex(v0, n0);
        addVertex(m01, nm01);
        addVertex(center, nCenter);
        addVertex(m20, nm20);
        
        addVertex(m01, nm01);
        addVertex(v1, n1);
        addVertex(m12, nm12);
        addVertex(center, nCenter);
        
        addVertex(m20, nm20);
        addVertex(center, nCenter);
        addVertex(m12, nm12);
        addVertex(v2, n2);
        
        addVertex(center, nCenter);
        addVertex(m01, nm01);
        addVertex(m20, nm20);
        addVertex(m12, nm12);
      }
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
      geometry.computeVertexNormals();
    }
  }

  setScene(scene: THREE.Scene | null): void {
    if (this.scene) {
      if (this.verticesGroup) this.scene.remove(this.verticesGroup);
      if (this.edgesGroup) this.scene.remove(this.edgesGroup);
      if (this.facesGroup) this.scene.remove(this.facesGroup);
      if (this.selectionGroup) this.scene.remove(this.selectionGroup);
    }
    this.scene = scene;
    if (scene) {
      if (this.verticesGroup) scene.add(this.verticesGroup);
      if (this.edgesGroup) scene.add(this.edgesGroup);
      if (this.facesGroup) scene.add(this.facesGroup);
      if (this.selectionGroup) scene.add(this.selectionGroup);
    }
  }

  updateMatrix(): void {
    this.objectMatrix.copy(this.mesh.matrixWorld);
    this.objectMatrixInverse.copy(this.objectMatrix).invert();
  }

  worldToLocal(worldPos: THREE.Vector3): THREE.Vector3 {
    return worldPos.clone().applyMatrix4(this.objectMatrixInverse);
  }

  localToWorld(localPos: THREE.Vector3): THREE.Vector3 {
    return localPos.clone().applyMatrix4(this.objectMatrix);
  }

  applyGeometryChanges(): void {
    const newGeometry = this.meshData.toBufferGeometry();
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
    this.geometry = newGeometry;
    this.dirty = true;
  }

  getVertexWorldPosition(vertexId: string): THREE.Vector3 | null {
    const vertex = this.meshData.getVertex(vertexId);
    if (!vertex) return null;
    const localPos = new THREE.Vector3(vertex.position.x, vertex.position.y, vertex.position.z);
    return this.localToWorld(localPos);
  }

  findClosestVertex(worldPos: THREE.Vector3, maxDistance: number = 0.3): Vertex | null {
    const localPos = this.worldToLocal(worldPos);
    const vertices = Array.from(this.meshData.vertices.values());
    let closest: Vertex | null = null;
    let minDist = maxDistance;
    
    for (const v of vertices) {
      const vPos = new THREE.Vector3(v.position.x, v.position.y, v.position.z);
      const dist = vPos.distanceTo(localPos);
      if (dist < minDist) {
        minDist = dist;
        closest = v;
      }
    }
    return closest;
  }

  findClosestFace(worldPos: THREE.Vector3, maxDistance: number = 0.5): Face | null {
    const localPos = this.worldToLocal(worldPos);
    const faces = Array.from(this.meshData.faces.values());
    let closest: Face | null = null;
    let minDist = maxDistance;
    
    for (const face of faces) {
      const faceCenter = new THREE.Vector3(face.center.x, face.center.y, face.center.z);
      const dist = faceCenter.distanceTo(localPos);
      if (dist < minDist) {
        minDist = dist;
        closest = face;
      }
    }
    return closest;
  }

  findClosestEdge(worldPos: THREE.Vector3, maxDistance: number = 0.3): Edge | null {
    const localPos = this.worldToLocal(worldPos);
    const edges = Array.from(this.meshData.edges.values());
    let closest: Edge | null = null;
    let minDist = maxDistance;
    
    for (const edge of edges) {
      const vA = this.meshData.getVertex(edge.vertexA);
      const vB = this.meshData.getVertex(edge.vertexB);
      if (!vA || !vB) continue;
      
      const a = new THREE.Vector3(vA.position.x, vA.position.y, vA.position.z);
      const b = new THREE.Vector3(vB.position.x, vB.position.y, vB.position.z);
      const dist = this.pointToSegmentDistance(localPos, a, b);
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

  showEditElements(visible: boolean): void {
    if (this.verticesGroup) this.verticesGroup.visible = visible;
    if (this.edgesGroup) this.edgesGroup.visible = visible;
    if (this.facesGroup) this.facesGroup.visible = visible;
    if (this.selectionGroup) this.selectionGroup.visible = visible;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.originalGeometry.dispose();
    const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
    for (const mat of materials) {
      if (mat) mat.dispose();
    }
    this.vertexMeshes.forEach(m => { if (m.geometry) m.geometry.dispose(); });
    this.edgeMeshes.forEach(l => { if (l.geometry) l.geometry.dispose(); });
    this.faceMeshes.forEach(m => { if (m.geometry) m.geometry.dispose(); });
    this.vertexMeshes.clear();
    this.edgeMeshes.clear();
    this.faceMeshes.clear();
  }
}

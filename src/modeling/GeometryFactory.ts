import * as THREE from 'three';
import type { ObjectType } from '../scene/types';

export class GeometryFactory {
  static createGeometry(type: ObjectType): THREE.BufferGeometry {
    switch (type) {
      case 'cube': return new THREE.BoxGeometry(1, 1, 1);
      case 'sphere': return new THREE.SphereGeometry(0.7, 32, 32);
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
      case 'cone': return new THREE.ConeGeometry(0.5, 1.5, 32);
      case 'torus': return new THREE.TorusGeometry(0.7, 0.25, 16, 100);
      case 'plane': return new THREE.PlaneGeometry(2, 2);
      case 'capsule': return new THREE.CapsuleGeometry(0.5, 1, 4, 8);
      case 'monkey': return GeometryFactory.createMonkeyGeometry();
      case 'light': return new THREE.SphereGeometry(0.3, 16, 16);
      case 'camera': return new THREE.ConeGeometry(0.3, 0.6, 4);
      case 'empty': return new THREE.SphereGeometry(0.1, 8, 8);
      default: return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  static createMonkeyGeometry(): THREE.BufferGeometry {
    const group = new THREE.Group();
    
    const headGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const head = new THREE.Mesh(headGeo, headMat);
    group.add(head);
    
    const earGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const leftEar = new THREE.Mesh(earGeo, headMat);
    leftEar.position.set(-0.35, 0.35, 0.3);
    group.add(leftEar);
    
    const rightEar = new THREE.Mesh(earGeo, headMat);
    rightEar.position.set(0.35, 0.35, 0.3);
    group.add(rightEar);
    
    const snoutGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const snout = new THREE.Mesh(snoutGeo, new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 }));
    snout.position.set(0, -0.1, 0.45);
    group.add(snout);
    
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    leftEye.position.set(-0.15, 0.1, 0.45);
    group.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    rightEye.position.set(0.15, 0.1, 0.45);
    group.add(rightEye);
    
    const bufferGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    let idx = 0;
    
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const geom = (obj.geometry as any).toNonIndexed();
        const pos = geom.attributes.position.array as Float32Array;
        const norm = geom.attributes.normal.array as Float32Array;
        
        const matrix = new THREE.Matrix4().copy(obj.matrixWorld);
        
        for (let i = 0; i < pos.length; i += 3) {
          const v = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]);
          v.applyMatrix4(matrix);
          positions.push(v.x, v.y, v.z);
          
          const n = new THREE.Vector3(norm[i], norm[i + 1], norm[i + 2]);
          n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();
          normals.push(n.x, n.y, n.z);
        }
        
        for (let i = 0; i < pos.length / 3; i++) {
          indices.push(idx, idx + 1, idx + 2);
          idx += 3;
        }
      }
    });
    
    bufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    bufferGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    bufferGeo.setIndex(indices);
    bufferGeo.computeVertexNormals();
    
    return bufferGeo;
  }
}

export default GeometryFactory;

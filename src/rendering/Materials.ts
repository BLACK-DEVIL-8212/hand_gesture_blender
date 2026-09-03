import * as THREE from 'three';
import type { ObjectMaterial } from '../scene/types';

export class Materials {
  private materials: Map<string, THREE.MeshStandardMaterial> = new Map();
  private basicMaterials: Map<string, THREE.MeshBasicMaterial> = new Map();

  createStandardMaterial(material: ObjectMaterial): THREE.MeshStandardMaterial {
    const key = material.id;
    let mat = this.materials.get(key);
    
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(material.baseColor),
        metalness: material.metalness,
        roughness: material.roughness,
        transparent: material.transparent,
        opacity: material.opacity,
        emissive: new THREE.Color(material.emissive),
        emissiveIntensity: material.emissiveIntensity,
        side: THREE.DoubleSide,
      });
      this.materials.set(key, mat);
    }
    
    mat.color.set(material.baseColor);
    mat.metalness = material.metalness;
    mat.roughness = material.roughness;
    mat.transparent = material.transparent;
    mat.opacity = material.opacity;
    mat.emissive.set(material.emissive);
    mat.emissiveIntensity = material.emissiveIntensity;
    mat.needsUpdate = true;
    
    return mat;
  }

  createBasicMaterial(material: ObjectMaterial): THREE.MeshBasicMaterial {
    const key = material.id;
    let mat = this.basicMaterials.get(key);
    
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(material.baseColor),
        transparent: material.transparent,
        opacity: material.opacity,
        side: THREE.DoubleSide,
      });
      this.basicMaterials.set(key, mat);
    }
    
    mat.color.set(material.baseColor);
    mat.transparent = material.transparent;
    mat.opacity = material.opacity;
    
    return mat;
  }

  createColorMaterial(color: string | THREE.Color, wireframe = false): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      wireframe,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
    });
  }

  getDefaultMaterial(): THREE.MeshStandardMaterial {
    return this.createStandardMaterial({
      id: 'default',
      name: 'Default',
      baseColor: '#4A90D9',
      metalness: 0.1,
      roughness: 0.7,
      emissive: '#000000',
      emissiveIntensity: 0,
      transparent: false,
      opacity: 1,
    });
  }

  dispose(): void {
    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    for (const mat of this.basicMaterials.values()) {
      mat.dispose();
    }
    this.materials.clear();
    this.basicMaterials.clear();
  }
}

export default Materials;

import * as THREE from 'three';
import type { SceneObject } from '../scene/types';

export interface Object3DMapping {
  id: string;
  mesh: THREE.Object3D;
  type: SceneObject['type'];
  outline: THREE.Object3D | null;
  gizmo: THREE.Object3D | null;
  hover: boolean;
  selected: boolean;
}

export class SceneRenderer {
  private scene: THREE.Scene;
  private mappings: Map<string, Object3DMapping> = new Map();
  private group: THREE.Group;
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private ambientLight!: THREE.AmbientLight;
  private directionalLight!: THREE.DirectionalLight;
  private hemisphereLight!: THREE.HemisphereLight;
  private shadowPlane: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private settings: any;
  private hoverColor: THREE.Color = new THREE.Color(0xffff00);
  private selectColor: THREE.Color = new THREE.Color(0x00ffff);

  constructor(settings: any) {
    this.settings = settings;
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    this.setupLighting();
    this.setupGrid();
    this.setupAxes();
  }

  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0x404060, 2.0);
    this.scene.add(this.ambientLight);
    
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    this.directionalLight.position.set(10, 20, 15);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 100;
    this.directionalLight.shadow.camera.left = -20;
    this.directionalLight.shadow.camera.right = 20;
    this.directionalLight.shadow.camera.top = 20;
    this.directionalLight.shadow.camera.bottom = -20;
    this.scene.add(this.directionalLight);
    
    this.hemisphereLight = new THREE.HemisphereLight(0x878787, 0x404060, 0.5);
    this.scene.add(this.hemisphereLight);
    
    const shadowGeometry = new THREE.PlaneGeometry(100, 100);
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
    this.shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = -1.01;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);
  }

  private setupGrid(): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
    }
    
    this.gridHelper = new THREE.GridHelper(40, 80, 0x333333, 0x222222);
    this.gridHelper.position.y = -1;
    this.scene.add(this.gridHelper);
    this.gridHelper.visible = this.settings.rendering.gridVisible ?? true;
  }

  private setupAxes(): void {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
    }
    
    this.axesHelper = new THREE.AxesHelper(5);
    (this.axesHelper as any).material = new THREE.LineBasicMaterial({ color: 0xffffff });
    this.scene.add(this.axesHelper);
    this.axesHelper.visible = this.settings.rendering.axesVisible ?? true;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  createMeshForObject(obj: SceneObject): THREE.Object3D {
    const color = new THREE.Color(obj.material.baseColor);
    let material: THREE.Material = new THREE.MeshStandardMaterial({
      color,
      metalness: obj.material.metalness,
      roughness: obj.material.roughness,
      transparent: obj.material.transparent,
      opacity: obj.material.opacity,
      emissive: new THREE.Color(obj.material.emissive),
      emissiveIntensity: obj.material.emissiveIntensity,
      wireframe: this.settings.rendering.wireframeMode,
      side: THREE.DoubleSide,
    });
    
    let geometry: THREE.BufferGeometry;
    
    switch (obj.type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.7, 32, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1.5, 32);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(0.7, 0.25, 16, 100);
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(2, 2);
        break;
      case 'capsule':
        geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        break;
      case 'monkey':
        geometry = this.createMonkeyGeometry();
        break;
      case 'light':
        geometry = new THREE.SphereGeometry(0.3, 16, 16);
        material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        break;
      case 'camera':
        geometry = new THREE.ConeGeometry(0.3, 0.6, 4);
        material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        break;
      case 'empty':
        geometry = new THREE.SphereGeometry(0.1, 8, 8);
        material = new THREE.MeshBasicMaterial({ color: 0xff6600, wireframe: true });
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = obj.castShadow;
    mesh.receiveShadow = obj.receiveShadow;
    
    const container = new THREE.Group();
    container.add(mesh);
    
    return container;
  }

  private createMonkeyGeometry(): THREE.BufferGeometry {
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
        
        const mat = obj.matrixWorld.clone().toArray();
        const matrix = new THREE.Matrix4().fromArray(mat);
        
        for (let i = 0; i < pos.length; i += 3) {
          const v = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]);
          v.applyMatrix4(matrix);
          positions.push(v.x, v.y, v.z);
          
          const n = new THREE.Vector3(norm[i], norm[i + 1], norm[i + 2]);
          n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(matrix));
          normals.push(n.x, n.y, n.z);
          
          if (i % 9 === 0 && i + 8 < pos.length) {
            indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 1);
          }
          idx++;
        }
      }
    });
    
    bufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    bufferGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    bufferGeo.setIndex(indices);
    bufferGeo.computeVertexNormals();
    
    return bufferGeo;
  }

  addObject(obj: SceneObject): void {
    if (this.mappings.has(obj.id)) {
      this.removeObject(obj.id);
    }
    
    const mesh = this.createMeshForObject(obj);
    mesh.userData = { id: obj.id, type: obj.type };
    
    const mapping: Object3DMapping = {
      id: obj.id,
      mesh,
      type: obj.type,
      outline: null,
      gizmo: null,
      hover: false,
      selected: false,
    };
    
    this.mappings.set(obj.id, mapping);
    this.group.add(mesh);
    this.updateObjectFromData(obj);
  }

  removeObject(id: string): void {
    const mapping = this.mappings.get(id);
    if (!mapping) return;
    
    if (mapping.outline && mapping.outline.parent) {
      mapping.outline.parent.remove(mapping.outline);
    }
    if (mapping.gizmo && mapping.gizmo.parent) {
      mapping.gizmo.parent.remove(mapping.gizmo);
    }
    if (mapping.mesh.parent) {
      mapping.mesh.parent.remove(mapping.mesh);
    }
    
    this.mappings.delete(id);
  }

  updateObjectFromData(obj: SceneObject): void {
    const mapping = this.mappings.get(obj.id);
    if (!mapping) return;
    
    const t = obj.transform;
    
    if (t.position) {
      mapping.mesh.position.set(t.position.x, t.position.y, t.position.z);
    }
    if (t.rotation) {
      mapping.mesh.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
    }
    if (t.scale) {
      mapping.mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
    }
    
    if (mapping.mesh.children[0] instanceof THREE.Mesh) {
      const meshChild = mapping.mesh.children[0] as THREE.Mesh;
      if (meshChild.material instanceof THREE.MeshStandardMaterial) {
        meshChild.material.color.set(obj.material.baseColor);
        meshChild.material.metalness = obj.material.metalness;
        meshChild.material.roughness = obj.material.roughness;
        meshChild.material.transparent = obj.material.transparent;
        meshChild.material.opacity = obj.material.opacity;
        meshChild.material.emissive.set(obj.material.emissive);
        meshChild.material.emissiveIntensity = obj.material.emissiveIntensity;
        meshChild.material.wireframe = this.settings.rendering.wireframeMode;
        meshChild.material.needsUpdate = true;
      } else if (meshChild.material instanceof THREE.MeshBasicMaterial) {
        meshChild.material.color.set(obj.material.baseColor);
      }
    }
    
    mapping.mesh.visible = obj.visible;
    
    this.updateVisualState(obj.id);
  }

  updateVisualState(id: string): void {
    const mapping = this.mappings.get(id);
    if (!mapping) return;
    
    if (mapping.hover) {
      this.createOrUpdateOutline(id, this.hoverColor);
    } else if (mapping.selected) {
      this.createOrUpdateOutline(id, this.selectColor);
    } else {
      this.removeOutline(id);
    }
  }

  setHover(id: string, hover: boolean): void {
    const mapping = this.mappings.get(id);
    if (!mapping) return;
    mapping.hover = hover;
    this.updateVisualState(id);
  }

  setSelected(id: string, selected: boolean): void {
    const mapping = this.mappings.get(id);
    if (!mapping) return;
    mapping.selected = selected;
    this.updateVisualState(id);
  }

  private createOrUpdateOutline(id: string, color: THREE.Color): void {
    const mapping = this.mappings.get(id);
    if (!mapping) return;
    
    if (mapping.outline) {
      this.group.remove(mapping.outline);
      mapping.outline = null;
    }
    
    const box = new THREE.Box3().setFromObject(mapping.mesh);
    void box.getSize(new THREE.Vector3());

    const outlineMaterial = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = mapping.mesh as THREE.Mesh;
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const outline = new THREE.LineSegments(edges, outlineMaterial);
    outline.position.copy(mapping.mesh.position);
    outline.quaternion.copy(mapping.mesh.quaternion);
    outline.scale.copy(mapping.mesh.scale).multiplyScalar(1.05);
    
    this.group.add(outline);
    mapping.outline = outline;
  }

  private removeOutline(id: string): void {
    const mapping = this.mappings.get(id);
    if (!mapping || !mapping.outline) return;
    
    if (mapping.outline.parent) {
      mapping.outline.parent.remove(mapping.outline);
    }
    mapping.outline = null;
  }

  getObjectAtScreen(x: number, y: number, camera: THREE.Camera): string | null {
    this.raycaster.setFromCamera(
      new THREE.Vector2(x, y),
      camera
    );
    
    const objects: THREE.Object3D[] = [];
    for (const mapping of this.mappings.values()) {
      if (mapping.mesh.visible) {
        objects.push(mapping.mesh);
      }
    }
    
    const intersects = this.raycaster.intersectObjects(objects, true);
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      let target = obj;
      while (target.parent && target.parent !== this.group && target.parent.parent !== this.group) {
        target = target.parent;
      }
      const id = target.userData?.id;
      if (id) return id;
    }
    
    return null;
  }

  getObjectMapping(id: string): Object3DMapping | undefined {
    return this.mappings.get(id);
  }

  getAllMappings(): Object3DMapping[] {
    return Array.from(this.mappings.values());
  }

  updateSettings(settings: any): void {
    this.settings = settings;
    if (this.gridHelper) this.gridHelper.visible = settings.rendering.gridVisible ?? true;
    if (this.axesHelper) this.axesHelper.visible = settings.rendering.axesVisible ?? true;
    
    if (this.settings.rendering.backgroundColor) {
      this.scene.background = new THREE.Color(this.settings.rendering.backgroundColor);
    }
    
    for (const mapping of this.mappings.values()) {
      if (mapping.mesh.children[0] instanceof THREE.Mesh) {
        const meshChild = mapping.mesh.children[0] as THREE.Mesh;
        if (meshChild.material instanceof THREE.MeshStandardMaterial) {
          meshChild.material.wireframe = this.settings.rendering.wireframeMode;
          meshChild.material.needsUpdate = true;
        }
      }
    }
    
    if (this.directionalLight) {
      this.directionalLight.intensity = this.settings.rendering.shadowsEnabled ? 3.0 : 1.0;
    }
  }

  setBackground(color: string): void {
    this.scene.background = new THREE.Color(color);
  }

  getRaycaster(): THREE.Raycaster {
    return this.raycaster;
  }

  screenToWorldRay(x: number, y: number, camera: THREE.Camera): THREE.Ray {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    return raycaster.ray;
  }

  getObjectPosition(id: string): THREE.Vector3 | null {
    const mapping = this.mappings.get(id);
    if (!mapping) return null;
    return mapping.mesh.position;
  }

  clear(): void {
    for (const id of Array.from(this.mappings.keys())) {
      this.removeObject(id);
    }
  }
}

export default SceneRenderer;

import * as THREE from 'three';

export type Axis = 'x' | 'y' | 'z';

export class Gizmos {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private axisColors: Record<Axis, number> = {
    x: 0xff3333,
    y: 0x33ff33,
    z: 0x3333ff,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.group.visible = false;
  }

  show(): void {
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  createAxisConstraint(
    position: THREE.Vector3,
    axis: Axis,
    scale: number = 1
  ): THREE.Object3D {
    this.group.clear();
    
    const color = this.axisColors[axis];
    const size = 1 * scale;
    
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      depthWrite: false,
    });
    
    let geometry: THREE.BufferGeometry;
    
    if (axis === 'x') {
      geometry = new THREE.BoxGeometry(size, size * 0.2, size * 0.2);
    } else if (axis === 'y') {
      geometry = new THREE.BoxGeometry(size * 0.2, size, size * 0.2);
    } else {
      geometry = new THREE.BoxGeometry(size * 0.2, size * 0.2, size);
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    this.group.add(mesh);
    
    const ringGeo = new THREE.TorusGeometry(size * 0.8, size * 0.05, 8, 32);
    const ringMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    
    if (axis === 'x') {
      mesh.rotation.z = 0;
    } else if (axis === 'y') {
      mesh.rotation.x = 0;
    } else {
      mesh.rotation.y = 0;
    }
    
    const ring = new THREE.LineLoop(ringGeo, ringMat);
    ring.position.copy(position);
    
    if (axis === 'x') {
      ring.rotation.z = Math.PI / 2;
    } else if (axis === 'z') {
      ring.rotation.x = Math.PI / 2;
    }
    
    this.group.add(ring);
    
    return this.group;
  }

  createRotationRing(
    position: THREE.Vector3,
    axis: Axis,
    color?: number
  ): THREE.Object3D {
    const ringColor = color || this.axisColors[axis];
    const ringGeo = new THREE.TorusGeometry(1.2, 0.03, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    
    if (axis === 'x') {
      ring.rotation.z = Math.PI / 2;
    } else if (axis === 'z') {
      ring.rotation.x = Math.PI / 2;
    }
    
    this.group.add(ring);
    return ring;
  }

  createAxisLabel(
    position: THREE.Vector3,
    axis: Axis,
    text?: string
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = `#${this.axisColors[axis].toString(16).padStart(6, '0')}`;
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text || axis.toUpperCase(), 32, 32);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(0.5, 0.5, 0.5);
    
    this.group.add(sprite);
    return sprite;
  }

  clear(): void {
    this.group.clear();
  }

  dispose(): void {
    this.group.clear();
    this.scene.remove(this.group);
  }
}

export default Gizmos;

import * as THREE from 'three';

export interface RenderSettings {
  backgroundColor: string;
  gridVisible: boolean;
  axesVisible: boolean;
  shadowsEnabled: boolean;
  wireframeMode: boolean;
  antialias: boolean;
  pixelRatio: number;
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private fov: number;
  private isOrbiting = false;
  private isPanning = false;
  private orbitSpeed = 0.005;
  private panSpeed = 0.002;
  private zoomSpeed = 0.001;
  private minDistance = 2;
  private maxDistance = 100;
  private radius: number;

  constructor(
    fov: number = 60,
    aspect: number = 16 / 9,
    near: number = 0.1,
    far: number = 1000
  ) {
    this.fov = fov;

    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.target = new THREE.Vector3(0, 0, 0);

    this.radius = 15;
    this.updateCameraPosition();
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.target.set(0, 0, 0);
    this.updateRadius();
  }

  setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.updateCameraPosition();
  }

  getTarget(): THREE.Vector3 {
    return this.target;
  }

  focusOn(position: THREE.Vector3, distance: number = 10): void {
    this.target.copy(position);
    this.updateRadius();
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.target)
      .normalize();
    this.camera.position.copy(this.target).addScaledVector(direction, distance);
  }

  private updateRadius(): void {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.radius = offset.length();
  }

  private updateCameraPosition(): void {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.radius = offset.length();
    if (this.radius === 0) this.radius = 15;
  }

  orbit(deltaX: number, deltaY: number): void {
    const theta = Math.atan2(
      this.camera.position.x - this.target.x,
      this.camera.position.z - this.target.z
    );
    let phi = Math.atan2(
      this.camera.position.y - this.target.y,
      Math.sqrt(
        (this.camera.position.x - this.target.x) ** 2 +
        (this.camera.position.z - this.target.z) ** 2
      )
    );

    const newTheta = theta - deltaX * this.orbitSpeed;
    phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, phi - deltaY * this.orbitSpeed));

    this.camera.position.x = this.target.x + this.radius * Math.sin(newTheta) * Math.cos(phi);
    this.camera.position.y = this.target.y + this.radius * Math.sin(phi);
    this.camera.position.z = this.target.z + this.radius * Math.cos(newTheta) * Math.cos(phi);

    this.camera.lookAt(this.target);
  }

  orbitByDelta(deltaX: number, deltaY: number): void {
    this.orbit(deltaX, deltaY);
  }

  pan(deltaX: number, deltaY: number): void {
    const e = this.camera.matrixWorld.elements;
    const right = new THREE.Vector3(e[0], e[1], e[2]);
    const up = new THREE.Vector3(e[4], e[5], e[6]);

    const panX = new THREE.Vector3().copy(right).multiplyScalar(-deltaX * this.panSpeed * this.radius);
    const panY = new THREE.Vector3().copy(up).multiplyScalar(deltaY * this.panSpeed * this.radius);

    this.camera.position.add(panX).add(panY);
    this.target.add(panX).add(panY);
  }

  zoom(delta: number): void {
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.target)
      .normalize();

    const deltaZoom = delta * this.zoomSpeed * this.radius * 10;
    const newPos = new THREE.Vector3().copy(this.camera.position);
    newPos.addScaledVector(direction, deltaZoom);

    const newRadius = newPos.distanceTo(this.target);
    if (newRadius > this.minDistance && newRadius < this.maxDistance) {
      this.camera.position.copy(newPos);
    }
  }

  zoomToFit(objects: THREE.Object3D[]): void {
    if (objects.length === 0) return;

    const box = new THREE.Box3();
    for (const obj of objects) {
      box.expandByObject(obj);
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    this.target.copy(center);
    this.radius = maxDim * 1.5;
    this.camera.position.copy(center).add(new THREE.Vector3(0, 0, this.radius));
    this.camera.lookAt(this.target);
  }

  getPosition(): THREE.Vector3 {
    return this.camera.position;
  }

  setOrbiting(active: boolean): void {
    this.isOrbiting = active;
  }

  setPanning(active: boolean): void {
    this.isPanning = active;
  }

  getIsOrbiting(): boolean {
    return this.isOrbiting;
  }

  getIsPanning(): boolean {
    return this.isPanning;
  }

  getRadius(): number {
    return this.radius;
  }

  getFOV(): number {
    return this.fov;
  }
}

export default CameraController;

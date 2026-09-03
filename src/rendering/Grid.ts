import * as THREE from 'three';

export class Grid {
  private scene: THREE.Scene;
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private originMarker: THREE.Object3D | null = null;
  private size: number;
  private divisions: number;
  private colorCenter: THREE.Color;
  private colorGrid: THREE.Color;
  private visible: boolean;

  constructor(
    scene: THREE.Scene,
    size: number = 40,
    divisions: number = 80,
    visible: boolean = true
  ) {
    this.scene = scene;
    this.size = size;
    this.divisions = divisions;
    this.colorCenter = new THREE.Color(0x888888);
    this.colorGrid = new THREE.Color(0x333333);
    this.visible = visible;
    
    this.createGrid();
    this.createAxes();
    this.createOriginMarker();
  }

  private createGrid(): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
    }
    
    this.gridHelper = new THREE.GridHelper(this.size, this.divisions, this.colorCenter, this.colorGrid);
    this.gridHelper.position.y = -1;
    this.scene.add(this.gridHelper);
    this.gridHelper.visible = this.visible;
    
    (this.gridHelper.material as THREE.LineBasicMaterial).polygonOffset = true;
    (this.gridHelper.material as THREE.LineBasicMaterial).polygonOffsetFactor = -1;
  }

  private createAxes(): void {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
    }
    
    this.axesHelper = new THREE.AxesHelper(5);
    this.scene.add(this.axesHelper);
    this.axesHelper.visible = this.visible;
  }

  private createOriginMarker(): void {
    if (this.originMarker) {
      this.scene.remove(this.originMarker);
    }
    
    const group = new THREE.Group();
    
    const sphereGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(sphere);
    
    const axisLength = 2;
    const arrowGeo = new THREE.ConeGeometry(0.05, 0.2, 8);
    
    const xArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    xArrow.position.set(axisLength, 0, 0);
    xArrow.rotation.z = Math.PI / 2;
    group.add(xArrow);
    
    const yArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    yArrow.position.set(0, axisLength, 0);
    group.add(yArrow);
    
    const zArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    zArrow.position.set(0, 0, axisLength);
    zArrow.rotation.x = Math.PI / 2;
    group.add(zArrow);
    
    this.originMarker = group;
    this.scene.add(this.originMarker);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.gridHelper) this.gridHelper.visible = visible;
    if (this.axesHelper) this.axesHelper.visible = visible;
    if (this.originMarker) this.originMarker.visible = visible;
  }

  setSize(size: number, divisions?: number): void {
    this.size = size;
    if (divisions) this.divisions = divisions;
    this.createGrid();
  }

  setCenterColor(color: THREE.Color): void {
    this.colorCenter = color;
    if (this.gridHelper) {
      this.createGrid();
    }
  }

  setGridColor(color: THREE.Color): void {
    this.colorGrid = color;
    if (this.gridHelper) {
      this.createGrid();
    }
  }

  dispose(): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
    }
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper.dispose();
    }
    if (this.originMarker) {
      this.scene.remove(this.originMarker);
    }
  }
}

export default Grid;

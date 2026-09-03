import * as THREE from 'three';

export class Lighting {
  private scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private hemisphereLight: THREE.HemisphereLight;
  private directionalLightHelper: THREE.DirectionalLightHelper | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
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
  }

  getAmbientLight(): THREE.AmbientLight {
    return this.ambientLight;
  }

  getDirectionalLight(): THREE.DirectionalLight {
    return this.directionalLight;
  }

  getHemisphereLight(): THREE.HemisphereLight {
    return this.hemisphereLight;
  }

  setAmbientIntensity(intensity: number): void {
    this.ambientLight.intensity = intensity;
  }

  setDirectionalIntensity(intensity: number): void {
    this.directionalLight.intensity = intensity;
  }

  setDirectionalPosition(x: number, y: number, z: number): void {
    this.directionalLight.position.set(x, y, z);
  }

  setDirectionalColor(color: string | THREE.Color): void {
    this.directionalLight.color.set(color);
  }

  setHemisphereColors(sky: string, ground: string): void {
    this.hemisphereLight.color.set(sky);
    this.hemisphereLight.groundColor.set(ground);
  }

  enableShadow(enabled: boolean): void {
    this.directionalLight.castShadow = enabled;
    if (enabled && !this.directionalLightHelper) {
      this.directionalLightHelper = new THREE.DirectionalLightHelper(this.directionalLight, 1);
      this.scene.add(this.directionalLightHelper);
    } else if (!enabled && this.directionalLightHelper) {
      this.scene.remove(this.directionalLightHelper);
      this.directionalLightHelper = null;
    }
  }

  update(): void {
    this.directionalLightHelper?.update();
  }

  dispose(): void {
    if (this.directionalLightHelper) {
      this.scene.remove(this.directionalLightHelper);
      this.directionalLightHelper.dispose();
    }
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);
    this.scene.remove(this.hemisphereLight);
  }
}

export default Lighting;

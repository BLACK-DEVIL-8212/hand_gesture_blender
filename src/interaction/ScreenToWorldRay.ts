import * as THREE from 'three';

export class ScreenToWorldRay {
  private raycaster: THREE.Raycaster;
  private screenWidth: number = 1;
  private screenHeight: number = 1;
  private objectData: Map<string, { position: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } }> = new Map();

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  registerObjectData(id: string, position: { x: number; y: number; z: number }, scale: { x: number; y: number; z: number }): void {
    this.objectData.set(id, { position: { ...position }, scale: { ...scale } });
  }

  unregisterObject(id: string): void {
    this.objectData.delete(id);
  }

  setObjectWorldPosition(id: string, position: { x: number; y: number; z: number }): void {
    const existing = this.objectData.get(id);
    if (existing) {
      existing.position = { ...position };
    }
  }

  getObjectAtScreen(screenX: number, screenY: number, camera: THREE.Camera): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2(screenX, screenY), camera);

    console.log('[RAYCAST DEBUG]', {
      ndc: { x: Number(screenX.toFixed(4)), y: Number(screenY.toFixed(4)) },
      cameraPos: { x: Number(camera.position.x.toFixed(4)), y: Number(camera.position.y.toFixed(4)), z: Number(camera.position.z.toFixed(4)) },
      rayOrigin: { x: Number(this.raycaster.ray.origin.x.toFixed(4)), y: Number(this.raycaster.ray.origin.y.toFixed(4)), z: Number(this.raycaster.ray.origin.z.toFixed(4)) },
      rayDir: { x: Number(this.raycaster.ray.direction.x.toFixed(4)), y: Number(this.raycaster.ray.direction.y.toFixed(4)), z: Number(this.raycaster.ray.direction.z.toFixed(4)) },
      registeredCount: this.objectData.size,
    });

    let closest: { id: string; distance: number } | null = null;

    for (const [id, data] of this.objectData) {
      const pos = data.position;
      const size = data.scale;

      const halfSize = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
      halfSize.multiplyScalar(0.6);

      const box = new THREE.Box3().set(
        new THREE.Vector3().subVectors(pos, halfSize),
        new THREE.Vector3().addVectors(pos, halfSize)
      );

      const intersection = new THREE.Vector3();
      const distance = this.raycaster.ray.intersectBox(box, intersection);

      if (distance !== null) {
        const dist = intersection.distanceTo(this.raycaster.ray.origin);
        console.log('[RAYCAST DEBUG] HIT', {
          id,
          boxMin: { x: Number(box.min.x.toFixed(4)), y: Number(box.min.y.toFixed(4)), z: Number(box.min.z.toFixed(4)) },
          boxMax: { x: Number(box.max.x.toFixed(4)), y: Number(box.max.y.toFixed(4)), z: Number(box.max.z.toFixed(4)) },
          intersection: { x: Number(intersection.x.toFixed(4)), y: Number(intersection.y.toFixed(4)), z: Number(intersection.z.toFixed(4)) },
          dist: Number(dist.toFixed(4)),
        });
        if (!closest || dist < closest.distance) {
          closest = { id, distance: dist };
        }
      }
    }

    console.log('[RAYCAST DEBUG] RESULT', closest ? closest.id : 'null');
    return closest ? closest.id : null;
  }

  getObjectAtScreenFromMeshes(
    screenX: number,
    screenY: number,
    camera: THREE.Camera,
    meshes: THREE.Object3D[],
  ): THREE.Object3D | null {
    this.raycaster.setFromCamera(new THREE.Vector2(screenX, screenY), camera);
    const intersects = this.raycaster.intersectObjects(meshes, true);

    console.log('[RAYCAST MESH]', {
      ndc: { x: Number(screenX.toFixed(4)), y: Number(screenY.toFixed(4)) },
      meshCount: meshes.length,
      hits: intersects.length,
      cameraPos: { x: Number(camera.position.x.toFixed(4)), y: Number(camera.position.y.toFixed(4)), z: Number(camera.position.z.toFixed(4)) },
    });

    for (const intersect of intersects) {
      let current: THREE.Object3D | null = intersect.object;
      while (current) {
        if (current.userData && typeof current.userData.id === 'string' && current.userData.id) {
          console.log('[RAYCAST MESH] HIT', {
            meshName: intersect.object.name,
            meshUuid: intersect.object.uuid,
            resolvedName: current.name,
            resolvedUUID: current.userData.id,
            distance: Number(intersect.distance.toFixed(4)),
          });
          return current;
        }
        current = current.parent;
      }
    }

    if (intersects.length > 0) {
      console.log('[RAYCAST RESULT]', {
        hit: true,
        hitName: intersects[0].object.name,
        hitUUID: intersects[0].object.uuid,
        resolvedName: null,
        resolvedUUID: null,
      });
    } else {
      console.log('[RAYCAST RESULT]', {
        hit: false,
        hitName: null,
        hitUUID: null,
        resolvedName: null,
        resolvedUUID: null,
      });
    }

    console.log('[RAYCAST MESH] RESULT null');
    return null;
  }

  getVisibleObjects(): string[] {
    return Array.from(this.objectData.keys());
  }
}

export default ScreenToWorldRay;

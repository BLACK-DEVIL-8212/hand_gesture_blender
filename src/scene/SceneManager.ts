import type { SceneGraph, SceneObject } from './types';
import { ObjectManager } from './ObjectManager';
import { SelectionManager } from './SelectionManager';
import { HistoryManager } from './HistoryManager';
import { EVENTS } from '../core/Configuration';
import type EventBus from '../core/EventBus';
import logger from '../core/Logger';

export class SceneManager {
  private objectManager: ObjectManager;
  private selectionManager: SelectionManager;
  private historyManager: HistoryManager;
  private eventBus: EventBus;
  private sceneName: string;
  private cameraId: string | null = null;
  private _primaryLightId: string | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.objectManager = new ObjectManager();
    this.selectionManager = new SelectionManager(this.objectManager, eventBus);
    this.historyManager = new HistoryManager({
      objectManager: this.objectManager,
      selectionManager: this.selectionManager,
      sceneManager: this,
      cameraController: null,
    }, eventBus);

    this.sceneName = 'Scene';
    void this._primaryLightId;
  }

  getObjectManager(): ObjectManager {
    return this.objectManager;
  }

  getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  getHistoryManager(): HistoryManager {
    return this.historyManager;
  }

  private async createDefaultScene(): Promise<void> {
    const cube = this.objectManager.createObject('cube', {
      name: 'Cube',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    
    const sphere = this.objectManager.createObject('sphere', {
      name: 'Sphere',
      transform: {
        position: { x: 2.5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    
    const plane = this.objectManager.createObject('plane', {
      name: 'Ground',
      transform: {
        position: { x: 0, y: -1, z: 0 },
        rotation: { x: -Math.PI / 2, y: 0, z: 0 },
        scale: { x: 20, y: 20, z: 1 },
      },
    });
    plane.receiveShadow = true;
    plane.castShadow = false;
    
    const cameraObj = this.objectManager.createObject('camera', {
      name: 'Camera',
      transform: {
        position: { x: 10, y: 7, z: 10 },
        rotation: { x: -Math.PI / 6, y: -Math.PI / 6, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    this.cameraId = cameraObj.id;
    
    const lightObj = this.objectManager.createObject('light', {
      name: 'Sun',
      transform: {
        position: { x: 5, y: 10, z: 5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    this._primaryLightId = lightObj.id;
    
    this.eventBus.emit(EVENTS.SCENE.OBJECT_ADDED, { objects: [cube, sphere, plane, cameraObj, lightObj] });
  }

  getSceneName(): string {
    return this.sceneName;
  }

  setSceneName(name: string): void {
    this.sceneName = name;
  }

  getCameraId(): string | null {
    return this.cameraId;
  }

  getSceneData(): SceneGraph {
    return this.objectManager.toJSON();
  }

  loadSceneData(data: SceneGraph): void {
    this.objectManager.fromJSON(data);
    this.selectionManager.clearSelection();
    this.historyManager.clear();
    this.eventBus.emit(EVENTS.SCENE.SCENE_CHANGED, { source: 'load' });
    logger.info('Scene loaded');
  }

  clearScene(): void {
    this.objectManager.clear();
    this.selectionManager.clearSelection();
    this.historyManager.clear();
    this.eventBus.emit(EVENTS.SCENE.SCENE_CHANGED, { source: 'clear' });
  }

  async createNewScene(): Promise<void> {
    this.clearScene();
    await this.createDefaultScene();
    this.historyManager.clear();
    this.eventBus.emit(EVENTS.SCENE.SCENE_CHANGED, { source: 'new' });
    logger.info('New scene created');
  }

  getStats(): { objectCount: number; selectedCount: number; lightCount: number; cameraCount: number } {
    const objects = this.objectManager.getAllObjects();
    return {
      objectCount: objects.length,
      selectedCount: this.selectionManager.getSelectedIds().length,
      lightCount: objects.filter(o => o.type === 'light').length,
      cameraCount: objects.filter(o => o.type === 'camera').length,
    };
  }

  getObject(id: string): SceneObject | undefined {
    return this.objectManager.getObject(id);
  }

  getAllObjects(): SceneObject[] {
    return this.objectManager.getAllObjects();
  }

  selectObject(id: string): boolean {
    return this.selectionManager.select(id);
  }

  deselectObject(id: string): boolean {
    return this.selectionManager.deselect(id);
  }

  clearSelection(): void {
    this.selectionManager.clearSelection();
  }

  getSelectedObjects(): SceneObject[] {
    return this.selectionManager.getSelected();
  }

  getPrimarySelected(): SceneObject | null {
    return this.selectionManager.getPrimarySelected();
  }

  undo(): boolean {
    return this.historyManager.undo();
  }

  redo(): boolean {
    return this.historyManager.redo();
  }

  canUndo(): boolean {
    return this.historyManager.canUndo();
  }

  canRedo(): boolean {
    return this.historyManager.canRedo();
  }
}

export default SceneManager;

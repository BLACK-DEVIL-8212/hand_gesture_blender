import type { SceneObject } from './types';
import { ObjectManager } from './ObjectManager';
import { EVENTS } from '../core/Configuration';
import type EventBus from '../core/EventBus';
import logger from '../core/Logger';

export class SelectionManager {
  private selectedIds: Set<string> = new Set();
  private hoverId: string | null = null;
  private objectManager: ObjectManager;
  private eventBus: EventBus;

  constructor(objectManager: ObjectManager, eventBus: EventBus) {
    this.objectManager = objectManager;
    this.eventBus = eventBus;
  }

  select(id: string): boolean {
    const obj = this.objectManager.getObject(id);
    if (!obj || !obj.visible) return false;
    
    this.selectedIds.add(id);
    this.eventBus.emit(EVENTS.SCENE.OBJECT_SELECTED, { id, object: obj });
    logger.debug(`Selected: ${obj.name}`);
    return true;
  }

  deselect(id: string): boolean {
    if (this.selectedIds.delete(id)) {
      const obj = this.objectManager.getObject(id);
      this.eventBus.emit(EVENTS.SCENE.OBJECT_DESELECTED, { id, object: obj });
      logger.debug(`Deselected: ${obj?.name || id}`);
      return true;
    }
    return false;
  }

  clear(): void {
    this.clearSelection();
    this.hoverId = null;
  }

  clearSelection(): void {
    const previous = [...this.selectedIds];
    this.selectedIds.clear();
    for (const id of previous) {
      const obj = this.objectManager.getObject(id);
      this.eventBus.emit(EVENTS.SCENE.OBJECT_DESELECTED, { id, object: obj });
    }
  }

  multiSelect(ids: string[]): void {
    this.clearSelection();
    for (const id of ids) {
      if (this.objectManager.getObject(id)) {
        this.selectedIds.add(id);
      }
    }
    this.eventBus.emit(EVENTS.SCENE.OBJECT_SELECTED, { ids, objects: ids.map(id => this.objectManager.getObject(id)) });
  }

  getSelected(): SceneObject[] {
    return [...this.selectedIds]
      .map(id => this.objectManager.getObject(id))
      .filter((obj): obj is SceneObject => obj !== undefined);
  }

  getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  getPrimarySelected(): SceneObject | null {
    const objects = this.getSelected();
    return objects.length > 0 ? objects[0] : null;
  }

  getPrimarySelectedId(): string | null {
    const ids = this.getSelectedIds();
    return ids.length > 0 ? ids[0] : null;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  setHover(id: string | null): void {
    if (this.hoverId !== id) {
      if (this.hoverId) {
        this.eventBus.emit(EVENTS.INTERACTION.HOVER_END, { id: this.hoverId });
      }
      this.hoverId = id;
      if (id) {
        this.eventBus.emit(EVENTS.INTERACTION.HOVER_START, { id });
      }
    }
  }

  getHoverId(): string | null {
    return this.hoverId;
  }

  toggle(id: string): void {
    if (this.selectedIds.has(id)) {
      this.deselect(id);
    } else {
      this.select(id);
    }
  }

  selectNext(): void {
    const allObjects = this.objectManager.getAllObjects();
    if (allObjects.length === 0) return;
    
    const currentId = this.getPrimarySelectedId();
    const currentIndex = currentId
      ? allObjects.findIndex(o => o.id === currentId)
      : -1;
    const nextIndex = (currentIndex + 1) % allObjects.length;
    
    this.clearSelection();
    this.select(allObjects[nextIndex].id);
  }

  selectPrev(): void {
    const allObjects = this.objectManager.getAllObjects();
    if (allObjects.length === 0) return;
    
    const currentId = this.getPrimarySelectedId();
    const currentIndex = currentId
      ? allObjects.findIndex(o => o.id === currentId)
      : -1;
    const prevIndex = currentIndex <= 0 
      ? allObjects.length - 1 
      : currentIndex - 1;
    
    this.clearSelection();
    this.select(allObjects[prevIndex].id);
  }
}

export default SelectionManager;

import type { SceneObject } from '../scene/types';
import type EventBus from '../core/EventBus';
import { ObjectManager } from '../scene/ObjectManager';

export class SelectionController {
  private objectManager: ObjectManager;
  private selectedIds: Set<string> = new Set();
  private hoverId: string | null = null;

  constructor(objectManager: ObjectManager, eventBus: EventBus) {
    void eventBus;
    this.objectManager = objectManager;
  }

  getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  getSelected(): SceneObject[] {
    return [...this.selectedIds]
      .map((id) => this.objectManager.getObject(id))
      .filter((obj): obj is SceneObject => obj !== undefined);
  }

  getPrimarySelectedId(): string | null {
    const ids = [...this.selectedIds];
    return ids.length > 0 ? ids[0] : null;
  }

  getHoverId(): string | null {
    return this.hoverId;
  }

  select(id: string, multi: boolean = false): void {
    if (multi) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.clear();
      this.selectedIds.add(id);
    }
  }

  deselect(id: string): void {
    this.selectedIds.delete(id);
  }

  clear(): void {
    this.selectedIds.clear();
    this.hoverId = null;
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  setHover(id: string | null): void {
    this.hoverId = id;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  toggle(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }
}

export default SelectionController;

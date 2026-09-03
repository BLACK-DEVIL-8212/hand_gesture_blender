import { EVENTS } from '../core/Configuration';
import type EventBus from '../core/EventBus';
import logger from '../core/Logger';

export type CommandType =
  | 'CREATE_OBJECT'
  | 'DELETE_OBJECT'
  | 'DUPLICATE_OBJECT'
  | 'SET_TRANSFORM'
  | 'SET_NAME'
  | 'SET_MATERIAL'
  | 'SET_VISIBILITY'
  | 'SET_LOCKED'
  | 'SET_PARENT'
  | 'GROUP_OBJECTS'
  | 'UNGROUP_OBJECTS'
  | 'CAMERA_MOVE'
  | 'CAMERA_FOCUS'
  | 'EXPORT';

export interface CommandContext {
  objectManager: any;
  selectionManager: any;
  sceneManager: any;
  cameraController: any;
  [key: string]: unknown;
}

export interface Command {
  id: string;
  type: CommandType;
  description: string;
  timestamp: number;
  execute(context: CommandContext): void;
  undo(context: CommandContext): void;
  merge?(other: Command): boolean;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoStackDepth: number;
  redoStackDepth: number;
  lastCommandType: CommandType | null;
}

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 100;
  private context: CommandContext;
  private eventBus: EventBus;
  private lastCommandTimestamp = 0;
  private mergeableThreshold = 300;

  constructor(context: CommandContext, eventBus: EventBus) {
    this.context = context;
    this.eventBus = eventBus;
  }

  execute(command: Command): void {
    command.execute(this.context);
    
    const lastCommand = this.undoStack[this.undoStack.length - 1];
    if (
      lastCommand &&
      lastCommand.merge &&
      command.type === lastCommand.type &&
      Date.now() - this.lastCommandTimestamp < this.mergeableThreshold
    ) {
      lastCommand.merge(command);
      this.lastCommandTimestamp = Date.now();
    } else {
      this.undoStack.push(command);
      this.lastCommandTimestamp = Date.now();
    }
    
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    
    this.redoStack = [];
    this.emitChange();
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    
    command.undo(this.context);
    this.redoStack.push(command);
    
    if (this.redoStack.length > this.maxHistory) {
      this.redoStack.shift();
    }
    
    this.emitChange();
    logger.debug(`Undo: ${command.description}`);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    
    command.execute(this.context);
    this.undoStack.push(command);
    
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    
    this.emitChange();
    logger.debug(`Redo: ${command.description}`);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emitChange();
  }

  getState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackDepth: this.undoStack.length,
      redoStackDepth: this.redoStack.length,
      lastCommandType: this.undoStack.length > 0 
        ? this.undoStack[this.undoStack.length - 1].type 
        : null,
    };
  }

  private emitChange(): void {
    this.eventBus.emit(EVENTS.UNDO_REDO.HISTORY_CHANGED, this.getState());
  }

  setMaxHistory(max: number): void {
    this.maxHistory = max;
  }
}

export function createCommand(config: {
  id?: string;
  type: CommandType;
  description: string;
  execute: (context: CommandContext) => void;
  undo: (context: CommandContext) => void;
  merge?: (other: Command) => boolean;
}): Command {
  return {
    id: config.id || 'cmd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
    type: config.type,
    description: config.description,
    timestamp: Date.now(),
    execute: config.execute,
    undo: config.undo,
    merge: config.merge,
  };
}

export default HistoryManager;

import type { GestureRecognition, GestureStateType, GestureType, Hand } from './types';
import logger from '../core/Logger';

export type InteractionMode =
  | 'SELECT'
  | 'MOVE'
  | 'ROTATE'
  | 'SCALE'
  | 'CREATE'
  | 'CAMERA'
  | 'EDIT'
  | 'SCULPT'
  | 'CUT'
  | 'BOOLEAN';

export interface GestureState {
  state: GestureStateType;
  stableState: GestureStateType;
  gesture: GestureType;
  confidence: number;
  stableFrames: number;
  mode: InteractionMode;
  selectedObjectId: string | null;
  transforming: boolean;
  transformType: 'move' | 'rotate' | 'scale' | null;
  axisLock: 'x' | 'y' | 'z' | null;
  timestamp: number;
}

const TRANSITIONS: Record<GestureStateType, GestureStateType[]> = {
  IDLE: ['HAND_DETECTED', 'POINTING', 'IDLE'],
  HAND_DETECTED: ['POINTING', 'HOVERING_OBJECT', 'PINCH_START', 'IDLE'],
  POINTING: ['HOVERING_OBJECT', 'PINCH_START', 'IDLE', 'POINTING'],
  HOVERING_OBJECT: ['PINCH_START', 'POINTING', 'IDLE'],
  PINCH_START: ['PINCH_HOLD', 'PINCH_RELEASE', 'IDLE'],
  PINCH_HOLD: ['TRANSFORMING', 'PINCH_RELEASE', 'IDLE', 'POINTING', 'HOVERING_OBJECT'],
  TRANSFORMING: ['PINCH_RELEASE', 'IDLE', 'POINTING', 'HOVERING_OBJECT'],
  PINCH_RELEASE: ['SELECTED', 'IDLE', 'POINTING', 'HOVERING_OBJECT'],
  SELECTED: ['IDLE', 'POINTING', 'PINCH_START', 'TRANSFORMING'],
};

export class GestureStateMachine {
  private state: GestureRecognition;
  private currentState: GestureStateType = 'IDLE';
  private stableState: GestureStateType = 'IDLE';
  private hysteresisCounter = 0;
  private stableFrameCount = 0;
  private mode: InteractionMode = 'SELECT';
  private modeLock = false;
  private selectedObjectId: string | null = null;
  private transforming = false;
  private transformType: 'move' | 'rotate' | 'scale' | null = null;
  private axisLock: 'x' | 'y' | 'z' | null = null;
  private pinchStartData: { position: { x: number; y: number; z: number }; time: number } | null = null;
  private debug = false;

  constructor() {
    this.state = this.createIdleState();
  }

  private createIdleState(): GestureRecognition {
    return {
      type: 'IDLE',
      confidence: 0,
      state: 'IDLE',
      stableFrames: 0,
      timestamp: Date.now(),
    };
  }

  update(gesture: GestureRecognition): GestureState {
    const prevState = this.currentState;
    
    if (!this.isValidTransition(this.currentState, gesture)) {
      return this.getSnapshot();
    }
    
    if (this.shouldApplyHysteresis(gesture, prevState)) {
      this.hysteresisCounter++;
      if (this.hysteresisCounter < 3) {
        return this.getSnapshot();
      }
    } else {
      this.hysteresisCounter = 0;
    }
    
    const newState = gesture.state;
    this.currentState = newState;
    
    if (newState !== prevState) {
      logger.debug(`Gesture state transition: ${prevState} → ${newState}`, gesture);
      
      if (newState === 'PINCH_START') {
        this.onPinchStart();
      } else if (newState === 'PINCH_RELEASE') {
        this.onPinchRelease();
      } else if (newState === 'PINCH_HOLD') {
        this.transforming = true;
        this.determineTransformType();
      }
    }
    
    this.stableState = newState;
    this.state = gesture;
    this.stableFrameCount++;
    
    return this.getSnapshot();
  }

  private isValidTransition(current: GestureStateType, gesture: GestureRecognition): boolean {
    const allowed = TRANSITIONS[current] || [];
    const target = gesture.state;
    
    if (allowed.includes(target)) return true;
    
    if (this.stableFrameCount < 2) return false;
    
    return allowed.includes(target);
  }

  private shouldApplyHysteresis(gesture: GestureRecognition, prev: GestureStateType): boolean {
    if (gesture.state === prev) return false;
    if (this.hysteresisCounter > 0) return true;
    return gesture.confidence < 0.8;
  }

  private onPinchStart(): void {
    this.pinchStartData = {
      position: { x: 0, y: 0, z: 0 },
      time: Date.now(),
    };
    this.hysteresisCounter = 0;
  }

  private onPinchRelease(): void {
    this.pinchStartData = null;
    this.transforming = false;
    this.transformType = null;
  }

  private determineTransformType(): void {
    if (this.mode === 'SCALE' || (this.state.type === 'TWO_HAND_SCALE')) {
      this.transformType = 'scale';
    } else if (this.mode === 'ROTATE') {
      this.transformType = 'rotate';
    } else if (this.mode === 'MOVE' || this.state.state === 'PINCH_HOLD') {
      this.transformType = 'move';
    }
  }

  setMode(mode: InteractionMode): void {
    this.mode = mode;
    this.axisLock = null;
    this.transforming = false;
    this.transformType = null;
    logger.debug(`Mode changed to: ${mode}`);
  }

  getMode(): InteractionMode {
    return this.mode;
  }

  setAxisLock(axis: 'x' | 'y' | 'z' | null): void {
    this.axisLock = axis;
    logger.debug(`Axis lock set to: ${axis}`);
  }

  getAxisLock(): 'x' | 'y' | 'z' | null {
    return this.axisLock;
  }

  setSelectedObjectId(id: string | null): void {
    this.selectedObjectId = id;
  }

  getSelectedObjectId(): string | null {
    return this.selectedObjectId;
  }

  isTransforming(): boolean {
    return this.transforming;
  }

  getTransformType(): 'move' | 'rotate' | 'scale' | null {
    return this.transformType;
  }

  isPinching(): boolean {
    return this.currentState === 'PINCH_HOLD' || this.currentState === 'TRANSFORMING';
  }

  isPointing(): boolean {
    return this.currentState === 'POINTING' || this.currentState === 'HOVERING_OBJECT';
  }

  getPinchStartData(): { position: { x: number; y: number; z: number }; time: number } | null {
    return this.pinchStartData;
  }

  reset(): void {
    this.currentState = 'IDLE';
    this.stableState = 'IDLE';
    this.hysteresisCounter = 0;
    this.stableFrameCount = 0;
    this.transforming = false;
    this.transformType = null;
    this.pinchStartData = null;
    this.state = this.createIdleState();
  }

  private getSnapshot(): GestureState {
    return {
      state: this.currentState,
      stableState: this.stableState,
      gesture: this.state.type,
      confidence: this.state.confidence,
      stableFrames: this.stableFrameCount,
      mode: this.mode,
      selectedObjectId: this.selectedObjectId,
      transforming: this.transforming,
      transformType: this.transformType,
      axisLock: this.axisLock,
      timestamp: Date.now(),
    };
  }
}

export default GestureStateMachine;

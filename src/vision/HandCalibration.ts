import type { CalibrationData } from './types';
import { DEFAULT_SETTINGS } from '../core/Settings';
import logger from '../core/Logger';

export interface CalibrationStep {
  id: string;
  name: string;
  instruction: string;
  requiredHand: 'Left' | 'Right' | 'Both' | 'Either';
  duration: number;
  action: (engine: any) => CalibrationData | null;
}

export class HandCalibration {
  private calibration: CalibrationData | null = null;
  private steps: CalibrationStep[] = [];
  
  constructor() {
    this.loadCalibration();
    this.setupSteps();
  }

  private setupSteps(): void {
    this.steps = [
      {
        id: 'right_hand',
        name: 'Right Hand',
        instruction: 'Show your right hand to the camera, fully extended',
        requiredHand: 'Right',
        duration: 2000,
        action: () => null,
      },
      {
        id: 'left_hand',
        name: 'Left Hand',
        instruction: 'Show your left hand to the camera, fully extended',
        requiredHand: 'Left',
        duration: 2000,
        action: () => null,
      },
      {
        id: 'open_palm',
        name: 'Open Palm',
        instruction: 'Show an open palm facing the camera',
        requiredHand: 'Either',
        duration: 1500,
        action: () => null,
      },
      {
        id: 'point',
        name: 'Point',
        instruction: 'Point with your index finger',
        requiredHand: 'Either',
        duration: 1500,
        action: () => null,
      },
      {
        id: 'pinch',
        name: 'Pinch',
        instruction: 'Pinch your thumb and index finger together',
        requiredHand: 'Either',
        duration: 1500,
        action: () => null,
      },
      {
        id: 'move_horizontal',
        name: 'Move Hand',
        instruction: 'Slowly move your hand left and right',
        requiredHand: 'Either',
        duration: 3000,
        action: () => null,
      },
      {
        id: 'rotate_wrist',
        name: 'Rotate Wrist',
        instruction: 'Rotate your wrist 360 degrees',
        requiredHand: 'Either',
        duration: 3000,
        action: () => null,
      },
      {
        id: 'hands_apart',
        name: 'Hands Movement',
        instruction: 'Move your hands apart and then together',
        requiredHand: 'Both',
        duration: 3000,
        action: () => null,
      },
    ];
  }

  getSteps(): CalibrationStep[] {
    return [...this.steps];
  }

  getStep(id: string): CalibrationStep | undefined {
    return this.steps.find(s => s.id === id);
  }

  createDefaultCalibration(): CalibrationData {
    const settings = DEFAULT_SETTINGS;
    return {
      handedness: 'unknown',
      handSize: 80,
      pinchThreshold: settings.gesture.pinchThreshold,
      grabThreshold: settings.gesture.grabThreshold,
      movementSensitivity: settings.interaction.moveSpeed,
      rotationSensitivity: settings.gesture.rotationSensitivity,
      depthSensitivity: settings.interaction.interactionPlaneDistance,
      swipeThreshold: settings.gesture.swipeThreshold,
      createdAt: Date.now(),
    };
  }

  calibrateFromHandSize(handSize: number): CalibrationData {
    const base = this.createDefaultCalibration();
    const normalized = handSize / 80;
    
    return {
      ...base,
      handSize,
      pinchThreshold: Math.max(20, Math.min(80, 40 * normalized)),
      grabThreshold: Math.max(30, Math.min(120, 60 * normalized)),
      depthSensitivity: Math.max(20, Math.min(80, 40 * normalized)),
      swipeThreshold: Math.max(30, Math.min(100, 50 * normalized)),
    };
  }

  saveCalibration(data: CalibrationData): void {
    this.calibration = data;
    try {
      localStorage.setItem('handcontrol-calibration', JSON.stringify(data));
      logger.info('Calibration saved');
    } catch (e) {
      logger.error('Failed to save calibration', e);
    }
  }

  loadCalibration(): void {
    try {
      const stored = localStorage.getItem('handcontrol-calibration');
      if (stored) {
        this.calibration = JSON.parse(stored) as CalibrationData;
        logger.info('Calibration loaded');
      }
    } catch (e) {
      logger.error('Failed to load calibration', e);
    }
  }

  getCalibration(): CalibrationData | null {
    return this.calibration;
  }

  resetCalibration(): void {
    this.calibration = null;
    localStorage.removeItem('handcontrol-calibration');
    logger.info('Calibration reset');
  }

  hasCalibration(): boolean {
    return this.calibration !== null;
  }
}

export default HandCalibration;

import type { CalibrationData } from '../vision/types';

export interface CameraSettings {
  enabled: boolean;
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
  frameRate: number;
}

export interface TrackingSettings {
  smoothing: 'exponential' | 'one-euro' | 'kalman';
  smoothingFactor: number;
  minConfidence: number;
  stabilizationFrames: number;
  maxHands: number;
}

export interface GestureSettings {
  pinchThreshold: number;
  grabThreshold: number;
  stabilityFrames: number;
  hysteresisFrames: number;
  swipeThreshold: number;
  rotationSensitivity: number;
  scaleSpeed: number;
  doubleTapThreshold: number;
}

export interface InteractionSettings {
  interactionPlaneDistance: number;
  moveSpeed: number;
  rotateSpeed: number;
  scaleSpeed: number;
  cursorSize: number;
  snapEnabled: boolean;
  snapInterval: number;
  axisConstraint: boolean;
}

export interface RenderingSettings {
  backgroundColor: string;
  gridVisible: boolean;
  axesVisible: boolean;
  shadowsEnabled: boolean;
  wireframeMode: boolean;
  fogEnabled: boolean;
  antialias: boolean;
  pixelRatio: number;
}

export interface EditorSettings {
  debugMode: boolean;
  language: string;
  theme: 'light' | 'dark';
  fontSize: number;
  showCameraPreview: boolean;
  showHandSkeleton: boolean;
}

export interface Settings {
  camera: CameraSettings;
  tracking: TrackingSettings;
  gesture: GestureSettings;
  interaction: InteractionSettings;
  rendering: RenderingSettings;
  editor: EditorSettings;
  calibration: CalibrationData | null;
}

export const DEFAULT_SETTINGS: Settings = {
  camera: {
    enabled: true,
    width: 640,
    height: 480,
    facingMode: 'user',
    frameRate: 30,
  },
  tracking: {
    smoothing: 'one-euro',
    smoothingFactor: 0.3,
    minConfidence: 0.7,
    stabilizationFrames: 5,
    maxHands: 2,
  },
  gesture: {
    pinchThreshold: 40,
    grabThreshold: 60,
    stabilityFrames: 3,
    hysteresisFrames: 5,
    swipeThreshold: 50,
    rotationSensitivity: 1.0,
    scaleSpeed: 0.01,
    doubleTapThreshold: 300,
  },
  interaction: {
    interactionPlaneDistance: 40,
    moveSpeed: 1.0,
    rotateSpeed: 1.0,
    scaleSpeed: 1.0,
    cursorSize: 24,
    snapEnabled: false,
    snapInterval: 0.5,
    axisConstraint: true,
  },
  rendering: {
    backgroundColor: '#1a1a2e',
    gridVisible: true,
    axesVisible: true,
    shadowsEnabled: true,
    wireframeMode: false,
    fogEnabled: false,
    antialias: true,
    pixelRatio: 1,
  },
  editor: {
    debugMode: false,
    language: 'en',
    theme: 'dark',
    fontSize: 14,
    showCameraPreview: true,
    showHandSkeleton: true,
  },
  calibration: null,
};

class SettingsStore {
  private static instance: SettingsStore;
  private settings: Settings = { ...DEFAULT_SETTINGS };

  static getInstance(): SettingsStore {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }
    return SettingsStore.instance;
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }

  getAll(): Settings {
    return { ...this.settings };
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  update(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.save();
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }

  save(): void {
    try {
      localStorage.setItem('handcontrol-settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings', e);
    }
  }

  load(): void {
    try {
      const stored = localStorage.getItem('handcontrol-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
  }
}

const settingsStore = SettingsStore.getInstance();
settingsStore.load();
export default settingsStore;

import type { Hand, HandState, NormalizedLandmark } from './types';
import { InputDeviceInterface } from '../interaction/InputDeviceInterface';
import { LandmarkProcessor } from './LandmarkProcessor';
import logger from '../core/Logger';

declare const window: any;

type MediaPipeHandsCtor = new (config: any) => any;

async function loadHandsCtor(): Promise<MediaPipeHandsCtor | null> {
  if (typeof window.Hands !== 'undefined') {
    return window.Hands;
  }

  try {
    await loadScript('/wasm/hands.js');
  } catch (e) {
    void e;
  }

  if (typeof window.Hands !== 'undefined') {
    return window.Hands;
  }

  return null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export interface HandTrackingConfig {
  maxHands: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  modelComplexity: 1;
  smoothingMethod: 'exponential' | 'one-euro' | 'kalman';
  smoothingFactor: number;
}

export class HandTrackingEngine implements InputDeviceInterface {
  private config: HandTrackingConfig;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private processor: LandmarkProcessor;
  private prevLandmarks: Map<string, NormalizedLandmark[]> = new Map();
  private handState: HandState = this.emptyState();
  private running = false;
  private frameCallbacks: Set<(state: HandState) => void> = new Set();
  private animationFrameId: number | null = null;
  private handsInstance: any = null;
  private handsResults: any = null;
  private onResultsCallback: ((results: any) => void) | null = null;
  private frameCount = 0;
  private lastProcessTime = 0;
  private fpsHistory: number[] = [];
  private currentFPS = 0;
  private debug = false;
  private trackerState: 'IDLE' | 'INITIALIZING' | 'READY' | 'TRACKING' | 'ERROR' | 'STOPPED' = 'IDLE';
  private initError: string | null = null;

  constructor(config: Partial<HandTrackingConfig> = {}) {
    this.config = {
      maxHands: 2,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
      modelComplexity: 1,
      smoothingMethod: 'one-euro',
      smoothingFactor: 0.5,
      ...config,
    };
    this.processor = new LandmarkProcessor();
  }

  private emptyState(): HandState {
    return {
      hands: [],
      handCount: 0,
      leftHand: null,
      rightHand: null,
      hasTwoHands: false,
      timestamp: 0,
      confidence: 0,
      tracked: false,
    };
  }

   async initialize(): Promise<void> {
    if (this.trackerState !== 'IDLE') return;
    this.trackerState = 'INITIALIZING';
    logger.info('HandTrackingEngine: Initializing...');
    
    try {
      await this.loadMediaPipe();
    } catch (e) {
      this.trackerState = 'ERROR';
      this.initError = e instanceof Error ? e.message : String(e);
      logger.error('HandTrackingEngine: Initialization failed', e);
      throw e;
    }
    
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    this.video.playsInline = true;
    document.body.appendChild(this.video);
    
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    document.body.appendChild(this.canvas);
    
    logger.info('HandTrackingEngine: Initialized successfully');
    this.trackerState = 'READY';
  }

  private async loadMediaPipe(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('MediaPipe requires a browser environment');
    }

    const HandsRef = await loadHandsCtor() || window.Hands;

    if (HandsRef) {
      this.handsInstance = new HandsRef({
        locateFile: (file: string) => {
          return `/wasm/${file}`;
        },
      });
      
      this.handsInstance.setOptions({
        maxNumHands: this.config.maxHands,
        modelComplexity: this.config.modelComplexity,
        min_detection_confidence: this.config.minDetectionConfidence,
        min_tracking_confidence: this.config.minTrackingConfidence,
      });
      
      this.onResultsCallback = (results: any) => {
        this.handsResults = results;
        this.processResults(results);
      };
      
      this.handsInstance.onResults(this.onResultsCallback);
    } else {
      logger.error('MediaPipe Hands not available');
      throw new Error('MediaPipe Hands library could not be loaded');
    }
  }

  async canAccessCamera(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      return videoDevices.length > 0;
    } catch (e) {
      logger.error('Cannot access camera devices', e);
      return false;
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    if (this.trackerState === 'ERROR') {
      throw new Error(this.initError || 'Hand tracking initialization failed');
    }
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.maxHands > 0 ? 640 : 320 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      
      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }
      
      this.running = true;
      this.trackerState = 'TRACKING';
      logger.info('HandTrackingEngine: Started');
      
      setTimeout(() => {
        this.startProcessing();
      }, 100);
    } catch (e) {
      logger.error('Failed to start camera', e);
      this.trackerState = 'ERROR';
      this.initError = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  private startProcessing(): void {
    if (!this.running) return;
    this.processFrame();
  }

  private async processFrame(): Promise<void> {
    if (!this.running || !this.video || !this.canvas || !this.handsInstance) {
      return;
    }
    
    const now = performance.now();
    const dt = now - this.lastProcessTime;
    if (dt < 1000 / 30) {
      this.animationFrameId = requestAnimationFrame(() => this.processFrame());
      return;
    }
    this.lastProcessTime = now;
    
    this.frameCount++;
    
    if (this.frameCount % 30 === 0 && this.fpsHistory.length > 0) {
      const avg = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      this.currentFPS = Math.round(avg);
      this.fpsHistory = [];
    }
    if (this.fpsHistory.length > 10) this.fpsHistory.shift();
    if (dt > 0) this.fpsHistory.push(1000 / dt);
    
    try {
      const videoWidth = this.video.videoWidth;
      const videoHeight = this.video.videoHeight;
      
      if (videoWidth === 0 || videoHeight === 0) {
        this.animationFrameId = requestAnimationFrame(() => this.processFrame());
        return;
      }
      
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
      
      if (this.ctx) {
        this.ctx.save();
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.video, -videoWidth, 0, videoWidth, videoHeight);
        this.ctx.restore();
      } else {
        this.ctx = this.canvas.getContext('2d');
        if (this.ctx) {
          this.ctx.save();
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(this.video, -videoWidth, 0, videoWidth, videoHeight);
          this.ctx.restore();
        }
      }
      
      await this.handsInstance.send({ image: this.canvas });
      
      this.animationFrameId = requestAnimationFrame(() => this.processFrame());
    } catch (e) {
      logger.error('Error in processFrame', e);
      this.running = false;
      this.trackerState = 'ERROR';
      this.initError = e instanceof Error ? e.message : String(e);
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  }

  private processResults(results: any): void {
    const now = Date.now();
    const hands: Hand[] = [];
    const landmarksList = results.multiHandedness || [];
    const landmarks = results.multiHandLandmarks || [];
    
    for (let i = 0; i < landmarks.length; i++) {
      const rawLandmarks = landmarks[i];
      const handedness = landmarksList[i]?.label || 'Right';
      
      const handId = handedness === 'Left' ? 'left' : 'right';
      const prev = this.prevLandmarks.get(handId) || null;
      
      const hand = this.processor.buildHand(
        {
          landmarks: rawLandmarks,
          handedness,
          score: results.multiHandedness[i]?.score || 0.9,
        },
        prev,
        this.config.smoothingMethod,
        this.config.smoothingFactor,
        handedness as 'Left' | 'Right'
      );
      
      this.prevLandmarks.set(handId, hand.normalized);
      hands.push(hand);
    }
    
    this.handState = {
      hands,
      handCount: hands.length,
      leftHand: hands.find(h => h.handedness === 'Left') || null,
      rightHand: hands.find(h => h.handedness === 'Right') || null,
      hasTwoHands: hands.length >= 2,
      timestamp: now,
      confidence: hands.length > 0
        ? Math.max(...hands.map(h => h.confidence))
        : 0,
      tracked: hands.length > 0,
    };
    
    for (const cb of this.frameCallbacks) {
      cb(this.handState);
    }
  }

  onFrame(callback: (state: HandState) => void): () => void {
    this.frameCallbacks.add(callback);
    return () => {
      this.frameCallbacks.delete(callback);
    };
  }

  getHandState(): HandState {
    return this.handState;
  }

  getFrame(): ImageData | null {
    if (!this.canvas || !this.ctx) return null;
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    return imageData;
  }

  getFPS(): number {
    return this.currentFPS;
  }

  getCameraPreviewCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
  }

   async stop(): Promise<void> {
    this.running = false;
    this.trackerState = 'STOPPED';
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
      if (this.video.parentNode) {
        this.video.parentNode.removeChild(this.video);
      }
      this.video = null;
    }
    
    if (this.canvas) {
      if (this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.canvas = null;
      this.ctx = null;
    }
    
    if (this.handsInstance) {
      try {
        await this.handsInstance.close();
      } catch (e) {
        void e;
      }
      this.handsInstance = null;
    }
    
    this.handsResults = null;
    this.onResultsCallback = null;
    this.prevLandmarks.clear();
    this.frameCount = 0;
    this.fpsHistory = [];
    this.currentFPS = 0;
    
    this.handState = this.emptyState();
    logger.info('HandTrackingEngine: Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getTrackerState(): 'IDLE' | 'INITIALIZING' | 'READY' | 'TRACKING' | 'ERROR' | 'STOPPED' {
    return this.trackerState;
  }

  getInitError(): string | null {
    return this.initError;
  }
  dispose(): void {
    this.stop();
    this.frameCallbacks.clear();
  }
}

export default HandTrackingEngine;

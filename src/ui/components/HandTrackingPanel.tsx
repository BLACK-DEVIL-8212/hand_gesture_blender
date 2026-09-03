import React from 'react';
import type { InteractionMode } from '../../vision/GestureStateMachine';

interface HandTrackingPanelProps {
  cameraEnabled: boolean;
  cameraStatus: 'off' | 'starting' | 'active' | 'error';
  onToggleCamera: () => void;
  handCount: number;
  leftHandConfidence: number;
  rightHandConfidence: number;
  mode: InteractionMode;
  currentGesture: string;
  gestureConfidence: number;
}

export function HandTrackingPanel({
  cameraEnabled,
  cameraStatus,
  onToggleCamera,
  handCount,
  leftHandConfidence,
  rightHandConfidence,
  mode,
  currentGesture,
  gestureConfidence,
}: HandTrackingPanelProps) {
  const dotClass = `hand-tracking-panel__camera-dot--${cameraStatus}`;
  const confidencePercent = Math.round(gestureConfidence * 100);

  return (
    <div className="hand-tracking-panel">
      <div className="hand-tracking-panel__title">HAND TRACKING</div>
      <div className="hand-tracking-panel__row">
        <span>Camera</span>
        <span>
          <span className={`hand-tracking-panel__camera-dot ${dotClass}`}></span>
          {cameraStatus.toUpperCase()}
        </span>
      </div>
      <div className="hand-tracking-panel__row">
        <span>Left Hand</span>
        <span>{Math.round(leftHandConfidence * 100)}%</span>
      </div>
      <div className="hand-tracking-panel__row">
        <span>Right Hand</span>
        <span>{Math.round(rightHandConfidence * 100)}%</span>
      </div>
      <div className="hand-tracking-panel__row">
        <span>Gesture</span>
        <span style={{ color: '#00ff88' }}>{currentGesture} {confidencePercent}%</span>
      </div>
      <div className="hand-tracking-panel__row">
        <span>Mode</span>
        <span>{mode}</span>
      </div>
      <div className="hand-tracking-panel__row">
        <span>Tracking</span>
        <span style={{ color: leftHandConfidence > 0.3 || rightHandConfidence > 0.3 ? '#00ff88' : '#ff3366' }}>
          {leftHandConfidence > 0.3 || rightHandConfidence > 0.3 ? 'GOOD' : 'LOST'}
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        <button
          style={{
            width: '100%',
            padding: '6px',
            fontSize: '12px',
            background: cameraEnabled ? '#ff3366' : '#3366ff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={onToggleCamera}
        >
          {cameraEnabled ? 'Stop Tracking' : 'Start Tracking'}
        </button>
      </div>
    </div>
  );
}

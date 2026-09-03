import React from 'react';
import type { HandState, Hand } from '../../vision/types';
import './DebugOverlay.css';

interface TransformDebugInfo {
  handWorldPos?: { x: number; y: number; z: number };
  worldDelta?: { x: number; y: number; z: number };
  projectedDelta?: { x: number; y: number; z: number };
  activeAxis?: string;
  objectPosition?: { x: number; y: number; z: number };
  depth?: number;
  depthConfidence?: number;
}

interface PipelineDebug {
  cameraEnabled: boolean;
  cameraStatus: string;
  mediaPipeReady: boolean;
  landmarkCount: number;
  leftHandDetected: boolean;
  rightHandDetected: boolean;
  indexTip: { x: number; y: number; z: number } | null;
  thumbTip: { x: number; y: number; z: number } | null;
  palmCenter: { x: number; y: number; z: number } | null;
  pinchDistance: number;
  isPinching: boolean;
  gesture: string;
  gestureConfidence: number;
  gestureState: string;
  handWorldPos: { x: number; y: number; z: number } | null;
  rayActive: boolean;
  rayHitId: string | null;
  selectedObjectId: string | null;
  activeAxis: string;
  transformActive: boolean;
  transformMode: string;
  objectPosition: { x: number; y: number; z: number } | null;
  objectName: string | null;
  trackingFPS: number;
}

interface DebugOverlayProps {
  handState: HandState | null;
  gesture: string;
  gestureConfidence: number;
  mode: string;
  selectedIds: string[];
  handCount: number;
  leftHandConfidence: number;
  rightHandConfidence: number;
  fps: number;
  cameraStatus: string;
  axisLock: 'x' | 'y' | 'z' | null;
  transformDebugInfo?: TransformDebugInfo | null;
  pipelineDebug?: PipelineDebug | null;
}

export function DebugOverlay({
  handState,
  gesture,
  gestureConfidence,
  mode,
  selectedIds,
  handCount,
  leftHandConfidence,
  rightHandConfidence,
  fps,
  cameraStatus,
  axisLock,
  transformDebugInfo,
  pipelineDebug,
}: DebugOverlayProps) {
  const [expanded, setExpanded] = React.useState(true);

  if (!expanded) {
    return (
      <button className="debug-overlay__toggle" onClick={() => setExpanded(true)}>
        Debug
      </button>
    );
  }

  const primaryHand = handState?.hands.find((h: Hand) => h.handedness === 'Right') || handState?.hands[0];
  const indexTip = primaryHand?.landmarks[8];
  const thumbTip = primaryHand?.landmarks[4];

  const pd = pipelineDebug;

  return (
    <div className="debug-overlay">
      <div className="debug-overlay__header">
        <span>HAND PIPELINE</span>
        <button onClick={() => setExpanded(false)}>Hide</button>
      </div>
      <div className="debug-overlay__content">
        <div className="debug-overlay__section">
          <h4>Input</h4>
          <div className="debug-row">
            <span>Camera:</span>
            <span className={`debug-value ${pd?.cameraEnabled ? 'debug-ok' : 'debug-err'}`}>
              {pd?.cameraEnabled ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="debug-row">
            <span>MediaPipe:</span>
            <span className={`debug-value ${pd?.mediaPipeReady ? 'debug-ok' : 'debug-err'}`}>
              {pd?.mediaPipeReady ? 'READY' : 'NOT READY'}
            </span>
          </div>
          <div className="debug-row">
            <span>Landmarks:</span>
            <span className="debug-value">{pd?.landmarkCount || 0} / 21</span>
          </div>
          <div className="debug-row">
            <span>Left Hand:</span>
            <span className={`debug-value ${pd?.leftHandDetected ? 'debug-ok' : 'debug-err'}`}>
              {pd?.leftHandDetected ? 'DETECTED' : 'NONE'}
            </span>
          </div>
          <div className="debug-row">
            <span>Right Hand:</span>
            <span className={`debug-value ${pd?.rightHandDetected ? 'debug-ok' : 'debug-err'}`}>
              {pd?.rightHandDetected ? 'DETECTED' : 'NONE'}
            </span>
          </div>
        </div>

        <div className="debug-overlay__section">
          <h4>Landmarks</h4>
          <div className="debug-row">
            <span>Index Tip:</span>
            <span className="debug-value">
              {pd?.indexTip ? `X:${pd.indexTip.x.toFixed(3)} Y:${pd.indexTip.y.toFixed(3)} Z:${pd.indexTip.z.toFixed(3)}` : '—'}
            </span>
          </div>
          <div className="debug-row">
            <span>Thumb Tip:</span>
            <span className="debug-value">
              {pd?.thumbTip ? `X:${pd.thumbTip.x.toFixed(3)} Y:${pd.thumbTip.y.toFixed(3)} Z:${pd.thumbTip.z.toFixed(3)}` : '—'}
            </span>
          </div>
          <div className="debug-row">
            <span>Palm:</span>
            <span className="debug-value">
              {pd?.palmCenter ? `X:${pd.palmCenter.x.toFixed(3)} Y:${pd.palmCenter.y.toFixed(3)} Z:${pd.palmCenter.z.toFixed(3)}` : '—'}
            </span>
          </div>
        </div>

        <div className="debug-overlay__section">
          <h4>Gesture</h4>
          <div className="debug-row">
            <span>Pinch:</span>
            <span className={`debug-value ${pd?.isPinching ? 'debug-ok' : 'debug-err'}`}>
              {pd?.isPinching ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="debug-row">
            <span>Gesture:</span>
            <span className="debug-value">{pd?.gesture || gesture || 'NONE'}</span>
          </div>
          <div className="debug-row">
            <span>Confidence:</span>
            <span className="debug-value">{Math.round((pd?.gestureConfidence || 0) * 100)}%</span>
          </div>
          <div className="debug-row">
            <span>State:</span>
            <span className="debug-value">{pd?.gestureState || 'IDLE'}</span>
          </div>
        </div>

        <div className="debug-overlay__section">
          <h4>3D</h4>
          <div className="debug-row">
            <span>Hand World:</span>
            <span className="debug-value">
              {pd?.handWorldPos ? `X:${pd.handWorldPos.x.toFixed(2)} Y:${pd.handWorldPos.y.toFixed(2)} Z:${pd.handWorldPos.z.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className="debug-row">
            <span>Ray:</span>
            <span className={`debug-value ${pd?.rayActive ? 'debug-ok' : 'debug-err'}`}>
              {pd?.rayActive ? 'ACTIVE' : 'NONE'}
            </span>
          </div>
          <div className="debug-row">
            <span>Ray Hit:</span>
            <span className="debug-value">{pd?.rayHitId || 'None'}</span>
          </div>
          <div className="debug-row">
            <span>Selected:</span>
            <span className="debug-value">{pd?.selectedObjectId || 'None'}</span>
          </div>
          <div className="debug-row">
            <span>Active Axis:</span>
            <span className="debug-value">{pd?.activeAxis || 'NONE'}</span>
          </div>
          <div className="debug-row">
            <span>Transform:</span>
            <span className={`debug-value ${pd?.transformActive ? 'debug-ok' : 'debug-err'}`}>
              {pd?.transformActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <div className="debug-row">
            <span>Object Pos:</span>
            <span className="debug-value">
              {pd?.objectPosition ? `X:${pd.objectPosition.x.toFixed(2)} Y:${pd.objectPosition.y.toFixed(2)} Z:${pd.objectPosition.z.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>

        {transformDebugInfo && (
          <div className="debug-overlay__section">
            <h4>Transform Detail</h4>
            <div className="debug-row">
              <span>Active Axis:</span>
              <span className="debug-value">{transformDebugInfo.activeAxis || 'NONE'}</span>
            </div>
            {transformDebugInfo.depth !== undefined && (
              <div className="debug-row">
                <span>Depth:</span>
                <span className="debug-value">{transformDebugInfo.depth.toFixed(2)} ({transformDebugInfo.depthConfidence ? Math.round(transformDebugInfo.depthConfidence * 100) + '%' : 'N/A'})</span>
              </div>
            )}
            {transformDebugInfo.handWorldPos && (
              <div className="debug-row">
                <span>Hand World:</span>
                <span className="debug-value">
                  ({transformDebugInfo.handWorldPos.x.toFixed(3)}, {transformDebugInfo.handWorldPos.y.toFixed(3)}, {transformDebugInfo.handWorldPos.z.toFixed(3)})
                </span>
              </div>
            )}
            {transformDebugInfo.worldDelta && (
              <div className="debug-row">
                <span>World Delta:</span>
                <span className="debug-value">
                  ({transformDebugInfo.worldDelta.x.toFixed(3)}, {transformDebugInfo.worldDelta.y.toFixed(3)}, {transformDebugInfo.worldDelta.z.toFixed(3)})
                </span>
              </div>
            )}
            {transformDebugInfo.projectedDelta && (
              <div className="debug-row">
                <span>Projected:</span>
                <span className="debug-value">
                  ({transformDebugInfo.projectedDelta.x.toFixed(3)}, {transformDebugInfo.projectedDelta.y.toFixed(3)}, {transformDebugInfo.projectedDelta.z.toFixed(3)})
                </span>
              </div>
            )}
            {transformDebugInfo.objectPosition && (
              <div className="debug-row">
                <span>Object Pos:</span>
                <span className="debug-value">
                  ({transformDebugInfo.objectPosition.x.toFixed(3)}, {transformDebugInfo.objectPosition.y.toFixed(3)}, {transformDebugInfo.objectPosition.z.toFixed(3)})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

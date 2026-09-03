import React from 'react';
import { HandTrackingEngine } from '../../vision/HandTrackingEngine';
import './HandTrackingOverlay.css';

interface HandTrackingOverlayProps {
  cameraEnabled: boolean;
  cameraStatus: 'off' | 'starting' | 'active' | 'error';
  onToggleCamera: () => void;
  handTrackingEngine: HandTrackingEngine | null;
}

export function HandTrackingOverlay({
  cameraEnabled,
  cameraStatus,
  onToggleCamera,
  handTrackingEngine,
}: HandTrackingOverlayProps) {
  const [previewMode, setPreviewMode] = React.useState<'skeleton' | 'feed'>('skeleton');

  const handState = handTrackingEngine?.getHandState() || null;
  const fps = handTrackingEngine?.getFPS() || 0;
  const videoElement = handTrackingEngine?.getVideoElement() as HTMLVideoElement | null;

  const handCount = handState?.handCount || 0;
  const leftConf = handState?.leftHand?.confidence || 0;
  const rightConf = handState?.rightHand?.confidence || 0;

  return (
    <div className="hand-tracking-overlay">
      <div className="hand-tracking-overlay__controls">
        <button
          className={`hand-tracking-overlay__btn ${cameraEnabled ? 'active' : ''}`}
          onClick={onToggleCamera}
          title={cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
        >
          {cameraEnabled ? '📷' : '📷 Off'}
        </button>
        <button
          className={`hand-tracking-overlay__btn ${previewMode === 'skeleton' ? 'active' : ''}`}
          onClick={() => setPreviewMode('skeleton')}
          title="Skeleton View"
        >
          🦴
        </button>
        <button
          className={`hand-tracking-overlay__btn ${previewMode === 'feed' ? 'active' : ''}`}
          onClick={() => setPreviewMode('feed')}
          title="Camera Feed"
        >
          📹
        </button>
      </div>

      <div className="hand-tracking-overlay__status">
        Status: <span className={`status-${cameraStatus}`}>{cameraStatus}</span>
      </div>

      {cameraEnabled && (
        <div className="hand-tracking-overlay__preview">
          {previewMode === 'feed' && videoElement && (
            <video
              ref={(el) => { if (el && videoElement) el.srcObject = videoElement.srcObject; }}
              className="hand-tracking-overlay__video"
              autoPlay
              playsInline
              muted
            />
          )}

          {previewMode === 'skeleton' && (
            <canvas
              className="hand-tracking-overlay__canvas"
              width={320}
              height={240}
              ref={(el) => {
                if (el && handTrackingEngine) {
                  const canvas = handTrackingEngine.getCameraPreviewCanvas() as HTMLCanvasElement;
                  if (canvas) {
                    const ctx = el.getContext('2d');
                    if (ctx) {
                      const drawLoop = () => {
                        ctx.clearRect(0, 0, el.width, el.height);
                        if (canvas) {
                          ctx.drawImage(canvas, 0, 0, el.width, el.height);
                        }
                        if (handState && handState.hands.length > 0) {
                          drawHandSkeleton(ctx, handState.hands[0], el.width, el.height);
                        }
                        requestAnimationFrame(drawLoop);
                      };
                      drawLoop();
                    }
                  }
                }
              }}
            />
          )}

          <div className="hand-tracking-overlay__info">
            <div className="hand-tracking-overlay__stats">
              <span>Hands: {handCount}</span>
              <span>L: {Math.round(leftConf * 100)}%</span>
              <span>R: {Math.round(rightConf * 100)}%</span>
              <span>FPS: {fps}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  hand: any,
  width: number,
  height: number
) {
  const landmarks = hand.landmarks;
  if (!landmarks || landmarks.length < 21) return;

  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-width, 0);

  ctx.strokeStyle = hand.handedness === 'Left' ? '#00aaff' : '#ff6600';
  ctx.fillStyle = hand.handedness === 'Left' ? '#00aaff' : '#ff6600';
  ctx.lineWidth = 2;

  for (const [a, b] of FINGER_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (la && lb) {
      ctx.beginPath();
      ctx.moveTo(la.x * width, la.y * height);
      ctx.lineTo(lb.x * width, lb.y * height);
      ctx.stroke();
    }
  }

  for (const lm of landmarks) {
    if (lm) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

const FINGER_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17], [17, 6], [1, 5],
];

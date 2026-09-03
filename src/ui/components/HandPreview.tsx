import React, { useRef, useEffect } from 'react';
import { HandTrackingEngine } from '../../vision/HandTrackingEngine';
import type { HandState } from '../../vision/types';

interface HandPreviewProps {
  handTrackingEngine: HandTrackingEngine | null;
  cameraEnabled: boolean;
}

const FINGER_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17], [17, 6], [1, 5],
];

export function HandPreview({ handTrackingEngine, cameraEnabled }: HandPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const lastStateRef = useRef<HandState | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !cameraEnabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const engine = handTrackingEngine;
      if (!engine) return;

      const videoEl = engine.getVideoElement();
      const state = engine.getHandState();

      lastStateRef.current = state;

      if (videoEl && videoRef.current) {
        videoRef.current.srcObject = videoEl.srcObject;
      }

      if (videoRef.current && !videoRef.current.paused) {
        try {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          if (state && state.hands.length > 0) {
            for (const hand of state.hands) {
              const landmarks = hand.landmarks;
              if (!landmarks || landmarks.length < 21) continue;

              ctx.strokeStyle = hand.handedness === 'Left' ? '#00aaff' : '#ff6600';
              ctx.fillStyle = hand.handedness === 'Left' ? '#00aaff' : '#ff6600';
              ctx.lineWidth = 2;

              for (const [a, b] of FINGER_CONNECTIONS) {
                const la = landmarks[a];
                const lb = landmarks[b];
                if (la && lb) {
                  ctx.beginPath();
                  ctx.moveTo(la.x * canvas.width, la.y * canvas.height);
                  ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height);
                  ctx.stroke();
                }
              }

              for (const lm of landmarks) {
                if (lm) {
                  ctx.beginPath();
                  ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          }
          ctx.restore();
        } catch {
          void 0;
        }
      }

      rafRef.current = requestAnimationFrame(drawLoop);
    };

    rafRef.current = requestAnimationFrame(drawLoop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraEnabled, handTrackingEngine]);

  return (
    <div className="hand-preview">
      <canvas
        ref={canvasRef}
        className="hand-preview__canvas"
        width={200}
        height={150}
      />
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        autoPlay
        playsInline
        muted
      />
      <div className="hand-preview__stats">
        <span>Hands: {lastStateRef.current?.handCount || 0}</span>
        <span>L: {Math.round((lastStateRef.current?.leftHand?.confidence || 0) * 100)}%</span>
        <span>R: {Math.round((lastStateRef.current?.rightHand?.confidence || 0) * 100)}%</span>
      </div>
    </div>
  );
}

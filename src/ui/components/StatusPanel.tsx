import './StatusPanel.css';

interface StatusPanelProps {
  gesture: string;
  gestureConfidence: number;
  mode: string;
  axisLock: 'x' | 'y' | 'z' | null;
  selectedObject: string | null;
  handCount: number;
  leftHandConfidence: number;
  rightHandConfidence: number;
  cameraStatus: string;
  fps: number;
  pinchDistance?: number;
  handPosition?: { x: number; y: number; z: number } | null;
}

export function StatusPanel({
  gesture,
  gestureConfidence,
  mode,
  axisLock,
  selectedObject,
  handCount,
  leftHandConfidence,
  rightHandConfidence,
  cameraStatus,
  fps,
  pinchDistance,
  handPosition,
}: StatusPanelProps) {
  const confidencePercent = Math.round(gestureConfidence * 100);
  const trackingGood = leftHandConfidence > 0.3 || rightHandConfidence > 0.3;

  const getModeIcon = (m: string) => {
    const icons: Record<string, string> = {
      SELECT: '👆',
      MOVE: '🖐️',
      ROTATE: '🔁',
      SCALE: '🔍',
      CREATE: '➕',
      CAMERA: '📹',
      EDIT: '✏️',
    };
    return icons[m] || '❓';
  };

  const getGestureColor = (g: string) => {
    const colors: Record<string, string> = {
      POINTING: '#33aaff',
      PINCH: '#00ff88',
      GRAB: '#ff6600',
      OPEN_PALM: '#33ffaa',
      FIST: '#ff3366',
      TWO_FINGER: '#aa33ff',
      THREE_FINGER: '#ffaa33',
      IDLE: '#888888',
    };
    return colors[g] || '#ffffff';
  };

  return (
    <div className="status-panel">
      <div className="status-panel__row status-panel__row--primary">
        <div className="status-panel__item">
          <span className="status-panel__label">GESTURE</span>
          <span
            className="status-panel__value"
            style={{ color: getGestureColor(gesture) }}
          >
            {gesture} {confidencePercent}%
          </span>
        </div>

        <div className="status-panel__item">
          <span className="status-panel__label">MODE</span>
          <span className="status-panel__value">
            {getModeIcon(mode)} {mode}
          </span>
        </div>

        {axisLock && (
          <div className="status-panel__item">
            <span className="status-panel__label">AXIS</span>
            <span
              className="status-panel__value"
              style={{
                color: axisLock === 'x' ? '#ff3333' :
                       axisLock === 'y' ? '#33ff33' :
                       axisLock === 'z' ? '#3333ff' : '#fff'
              }}
            >
              {axisLock.toUpperCase()} LOCKED
            </span>
          </div>
        )}

        <div className="status-panel__item">
          <span className="status-panel__label">OBJECT</span>
          <span className="status-panel__value">
            {selectedObject || 'None'}
          </span>
        </div>

        <div className="status-panel__item">
          <span className="status-panel__label">TRACKING</span>
          <span
            className="status-panel__value"
            style={{ color: trackingGood ? '#00ff88' : '#ff3366' }}
          >
            <span className="status-panel__dot"></span>
            {trackingGood ? 'GOOD' : 'LOST'}
          </span>
        </div>
      </div>

      <div className="status-panel__row">
        <div className="status-panel__item status-panel__item--compact">
          <span className="status-panel__label">Hand</span>
          <span className="status-panel__value">
            {handCount === 2 ? 'BOTH' : handCount === 1 ? 'RIGHT' : 'NONE'}
          </span>
        </div>

        <div className="status-panel__item status-panel__item--compact">
          <span className="status-panel__label">Pinch</span>
          <span className="status-panel__value">
            {pinchDistance !== undefined ? `${pinchDistance.toFixed(2)}` : '—'}
          </span>
        </div>

        <div className="status-panel__item status-panel__item--compact">
          <span className="status-panel__label">Pos</span>
          <span className="status-panel__value">
            {handPosition ? `${handPosition.x.toFixed(1)}, ${handPosition.y.toFixed(1)}, ${handPosition.z.toFixed(1)}` : '—'}
          </span>
        </div>

        <div className="status-panel__item status-panel__item--compact">
          <span className="status-panel__label">Camera</span>
          <span className={`status-panel__value status-panel__value--${cameraStatus}`}>
            {cameraStatus.toUpperCase()}
          </span>
        </div>

        <div className="status-panel__item status-panel__item--compact">
          <span className="status-panel__label">FPS</span>
          <span className="status-panel__value">{fps}</span>
        </div>
      </div>
    </div>
  );
}

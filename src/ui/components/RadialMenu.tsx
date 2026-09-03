import type { SceneObject } from '../../scene/types';
import './RadialMenu.css';

interface RadialMenuProps {
  visible: boolean;
  centerX: number;
  centerY: number;
  onSelect: (type: SceneObject['type']) => void;
  onClose: () => void;
}

const MENU_ITEMS: { type: SceneObject['type']; label: string; icon: string; angle: number }[] = [
  { type: 'cube', label: 'Cube', icon: '🔲', angle: 0 },
  { type: 'sphere', label: 'Sphere', icon: '⚪', angle: 60 },
  { type: 'cylinder', label: 'Cylinder', icon: '🟤', angle: 120 },
  { type: 'cone', label: 'Cone', icon: '🔺', angle: 180 },
  { type: 'torus', label: 'Torus', icon: '🍩', angle: 240 },
  { type: 'plane', label: 'Plane', icon: '⬜', angle: 300 },
];

export function RadialMenu({ visible, centerX, centerY, onSelect, onClose }: RadialMenuProps) {
  if (!visible) return null;
  
  const radius = 100;
  const itemRadius = 40;
  
  return (
    <div 
      className="radial-menu"
      style={{
        left: centerX,
        top: centerY,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="radial-menu__backdrop" onClick={onClose} />
      
      {MENU_ITEMS.map((item) => {
        const angleRad = (item.angle - 90) * Math.PI / 180;
        const x = Math.cos(angleRad) * radius;
        const y = Math.sin(angleRad) * radius;
        
        return (
          <button
            key={item.type}
            className="radial-menu__item"
            style={{
              left: x + radius + itemRadius,
              top: y + radius + itemRadius,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={() => onSelect(item.type)}
            title={item.label}
          >
            <span className="radial-menu__icon">{item.icon}</span>
            <span className="radial-menu__label">{item.label}</span>
          </button>
        );
      })}
      
      <div className="radial-menu__center">
        <span>ADD</span>
      </div>
    </div>
  );
}

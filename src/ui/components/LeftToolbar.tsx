import React from 'react';
import type { SceneObject } from '../../scene/types';
import type { InteractionMode } from '../../vision/GestureStateMachine';
import './LeftToolbar.css';

interface LeftToolbarProps {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  onAddObject: (type: SceneObject['type']) => void;
  onAxisLock: (axis: 'x' | 'y' | 'z' | null) => void;
  axisLock: 'x' | 'y' | 'z' | null;
  onFrameAll?: () => void;
  onFocusSelected?: () => void;
}

const TOOLS: { mode: InteractionMode; icon: string; label: string; hotkey: string }[] = [
  { mode: 'SELECT', icon: '👆', label: 'Select', hotkey: 'Q' },
  { mode: 'MOVE', icon: '🖐️', label: 'Move', hotkey: 'G' },
  { mode: 'ROTATE', icon: '🔁', label: 'Rotate', hotkey: 'R' },
  { mode: 'SCALE', icon: '🔍', label: 'Scale', hotkey: 'S' },
  { mode: 'CREATE', icon: '➕', label: 'Create', hotkey: 'A' },
  { mode: 'CAMERA', icon: '📹', label: 'Camera', hotkey: 'C' },
  { mode: 'EDIT', icon: '✏️', label: 'Edit', hotkey: 'Tab' },
];

const OBJECT_TYPES: { type: SceneObject['type']; label: string; icon: string }[] = [
  { type: 'cube', label: 'Cube', icon: '🔲' },
  { type: 'sphere', label: 'Sphere', icon: '⚪' },
  { type: 'cylinder', label: 'Cylinder', icon: '🟥' },
  { type: 'cone', label: 'Cone', icon: '🔺' },
  { type: 'torus', label: 'Torus', icon: '🍩' },
  { type: 'plane', label: 'Plane', icon: '⬜' },
  { type: 'empty', label: 'Empty', icon: '⚪' },
];

const AXES: { axis: 'x' | 'y' | 'z'; label: string; color: string }[] = [
  { axis: 'x', label: 'X', color: '#ff3333' },
  { axis: 'y', label: 'Y', color: '#33ff33' },
  { axis: 'z', label: 'Z', color: '#3333ff' },
];

export function LeftToolbar({ 
  mode, onModeChange, onAddObject, onAxisLock, axisLock, onFrameAll, onFocusSelected
}: LeftToolbarProps) {
  return (
    <div className="left-toolbar">
      <div className="left-toolbar__section">
        <div className="left-toolbar__title">Tools</div>
        <div className="left-toolbar__tools">
          {TOOLS.map((tool) => (
            <button
              key={tool.mode}
              className={`left-toolbar__tool ${mode === tool.mode ? 'active' : ''}`}
              onClick={() => onModeChange(tool.mode)}
              title={`${tool.label} (${tool.hotkey})`}
            >
              <span className="left-toolbar__tool-icon">{tool.icon}</span>
              <span className="left-toolbar__tool-label">{tool.label}</span>
              <span className="left-toolbar__tool-hotkey">{tool.hotkey}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="left-toolbar__separator" />
      
      <div className="left-toolbar__section">
        <div className="left-toolbar__title">Objects</div>
        <div className="left-toolbar__objects">
          {OBJECT_TYPES.map((obj) => (
            <button
              key={obj.type}
              className="left-toolbar__object"
              onClick={() => onAddObject(obj.type)}
              title={`Add ${obj.label}`}
            >
              <span className="left-toolbar__object-icon">{obj.icon}</span>
              <span className="left-toolbar__object-label">{obj.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="left-toolbar__separator" />
      
      <div className="left-toolbar__section">
        <div className="left-toolbar__title">Axis</div>
        <div className="left-toolbar__axes">
          {AXES.map((axis) => (
            <button
              key={axis.axis}
              className={`left-toolbar__axis ${axisLock === axis.axis ? 'active' : ''}`}
              onClick={() => onAxisLock(axisLock === axis.axis ? null : axis.axis)}
              title={axis.axis.toUpperCase()}
              style={{ '--axis-color': axis.color } as React.CSSProperties}
            >
              <span 
                className="left-toolbar__axis-line"
                style={{ backgroundColor: axis.color } as React.CSSProperties}
              />
              {axis.label}
            </button>
          ))}
          <button
            className={`left-toolbar__axis ${axisLock === null ? 'active' : ''}`}
            onClick={() => onAxisLock(null)}
            title="Free"
          >
            <span className="left-toolbar__axis-line" style={{ backgroundColor: '#888' } as React.CSSProperties} />
            ∅
          </button>
        </div>
      </div>

      <div className="left-toolbar__separator" />

      <div className="left-toolbar__section">
        <div className="left-toolbar__title">View</div>
        <div className="left-toolbar__tools">
          <button
            className="left-toolbar__tool"
            onClick={onFrameAll}
            title="Frame All (F)"
          >
            <span className="left-toolbar__tool-icon">🔲</span>
            <span className="left-toolbar__tool-label">Frame All</span>
            <span className="left-toolbar__tool-hotkey">F</span>
          </button>
          <button
            className="left-toolbar__tool"
            onClick={onFocusSelected}
            title="Focus Selected (Shift+F)"
          >
            <span className="left-toolbar__tool-icon">🎯</span>
            <span className="left-toolbar__tool-label">Focus</span>
            <span className="left-toolbar__tool-hotkey">Shift+F</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import type { InteractionMode } from '../../vision/GestureStateMachine';
import './TopBar.css';

interface TopBarProps {
  onNewScene: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddObject: () => void;
  onSettings: () => void;
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MODE_OPTIONS: { value: InteractionMode; label: string; icon: string }[] = [
  { value: 'SELECT', label: 'Select', icon: '👆' },
  { value: 'MOVE', label: 'Move', icon: '🖐️' },
  { value: 'ROTATE', label: 'Rotate', icon: '🔁' },
  { value: 'SCALE', label: 'Scale', icon: '🔍' },
  { value: 'CREATE', label: 'Create', icon: '➕' },
  { value: 'CAMERA', label: 'Camera', icon: '📹' },
  { value: 'EDIT', label: 'Edit', icon: '✏️' },
];

export function TopBar({
  onNewScene,
  onOpen,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  onAddObject,
  onSettings,
  mode,
  onModeChange,
  canUndo,
  canRedo,
}: TopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-bar__section">
        <button className="top-bar__btn" onClick={onNewScene} title="New Scene (Ctrl+N)">
          <span>📄</span> New
        </button>
        <button className="top-bar__btn" onClick={onOpen} title="Open (Ctrl+O)">
          <span>📂</span> Open
        </button>
        <button className="top-bar__btn" onClick={onSave} title="Save (Ctrl+S)">
          <span>💾</span> Save
        </button>
        <button className="top-bar__btn" onClick={onSaveAs} title="Save As">
          <span>💾</span> Save As
        </button>
      </div>
      
      <div className="top-bar__section">
        <button className="top-bar__btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <span>↩️</span>
        </button>
        <button className="top-bar__btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <span>↪️</span>
        </button>
      </div>
      
      <div className="top-bar__section">
        <button className="top-bar__btn" onClick={onAddObject} title="Add Object">
          <span>➕</span> Add
        </button>
      </div>
      
      <div className="top-bar__section top-bar__mode">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`top-bar__mode-btn ${mode === opt.value ? 'active' : ''}`}
            onClick={() => onModeChange(opt.value)}
            title={opt.label}
          >
            <span>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
      
      <div className="top-bar__section top-bar__right">
        <button className="top-bar__btn" onClick={onSettings} title="Settings">
          <span>⚙️</span>
        </button>
      </div>
    </div>
  );
}

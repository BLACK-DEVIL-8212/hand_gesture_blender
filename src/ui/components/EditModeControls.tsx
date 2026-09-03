import React from 'react';
import { useEditorStore } from '../../store/editor';
import type { InteractionMode } from '../../vision/GestureStateMachine';
import type { EditTool } from '../../modeling/EditableMesh';
import type { SubMode } from '../../modeling/MeshData';
import './EditModeControls.css';

const EDIT_TOOLS: { tool: EditTool; label: string; icon: string; hotkey: string }[] = [
  { tool: 'MOVE', label: 'Move', icon: '✋', hotkey: 'G' },
  { tool: 'PULL', label: 'Pull', icon: '⬆️', hotkey: '1' },
  { tool: 'PUSH', label: 'Push', icon: '⬇️', hotkey: '2' },
  { tool: 'BEND', label: 'Bend', icon: '〰️', hotkey: '3' },
  { tool: 'TWIST', label: 'Twist', icon: '🌀', hotkey: '4' },
  { tool: 'SMOOTH', label: 'Smooth', icon: '🔄', hotkey: '5' },
  { tool: 'EXTRUDE', label: 'Extrude', icon: '📏', hotkey: '6' },
  { tool: 'CUT', label: 'Cut', icon: '✂️', hotkey: '7' },
];

const SUB_MODES: { mode: SubMode; label: string; icon: string }[] = [
  { mode: 'VERTEX', label: 'Vertex', icon: '🔵' },
  { mode: 'EDGE', label: 'Edge', icon: '🟡' },
  { mode: 'FACE', label: 'Face', icon: '🟠' },
];

interface EditModeControlsProps {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
}

export function EditModeControls({ mode, onModeChange }: EditModeControlsProps) {
  const editTool = useEditorStore((s) => s.editTool);
  const editSubMode = useEditorStore((s) => s.editSubMode);
  const brushSettings = useEditorStore((s) => s.brushSettings);
  const setEditSubMode = useEditorStore((s) => s.setEditSubMode);
  const setBrushSettings = useEditorStore((s) => s.setBrushSettings);
  const setEditTool = useEditorStore((s) => s.setEditTool);

  if (mode !== 'EDIT') return null;

  const handleToolClick = (tool: EditTool) => {
    setEditTool(tool);
    if (tool === 'MOVE') {
      onModeChange('MOVE');
    } else {
      onModeChange('EDIT');
    }
  };

  return (
    <div className="edit-mode-controls">
      <div className="edit-mode-controls__section">
        <div className="edit-mode-controls__title">Edit Tools</div>
        <div className="edit-mode-controls__tools">
          {EDIT_TOOLS.map((tool) => (
            <button
              key={tool.tool}
              className={`edit-mode-controls__tool ${editTool === tool.tool ? 'active' : ''}`}
              onClick={() => handleToolClick(tool.tool)}
              title={`${tool.label} (${tool.hotkey})`}
            >
              <span className="edit-mode-controls__tool-icon">{tool.icon}</span>
              <span className="edit-mode-controls__tool-label">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="edit-mode-controls__separator" />

      <div className="edit-mode-controls__section">
        <div className="edit-mode-controls__title">Selection Mode</div>
        <div className="edit-mode-controls__sub-modes">
          {SUB_MODES.map((subMode) => (
            <button
              key={subMode.mode}
              className={`edit-mode-controls__sub-mode ${editSubMode === subMode.mode ? 'active' : ''}`}
              onClick={() => setEditSubMode(subMode.mode)}
              title={subMode.label}
            >
              <span className="edit-mode-controls__sub-mode-icon">{subMode.icon}</span>
              <span className="edit-mode-controls__sub-mode-label">{subMode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="edit-mode-controls__separator" />

      <div className="edit-mode-controls__section">
        <div className="edit-mode-controls__title">Brush Settings</div>
        <div className="edit-mode-controls__slider">
          <label>Radius: {brushSettings.radius.toFixed(2)}</label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={brushSettings.radius}
            onChange={(e) => setBrushSettings({ ...brushSettings, radius: parseFloat(e.target.value) })}
          />
        </div>
        <div className="edit-mode-controls__slider">
          <label>Strength: {brushSettings.strength.toFixed(2)}</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={brushSettings.strength}
            onChange={(e) => setBrushSettings({ ...brushSettings, strength: parseFloat(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

import type { SceneObject, ObjectMaterial } from '../../scene/types';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  selectedObjects: SceneObject[];
  onUpdatePosition: (id: string, x: number, y: number, z: number) => void;
  onUpdateRotation: (id: string, x: number, y: number, z: number) => void;
  onUpdateScale: (id: string, x: number, y: number, z: number) => void;
  onUpdateMaterial: (id: string, material: Partial<ObjectMaterial>) => void;
  onUpdateName: (id: string, name: string) => void;
}

export function PropertiesPanel({
  selectedObjects,
  onUpdatePosition,
  onUpdateRotation,
  onUpdateScale,
  onUpdateMaterial,
  onUpdateName,
}: PropertiesPanelProps) {
  if (selectedObjects.length === 0) {
    return (
      <div className="properties-panel">
        <div className="properties-panel__empty">
          <p>No object selected</p>
          <p>Select an object to edit its properties</p>
        </div>
      </div>
    );
  }
  
  const obj = selectedObjects[0];
  const t = obj.transform as any;
  
  const handleNumberChange = (
    setter: (x: number, y: number, z: number) => void,
    field: 'x' | 'y' | 'z',
    value: string,
    current: { x: number; y: number; z: number }
  ) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setter(
      field === 'x' ? num : current.x,
      field === 'y' ? num : current.y,
      field === 'z' ? num : current.z
    );
  };
  
  return (
    <div className="properties-panel">
      <div className="properties-panel__header">
        <input
          type="text"
          className="properties-panel__name"
          value={obj.name}
          onChange={(e) => onUpdateName(obj.id, e.target.value)}
        />
        <span className="properties-panel__type">{obj.type}</span>
      </div>
      
      <div className="properties-panel__section">
        <div className="properties-panel__section-title">Transform</div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Position</span>
          <div className="properties-panel__xyz">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <input
                key={axis}
                type="number"
                step="0.01"
                value={t.position[axis]}
                onChange={(e) => handleNumberChange(
                  (x, y, z) => onUpdatePosition(obj.id, x, y, z),
                  axis,
                  e.target.value,
                  { x: t.position.x, y: t.position.y, z: t.position.z }
                )}
                className="properties-panel__input"
              />
            ))}
          </div>
        </div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Rotation</span>
          <div className="properties-panel__xyz">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <input
                key={axis}
                type="number"
                step="0.01"
                value={t.rotation[axis]}
                onChange={(e) => handleNumberChange(
                  (x, y, z) => onUpdateRotation(obj.id, x, y, z),
                  axis,
                  e.target.value,
                  { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z }
                )}
                className="properties-panel__input"
              />
            ))}
          </div>
        </div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Scale</span>
          <div className="properties-panel__xyz">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <input
                key={axis}
                type="number"
                step="0.01"
                value={t.scale[axis]}
                onChange={(e) => handleNumberChange(
                  (x, y, z) => onUpdateScale(obj.id, x, y, z),
                  axis,
                  e.target.value,
                  { x: t.scale.x, y: t.scale.y, z: t.scale.z }
                )}
                className="properties-panel__input"
              />
            ))}
          </div>
        </div>
      </div>
      
      <div className="properties-panel__section">
        <div className="properties-panel__section-title">Material</div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Base Color</span>
          <input
            type="color"
            value={obj.material.baseColor}
            onChange={(e) => onUpdateMaterial(obj.id, { baseColor: e.target.value })}
            className="properties-panel__color"
          />
        </div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Metalness</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={obj.material.metalness}
            onChange={(e) => onUpdateMaterial(obj.id, { metalness: parseFloat(e.target.value) })}
            className="properties-panel__slider"
          />
          <span className="properties-panel__value">{obj.material.metalness.toFixed(2)}</span>
        </div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Roughness</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={obj.material.roughness}
            onChange={(e) => onUpdateMaterial(obj.id, { roughness: parseFloat(e.target.value) })}
            className="properties-panel__slider"
          />
          <span className="properties-panel__value">{obj.material.roughness.toFixed(2)}</span>
        </div>
      </div>
      
      <div className="properties-panel__section">
        <div className="properties-panel__section-title">Object</div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Visible</span>
          <input
            type="checkbox"
            checked={obj.visible}
            onChange={(e) => {
              const updates = { visible: e.target.checked } as any;
              onUpdatePosition(obj.id, 0, 0, 0);
              updates;
            }}
            className="properties-panel__checkbox"
          />
        </div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Cast Shadow</span>
          <input
            type="checkbox"
            checked={obj.castShadow}
            className="properties-panel__checkbox"
            readOnly
          />
        </div>
        
        <div className="properties-panel__row">
          <span className="properties-panel__label">Receive Shadow</span>
          <input
            type="checkbox"
            checked={obj.receiveShadow}
            className="properties-panel__checkbox"
            readOnly
          />
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import type { SceneObject } from '../../scene/types';
import './ObjectOutliner.css';

interface ObjectOutlinerProps {
  objects: SceneObject[];
  selectedIds: string[];
  onObjectSelect: (id: string) => void;
  onObjectDelete: (id: string) => void;
  onObjectDuplicate: (id: string) => void;
}

const OBJECT_ICONS: Record<SceneObject['type'], string> = {
  cube: '🔲',
  sphere: '⚪',
  cylinder: '🟤',
  cone: '🔺',
  torus: '🍩',
  plane: '⬜',
  capsule: '⚫',
  monkey: '🐒',
  empty: '⚪',
  light: '💡',
  camera: '📹',
  group: '📁',
};

export function ObjectOutliner({
  objects,
  selectedIds,
  onObjectSelect,
  onObjectDelete,
  onObjectDuplicate,
}: ObjectOutlinerProps) {
  const getChildren = (id: string): SceneObject[] => {
    return objects.filter(obj => obj.parent === id);
  };
  
  const renderObject = (obj: SceneObject, depth: number = 0) => {
    const isSelected = selectedIds.includes(obj.id);
    const children = getChildren(obj.id);
    const isExpended = openNodes.has(obj.id);
    const hasChildren = children.length > 0;
    const paddingLeft = depth * 16 + 8;
    
    return (
      <React.Fragment key={obj.id}>
        <div
          className={`outliner__item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft }}
          onClick={() => onObjectSelect(obj.id)}
        >
          {hasChildren && (
            <span 
              className="outliner__expand"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(obj.id);
              }}
            >
              {isExpended ? '▼' : '▶'}
            </span>
          )}
          <span className="outliner__icon">{OBJECT_ICONS[obj.type] || '📄'}</span>
          <span className="outliner__name" title={obj.name}>
            {obj.name}
          </span>
          <div className="outliner__actions">
            <button
              className="outliner__action-btn"
              title="Duplicate"
              onClick={(e) => {
                e.stopPropagation();
                onObjectDuplicate(obj.id);
              }}
            >
              📋
            </button>
            <button
              className="outliner__action-btn"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onObjectDelete(obj.id);
              }}
            >
              🗑️
            </button>
          </div>
        </div>
        {hasChildren && isExpended &&
          children.map(child => renderObject(child, depth + 1))
        }
      </React.Fragment>
    );
  };
  
  const [openNodes, setOpenNodes] = React.useState<Set<string>>(new Set());
  
  const toggleNode = (id: string) => {
    setOpenNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const rootObjects = objects.filter(obj => !obj.parent);
  
  return (
    <div className="object-outliner">
      <div className="outliner__header">
        <span>Outliner</span>
        <span>({objects.length})</span>
      </div>
      <div className="outliner__list">
        {rootObjects.length === 0 ? (
          <div className="outliner__empty">No objects</div>
        ) : (
          rootObjects.map(obj => renderObject(obj, 0))
        )}
      </div>
    </div>
  );
}

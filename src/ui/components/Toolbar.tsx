import React from 'react';
import clsx from 'clsx';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  onClick?: () => void;
  tooltip?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ToolbarButton({ 
  icon, label, active, onClick, tooltip, size = 'md' 
}: ToolbarButtonProps) {
  return (
    <button
      className={clsx(
        'toolbar-btn',
        `toolbar-btn--${size}`,
        { 'toolbar-btn--active': active }
      )}
      onClick={onClick}
      title={tooltip}
    >
      {icon}
      {label && <span className="toolbar-btn__label">{label}</span>}
    </button>
  );
}

interface ToolbarSeparatorProps {
  vertical?: boolean;
}

export function ToolbarSeparator({ vertical }: ToolbarSeparatorProps) {
  return <div className={clsx('toolbar-separator', { 'toolbar-separator--vertical': vertical })} />;
}

interface ToolbarGroupProps {
  label?: string;
  children: React.ReactNode;
  vertical?: boolean;
}

export function ToolbarGroup({ label, children, vertical }: ToolbarGroupProps) {
  return (
    <div className={clsx('toolbar-group', { 'toolbar-group--vertical': vertical })}>
      {label && <div className="toolbar-group__label">{label}</div>}
      {children}
    </div>
  );
}

interface ToolbarProps {
  title: string;
  children: React.ReactNode;
  vertical?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function Toolbar({ title, children, vertical = false, collapsible = false, defaultCollapsed = false }: ToolbarProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  
  return (
    <div className={clsx('toolbar', { 'toolbar--vertical': vertical, 'toolbar--collapsed': collapsed })}>
      <div className="toolbar__header">
        <span className="toolbar__title">{title}</span>
        {collapsible && (
          <button 
            className="toolbar__collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        )}
      </div>
      {!collapsed && <div className="toolbar__content">{children}</div>}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import './ElectronTitleBar.css';

declare global {
  interface Window {
    electronAPI?: {
      setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
      setIgnoreMouseEvents: (ignore: boolean) => Promise<boolean>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onReady: (callback: (info: { width: number; height: number }) => void) => void;
    };
  }
}

export function ElectronTitleBar() {
  const [isElectron, setIsElectron] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [isClickThrough, setIsClickThrough] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const hasElectronAPI = typeof window !== 'undefined' && !!window.electronAPI;
    if (!hasElectronAPI) {
      setIsElectron(false);
      return;
    }

    setIsElectron(true);

    window.electronAPI!.onReady(async () => {
      const maximized = await window.electronAPI!.isMaximized();
      setIsMaximized(maximized);
    });
  }, []);

  const toggleAlwaysOnTop = async () => {
    if (!window.electronAPI) return;
    const newVal = !isAlwaysOnTop;
    await window.electronAPI.setAlwaysOnTop(newVal);
    setIsAlwaysOnTop(newVal);
  };

  const toggleClickThrough = async () => {
    if (!window.electronAPI) return;
    const newVal = !isClickThrough;
    await window.electronAPI.setIgnoreMouseEvents(newVal);
    setIsClickThrough(newVal);
  };

  const handleMinimize = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.minimizeWindow();
  };

  const handleMaximize = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.maximizeWindow();
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.closeWindow();
  };

  if (!isElectron) return null;

  return (
    <div className="electron-titlebar">
      <div className="electron-titlebar__drag" />
      <div className="electron-titlebar__controls">
        <button
          className={`electron-titlebar__btn ${isAlwaysOnTop ? 'active' : ''}`}
          onClick={toggleAlwaysOnTop}
          title="Always on top"
        >
          📌
        </button>
        <button
          className={`electron-titlebar__btn ${isClickThrough ? 'active' : ''}`}
          onClick={toggleClickThrough}
          title="Click-through overlay"
        >
          👻
        </button>
        <button className="electron-titlebar__btn" onClick={handleMinimize} title="Minimize">
          _
        </button>
        <button className="electron-titlebar__btn" onClick={handleMaximize} title="Maximize">
          {isMaximized ? '❐' : '□'}
        </button>
        <button className="electron-titlebar__btn electron-titlebar__btn--close" onClick={handleClose} title="Close">
          ✕
        </button>
      </div>
    </div>
  );
}

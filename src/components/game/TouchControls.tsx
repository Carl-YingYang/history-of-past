'use client';

import { useState, useEffect, useRef } from 'react';
import { getEngineControls } from './GameCanvas';

/**
 * On-screen D-pad for mobile/touch devices.
 * Also serves as an alternative input method for accessibility.
 * Hidden automatically while a dialogue is active (the player can't move then anyway),
 * and while a panel overlay is open.
 *
 * State sync: reads body data attributes via useState initializer on mount,
 * then updates via MutationObserver callback (external subscription).
 */
export default function TouchControls() {
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [hidden, setHidden] = useState(() => {
    if (typeof document === 'undefined') return false;
    const inDialogue = document.body.getAttribute('data-noor-dialogue-active') === 'true';
    const inPanel = document.body.getAttribute('data-noor-panel-active') === 'true';
    return inDialogue || inPanel;
  });
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // Subscribe to body attribute changes (dialogue/panel open state)
  useEffect(() => {
    const update = () => {
      const inDialogue = document.body.getAttribute('data-noor-dialogue-active') === 'true';
      const inPanel = document.body.getAttribute('data-noor-panel-active') === 'true';
      setHidden(inDialogue || inPanel);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-noor-dialogue-active', 'data-noor-panel-active'] });
    return () => observer.disconnect();
  }, []);

  const handleDirectionDown = (dir: 'up' | 'down' | 'left' | 'right') => {
    setActiveDir(dir);
    const controls = getEngineControls();
    if (controls) controls.setMoveDirection(dir);
  };

  const handleDirectionUp = () => {
    setActiveDir(null);
    const controls = getEngineControls();
    if (controls) controls.setMoveDirection(null);
  };

  const dirButton = (dir: 'up' | 'down' | 'left' | 'right', label: string, icon: string) => (
    <button
      className={`w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold transition-all select-none touch-none ${
        activeDir === dir
          ? 'bg-amber-500 text-white scale-95 shadow-inner shadow-amber-900/40'
          : 'bg-stone-900/85 text-amber-400 border border-amber-400/30 hover:bg-stone-800/85'
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        handleDirectionDown(dir);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        handleDirectionUp();
      }}
      onPointerLeave={() => activeDir === dir && handleDirectionUp()}
      onPointerCancel={() => handleDirectionUp()}
      aria-label={`Move ${dir}`}
    >
      {icon}
    </button>
  );

  return (
    <div
      className={`absolute bottom-4 left-4 z-20 select-none transition-opacity duration-200 ${
        hidden ? 'opacity-0 pointer-events-none' : isTouchDevice ? 'opacity-100' : 'opacity-70 hover:opacity-100'
      }`}
    >
      {/* D-Pad */}
      <div className="flex flex-col items-center gap-1">
        {dirButton('up', 'Up', '▲')}
        <div className="flex gap-1">
          {dirButton('left', 'Left', '◀')}
          <div className="w-11 h-11 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-amber-400/40 ring-1 ring-amber-400/20" />
          </div>
          {dirButton('right', 'Right', '▶')}
        </div>
        {dirButton('down', 'Down', '▼')}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { getEngineControls } from './GameCanvas';

/**
 * On-screen D-pad and interact button for mobile/touch devices.
 * Also serves as an alternative input method for accessibility.
 * Visible on all devices but more prominent on touch screens.
 */
export default function TouchControls() {
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Detect touch device
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

  const handleInteract = () => {
    const controls = getEngineControls();
    if (controls) controls.triggerInteract();
  };

  const dirButton = (dir: 'up' | 'down' | 'left' | 'right', label: string, icon: string) => (
    <button
      className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold transition-all select-none touch-none ${
        activeDir === dir
          ? 'bg-amber-500 text-white scale-95 shadow-inner'
          : 'bg-stone-800/80 text-amber-400 border border-amber-400/30 hover:bg-stone-700/80'
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
    <div className={`absolute bottom-4 left-4 z-20 select-none ${isTouchDevice ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}>
      {/* D-Pad */}
      <div className="flex flex-col items-center gap-1">
        {dirButton('up', 'Up', '▲')}
        <div className="flex gap-1">
          {dirButton('left', 'Left', '◀')}
          <div className="w-12 h-12 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-amber-400/30" />
          </div>
          {dirButton('right', 'Right', '▶')}
        </div>
        {dirButton('down', 'Down', '▼')}
      </div>
    </div>
  );
}

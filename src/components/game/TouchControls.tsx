'use client';

import { useState, useEffect, useRef } from 'react';
import { getEngineControls } from './GameCanvas';

/**
 * On-screen D-pad for mobile/touch devices.
 * Enhanced with circular styled buttons, inner arrow icons, ripple effect,
 * shadow/glow, and a more prominent interact button.
 *
 * State sync: reads body data attributes via useState initializer on mount,
 * then updates via MutationObserver callback (external subscription).
 */
export default function TouchControls() {
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [rippleDir, setRippleDir] = useState<string | null>(null);
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
    setRippleDir(dir);
    setTimeout(() => setRippleDir(null), 500);
    const controls = getEngineControls();
    if (controls) controls.setMoveDirection(dir);
  };

  const handleDirectionUp = () => {
    setActiveDir(null);
    const controls = getEngineControls();
    if (controls) controls.setMoveDirection(null);
  };

  // Styled circular D-pad button with inner arrow icon and ripple
  const dirButton = (dir: 'up' | 'down' | 'left' | 'right', arrow: string) => (
    <button
      className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all select-none touch-none shadow-lg ${
        activeDir === dir
          ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white scale-95 shadow-amber-500/30 shadow-inner'
          : 'bg-stone-900/90 text-amber-400 border border-amber-400/30 hover:bg-stone-800/90 shadow-amber-900/20'
      }`}
      style={{
        boxShadow: activeDir === dir
          ? '0 0 12px rgba(251,191,36,0.3), 0 2px 8px rgba(0,0,0,0.4)'
          : '0 0 8px rgba(251,191,36,0.1), 0 2px 6px rgba(0,0,0,0.3)',
      }}
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
      {/* Inner arrow icon */}
      <span className="text-lg font-bold leading-none">{arrow}</span>
      {/* Ripple effect */}
      {rippleDir === dir && (
        <span className="absolute inset-0 rounded-full animate-ripple bg-amber-400/30" />
      )}
    </button>
  );

  return (
    <div
      className={`absolute bottom-4 left-4 z-20 select-none transition-opacity duration-200 ${
        hidden ? 'opacity-0 pointer-events-none' : isTouchDevice ? 'opacity-100' : 'opacity-70 hover:opacity-100'
      }`}
    >
      {/* D-Pad — circular buttons with inner arrow icons */}
      <div className="flex flex-col items-center gap-1.5">
        {dirButton('up', '↑')}
        <div className="flex gap-1.5">
          {dirButton('left', '←')}
          <div className="w-12 h-12 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-amber-400/30 ring-2 ring-amber-400/20 shadow-sm" style={{ boxShadow: '0 0 6px rgba(251,191,36,0.2)' }} />
          </div>
          {dirButton('right', '→')}
        </div>
        {dirButton('down', '↓')}
      </div>
    </div>
  );
}

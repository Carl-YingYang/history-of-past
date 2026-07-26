'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { gameEvents } from '@/lib/game/eventBus';

// We need a reference to the game engine instance to call advanceDialogue
// This is set up in this component
let engineRef: { advanceDialogue: () => void } | null = null;

export function setEngineRef(ref: { advanceDialogue: () => void }) {
  engineRef = ref;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineInstanceRef = useRef<any>(null);
  const { gameReady } = useGameStore();

  // Listen for dialogue advance events from UI
  useEffect(() => {
    const unsubscribe = gameEvents.on('dialogue:advance', () => {
      if (engineRef) {
        engineRef.advanceDialogue();
      }
    });
    return unsubscribe;
  }, []);

  const initEngine = useCallback(async () => {
    if (!canvasRef.current) return;
    
    // Import game engine dynamically to avoid SSR issues
    const GameEngineModule = await import('@/lib/game/gameEngine');
    const GameEngine = GameEngineModule.default;
    
    const engine = new GameEngine();
    engineInstanceRef.current = engine;
    
    // Set up engine reference for UI to call advanceDialogue
    engineRef = {
      advanceDialogue: () => engine.advanceDialogue(),
    };
    
    await engine.init(canvasRef.current);
    
    // Auto-focus the canvas so keyboard events work immediately
    if (canvasRef.current) {
      canvasRef.current.focus();
    }
  }, []);

  useEffect(() => {
    initEngine();
    
    return () => {
      if (engineInstanceRef.current) {
        engineInstanceRef.current.destroy();
      }
    };
  }, [initEngine]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="w-full h-full block outline-none"
        style={{ imageRendering: 'pixelated' }}
      />
      {/* Loading overlay */}
      {!gameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="text-amber-400 text-2xl font-bold mb-2" style={{ fontFamily: '"Geist", sans-serif' }}>
              Project Noor
            </div>
            <div className="text-white/60 text-sm">Loading San Diego — 1887...</div>
            <div className="mt-4 flex justify-center">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

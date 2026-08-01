'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { gameEvents } from '@/lib/game/eventBus';
import { storyLogManager } from '@/lib/game/storyLogManager';
import { achievementManager } from '@/lib/game/achievementManager';

// Engine reference for external controls (touch D-pad, interact button)
export interface EngineControls {
  advanceDialogue: () => void;
  setMoveDirection: (direction: 'up' | 'down' | 'left' | 'right' | null) => void;
  triggerInteract: () => void;
}

let engineRef: EngineControls | null = null;

export function setEngineRef(ref: EngineControls) {
  engineRef = ref;
}

export function getEngineControls(): EngineControls | null {
  return engineRef;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineInstanceRef = useRef<any>(null);
  const { gameReady } = useGameStore();

  // Boot the achievement tracker + story log tracker as soon as the canvas
  // mounts. Both managers are idempotent and safe to call before saveManager
  // has finished loading (storyLogManager persists to its own localStorage
  // key, achievementManager defers its save-data sync until `game:ready`).
  useEffect(() => {
    achievementManager.init();
    storyLogManager.init();
  }, []);

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
    
    // Set up engine reference for UI to call advanceDialogue and touch controls
    engineRef = {
      advanceDialogue: () => engine.advanceDialogue(),
      setMoveDirection: (dir) => engine.setMoveDirection(dir),
      triggerInteract: () => engine.triggerInteract(),
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
    <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block outline-none"
        style={{
          width: '960px',
          height: '640px',
          imageRendering: 'pixelated',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      />
      {/* Loading overlay */}
      {!gameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="text-center">
            <div className="text-amber-400 text-3xl font-bold mb-3 tracking-wider" style={{ fontFamily: '"Geist", sans-serif' }}>
              PROJECT NOOR
            </div>
            <div className="text-amber-400/60 text-sm mb-1 italic">A Stranger in San Diego</div>
            <div className="text-white/40 text-xs mb-4">Loading San Diego — 1887...</div>
            <div className="mt-4 flex justify-center">
              <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

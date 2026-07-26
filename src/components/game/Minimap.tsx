'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIStore } from './UIManager';
import mapData from '@/data/mapData.json';

/**
 * Minimap - Shows a small overview of the San Diego map with player position.
 * Helps with navigation and orientation.
 */
export default function Minimap() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'minimap';
  const [playerPos, setPlayerPos] = useState({ row: 15, col: 10 });
  const [npcPositions, setNpcPositions] = useState<{ row: number; col: number; id: string; visible: boolean }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // Listen for player position updates via custom event
  useEffect(() => {
    const handlePositionUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.playerPos) setPlayerPos(detail.playerPos);
      if (detail?.npcPositions) setNpcPositions(detail.npcPositions);
    };
    window.addEventListener('noor:positionUpdate', handlePositionUpdate);

    // Poll player position from save data every 500ms
    const interval = setInterval(() => {
      try {
        const save = localStorage.getItem('noor-save');
        if (save) {
          const data = JSON.parse(save);
          if (data.gameState?.playerPosition) {
            setPlayerPos(data.gameState.playerPosition);
          }
        }
      } catch (e) {
        // Ignore
      }
    }, 500);

    return () => {
      window.removeEventListener('noor:positionUpdate', handlePositionUpdate);
      clearInterval(interval);
    };
  }, []);

  // Render minimap to canvas (continuous animation while open)
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = 10;
    canvas.width = mapData.width * cellSize;
    canvas.height = mapData.height * cellSize;

    let lastDraw = 0;

    const draw = (t: number) => {
      if (t - lastDraw < 100) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDraw = t;

      // Clear
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw tiles
      for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
          const groundTile = mapData.layers.ground[row]?.[col];
          const buildingTile = mapData.layers.buildings[row]?.[col];

          let color = '#1a1a1a';
          if (groundTile === 2) color = '#3a5f3a';
          else if (groundTile === 3) color = '#8B7355';
          else if (groundTile === 1) color = '#A0826D';
          else if (groundTile === 4) color = '#5C4033';

          if (buildingTile === 5) color = '#666';
          if (buildingTile === 6) color = '#4a3520';

          ctx.fillStyle = color;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }

      // Draw NPC positions
      const npcPosData = mapData.npcPositions as Record<string, { row: number; col: number; appearsAfter?: string }>;
      for (const [id, pos] of Object.entries(npcPosData)) {
        let visible = true;
        if (pos.appearsAfter) {
          try {
            const save = localStorage.getItem('noor-save');
            if (save) {
              const data = JSON.parse(save);
              visible = data.completedObjectives?.includes(pos.appearsAfter) || false;
            }
          } catch (e) {
            // Ignore
          }
        }
        if (visible) {
          ctx.fillStyle = id === 'ibara' ? '#FFD700' : '#FF6B35';
          ctx.beginPath();
          ctx.arc(
            pos.col * cellSize + cellSize / 2,
            pos.row * cellSize + cellSize / 2,
            cellSize / 2,
            0, Math.PI * 2
          );
          ctx.fill();
        }
      }

      // Draw player position (pulsing)
      const pulse = (Math.sin(Date.now() / 250) + 1) / 2;
      // Outer halo
      ctx.fillStyle = `rgba(0, 255, 100, ${0.2 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(
        playerPos.col * cellSize + cellSize / 2,
        playerPos.row * cellSize + cellSize / 2,
        cellSize / 2 + pulse * 3,
        0, Math.PI * 2
      );
      ctx.fill();
      // Inner dot
      ctx.fillStyle = `rgba(0, 255, 100, ${0.85 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.arc(
        playerPos.col * cellSize + cellSize / 2,
        playerPos.row * cellSize + cellSize / 2,
        cellSize / 2,
        0, Math.PI * 2
      );
      ctx.fill();

      // Draw player direction indicator
      ctx.strokeStyle = '#00FF64';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        playerPos.col * cellSize,
        playerPos.row * cellSize,
        cellSize,
        cellSize
      );

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, playerPos, npcPositions]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => togglePanel('minimap')}
        className={`absolute top-4 right-16 z-20 rounded-lg border p-2 shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? 'bg-amber-900/80 border-amber-400/60'
            : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90'
        }`}
        title="Map (M)"
        aria-label="Toggle minimap"
      >
        <div className="text-amber-400 font-bold text-xs flex items-center gap-1">
          <span className="text-sm">🗺️</span> Map
        </div>
      </button>

      {/* Minimap panel */}
      {isOpen && (
        <div className="absolute top-16 right-16 z-50 rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
                <span className="text-base">🗺️</span> San Diego Plaza
              </h3>
              <div className="text-white/40 text-[10px] mt-0.5">1887 town map</div>
            </div>
            <button
              onClick={() => togglePanel('minimap')}
              className="w-7 h-7 rounded-md hover:bg-stone-800 text-white/60 hover:text-white text-sm flex items-center justify-center"
              aria-label="Close map"
            >
              ✕
            </button>
          </div>
          <div className="rounded-lg overflow-hidden border border-amber-400/20 bg-black">
            <canvas
              ref={canvasRef}
              className="block"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          {/* Legend */}
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow shadow-green-400/50" />
              <span className="text-white/70">You</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <span className="text-white/70">NPC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="text-white/70">Ibarra</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-gray-500" />
              <span className="text-white/70">Building</span>
            </div>
          </div>
          {/* Coordinates */}
          <div className="mt-2 pt-2 border-t border-amber-400/10 text-[10px] text-white/40 font-mono text-center">
            Position: ({playerPos.col}, {playerPos.row})
          </div>
        </div>
      )}
    </>
  );
}

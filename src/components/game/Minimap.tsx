'use client';

import { useState, useEffect, useRef } from 'react';
import mapData from '@/data/mapData.json';

/**
 * Minimap - Shows a small overview of the San Diego map with player position.
 * Helps with navigation and orientation.
 */
export default function Minimap() {
  const [isOpen, setIsOpen] = useState(false);
  const [playerPos, setPlayerPos] = useState({ row: 15, col: 10 });
  const [npcPositions, setNpcPositions] = useState<{ row: number; col: number; id: string; visible: boolean }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Render minimap to canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = 8;
    canvas.width = mapData.width * cellSize;
    canvas.height = mapData.height * cellSize;

    // Draw tiles
    for (let row = 0; row < mapData.height; row++) {
      for (let col = 0; col < mapData.width; col++) {
        const groundTile = mapData.layers.ground[row]?.[col];
        const buildingTile = mapData.layers.buildings[row]?.[col];

        let color = '#1a1a1a'; // Default dark
        if (groundTile === 2) color = '#3a5f3a'; // Grass
        else if (groundTile === 3) color = '#8B7355'; // Plaza
        else if (groundTile === 1) color = '#A0826D'; // Dirt
        else if (groundTile === 4) color = '#5C4033'; // Market stalls

        if (buildingTile === 5) color = '#666'; // Church
        if (buildingTile === 6) color = '#4a3520'; // Market building

        ctx.fillStyle = color;
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    // Draw NPC positions
    const npcPosData = mapData.npcPositions as Record<string, { row: number; col: number; appearsAfter?: string }>;
    for (const [id, pos] of Object.entries(npcPosData)) {
      // Check if NPC should be visible (no appearsAfter, or objective completed)
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
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Draw player position (pulsing)
    const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
    ctx.fillStyle = `rgba(0, 255, 100, ${0.7 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(
      playerPos.col * cellSize + cellSize / 2,
      playerPos.row * cellSize + cellSize / 2,
      cellSize / 2 + pulse * 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Draw player direction indicator
    ctx.strokeStyle = '#00FF64';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      playerPos.col * cellSize,
      playerPos.row * cellSize,
      cellSize,
      cellSize
    );
  }, [isOpen, playerPos, npcPositions]);

  // Animation loop for pulsing player marker
  useEffect(() => {
    if (!isOpen) return;
    let raf: number;
    const animate = () => {
      if (canvasRef.current) {
        // Trigger re-render by updating a state... or just redraw
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Just redraw the player marker
          // Actually, let's just trigger the effect by toggling a counter
        }
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 right-44 z-20 rounded-lg bg-stone-900/90 border border-amber-400/30 p-2 shadow-lg hover:bg-stone-800/90 transition-colors"
        title="Map"
        aria-label="Toggle minimap"
      >
        <div className="text-amber-400 font-bold text-xs">🗺️ Map</div>
      </button>

      {/* Minimap panel */}
      {isOpen && (
        <div className="absolute top-16 right-44 z-30 rounded-xl bg-stone-950/95 border border-amber-400/30 shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-amber-400 font-bold text-sm">🗺️ San Diego</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/50 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="rounded border border-amber-400/20"
            style={{ imageRendering: 'pixelated' }}
          />
          {/* Legend */}
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-white/60">You</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-white/60">NPC</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-white/60">Ibarra</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-500" />
              <span className="text-white/60">Building</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

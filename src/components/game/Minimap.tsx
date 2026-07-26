'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIStore } from './UIManager';
import mapData from '@/data/mapData.json';

/**
 * Minimap - Enhanced overview of the San Diego map with player position,
 * building labels, detailed tile colors, and visual polish.
 */
export default function Minimap() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'minimap';
  const [playerPos, setPlayerPos] = useState({ row: 15, col: 10 });
  const [playerDirection, setPlayerDirection] = useState<string>('south');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // Listen for player position updates via custom event
  useEffect(() => {
    const handlePositionUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.playerPos) setPlayerPos(detail.playerPos);
      if (detail?.playerDirection) setPlayerDirection(detail.playerDirection);
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

  // Building label positions (key landmarks on the map)
  const buildingLabels: { row: number; col: number; name: string; color: string }[] = [
    { row: 2, col: 10, name: 'Church', color: '#E8E0D0' },
    { row: 3, col: 4, name: 'Convent', color: '#C9B896' },
    { row: 4, col: 15, name: 'Tiago House', color: '#FFD700' },
    { row: 8, col: 8, name: 'Fountain', color: '#7CB9E8' },
    { row: 13, col: 5, name: 'Market', color: '#FF6B35' },
    { row: 1, col: 14, name: 'Ibarra House', color: '#D4A574' },
  ];

  // Render minimap to canvas (continuous animation while open)
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = 12;
    const canvasW = mapData.width * cellSize;
    const canvasH = mapData.height * cellSize;
    canvas.width = canvasW;
    canvas.height = canvasH;

    let lastDraw = 0;

    const draw = (t: number) => {
      if (t - lastDraw < 80) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDraw = t;

      // Clear with dark background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Draw tiles with enhanced colors and subtle borders
      for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
          const groundTile = mapData.layers.ground[row]?.[col];
          const buildingTile = mapData.layers.buildings[row]?.[col];
          const decorTile = mapData.layers.decoration[row]?.[col];

          let color = '#1a1a1a';
          let borderColor = '#222222';

          if (groundTile === 2) { color = '#3a5f3a'; borderColor = '#4a6f4a'; }
          else if (groundTile === 3) { color = '#8B7355'; borderColor = '#9B8365'; }
          else if (groundTile === 1) { color = '#A0826D'; borderColor = '#B0927D'; }
          else if (groundTile === 4) { color = '#5C4033'; borderColor = '#6C5043'; }

          // Buildings
          if (buildingTile === 5) { color = '#555555'; borderColor = '#666666'; }
          if (buildingTile === 6) { color = '#4a3520'; borderColor = '#5a4530'; }

          // Decorations
          if (decorTile === 7) { color = '#7CB9E8'; borderColor = '#8CC9F8'; } // Fountain/water
          if (decorTile === 8) { color = '#2d4a2d'; borderColor = '#3d5a3d'; } // Trees

          ctx.fillStyle = color;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);

          // Subtle grid lines
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }

      // Draw building labels
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      for (const label of buildingLabels) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const textWidth = ctx.measureText(label.name).width;
        ctx.fillRect(
          label.col * cellSize + cellSize / 2 - textWidth / 2 - 2,
          label.row * cellSize - 2,
          textWidth + 4,
          10
        );
        ctx.fillStyle = label.color;
        ctx.fillText(label.name, label.col * cellSize + cellSize / 2, label.row * cellSize + 6);
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
          const npcColor = id === 'ibara' ? '#FFD700' : '#FF6B35';
          // NPC glow
          ctx.fillStyle = id === 'ibara' ? 'rgba(255,215,0,0.2)' : 'rgba(255,107,53,0.2)';
          ctx.beginPath();
          ctx.arc(
            pos.col * cellSize + cellSize / 2,
            pos.row * cellSize + cellSize / 2,
            cellSize / 2 + 3,
            0, Math.PI * 2
          );
          ctx.fill();
          // NPC dot
          ctx.fillStyle = npcColor;
          ctx.beginPath();
          ctx.arc(
            pos.col * cellSize + cellSize / 2,
            pos.row * cellSize + cellSize / 2,
            cellSize / 2 - 1,
            0, Math.PI * 2
          );
          ctx.fill();
        }
      }

      // Draw player position (pulsing glow)
      const pulse = (Math.sin(Date.now() / 250) + 1) / 2;
      const px = playerPos.col * cellSize + cellSize / 2;
      const py = playerPos.row * cellSize + cellSize / 2;

      // Outer glow ring
      ctx.fillStyle = `rgba(0, 255, 100, ${0.15 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.arc(px, py, cellSize / 2 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();

      // Player dot
      ctx.fillStyle = `rgba(0, 255, 100, ${0.85 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.arc(px, py, cellSize / 2 - 1, 0, Math.PI * 2);
      ctx.fill();

      // Direction indicator arrow
      const dirOffsets: Record<string, { dx: number; dy: number }> = {
        'north': { dx: 0, dy: -3 },
        'south': { dx: 0, dy: 3 },
        'east': { dx: 3, dy: 0 },
        'west': { dx: -3, dy: 0 },
        'north-east': { dx: 2, dy: -2 },
        'north-west': { dx: -2, dy: -2 },
        'south-east': { dx: 2, dy: 2 },
        'south-west': { dx: -2, dy: 2 },
      };
      const dirOffset = dirOffsets[playerDirection] || dirOffsets['south'];
      ctx.strokeStyle = '#00FF64';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dirOffset.dx, py + dirOffset.dy);
      ctx.stroke();

      // Player square outline
      ctx.strokeStyle = '#00FF64';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        playerPos.col * cellSize + 1,
        playerPos.row * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, playerPos, playerDirection]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-50 rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 p-3 animate-panel-slide-in max-w-[calc(100vw-2rem)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
            <span className="text-base">🗺️</span> San Diego Plaza
          </h3>
          <div className="text-white/40 text-[10px] mt-0.5">1887 town map · <span className="text-amber-400/50">Chapter 1</span></div>
        </div>
        <button
          onClick={() => togglePanel('minimap')}
          className="close-btn-styled w-7 h-7 rounded-md bg-stone-800/40 text-white/60 text-sm flex items-center justify-center"
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
      {/* Enhanced legend */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow shadow-green-400/50 animate-pulse" />
          <span className="text-white/70">You (player)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
          <span className="text-white/70">NPC (Mang Tenyo)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow shadow-yellow-400/40" />
          <span className="text-white/70">Ibarra (sighted)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-gray-500" />
          <span className="text-white/70">Building</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-blue-400" />
          <span className="text-white/70">Fountain/Water</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-emerald-700" />
          <span className="text-white/70">Trees/Garden</span>
        </div>
      </div>
      {/* Coordinates and direction */}
      <div className="mt-2 pt-2 border-t border-amber-400/10 flex items-center justify-between text-[10px]">
        <div className="text-white/40 font-mono">
          Position: ({playerPos.col}, {playerPos.row})
        </div>
        <div className="text-amber-400/50 font-mono capitalize">
          Facing: {playerDirection}
        </div>
      </div>
    </div>
  );
}

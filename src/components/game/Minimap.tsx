'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIStore } from './UIManager';
import { useGameStore } from '@/stores/gameStore';
import mapData from '@/data/mapData.json';
import characterData from '@/data/characters.json';

/**
 * Minimap - Enhanced overview of the San Diego map with building labels,
 * NPC markers, discovery markers, compass, zoom levels, and visual polish.
 */

// Zoom level cell sizes
const ZOOM_LEVELS: Record<string, { cellSize: number; label: string }> = {
  'small':  { cellSize: 8,  label: 'S' },
  'medium': { cellSize: 12, label: 'M' },
  'large':  { cellSize: 16, label: 'L' },
};

// NPC color mapping from characters.json
const NPC_COLORS: Record<string, string> = {};
for (const [id, char] of Object.entries(characterData.characters)) {
  if (char.placeholder && char.placeholderColor) {
    NPC_COLORS[id] = char.placeholderColor;
  } else if (id === 'ibara') {
    NPC_COLORS[id] = '#FFD700'; // Gold for Ibarra
  }
}
// Fallback for known NPC ids not in characters
NPC_COLORS['mang-tenyo'] = NPC_COLORS['mang-tenyo'] || '#8B4513';
NPC_COLORS['kitchen-staff-1'] = NPC_COLORS['kitchen-staff-1'] || '#D2691E';
NPC_COLORS['kitchen-staff-2'] = NPC_COLORS['kitchen-staff-2'] || '#CD853F';
NPC_COLORS['ibara'] = NPC_COLORS['ibara'] || '#FFD700';

export default function Minimap() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'minimap';
  const { completedObjectives } = useGameStore();

  const [playerPos, setPlayerPos] = useState({ row: 15, col: 10 });
  const [playerDirection, setPlayerDirection] = useState<string>('south');
  const [zoomLevel, setZoomLevel] = useState<string>('medium');
  // Lazy initializer: load discovered locations from localStorage on first render
  const [discoveredLocations, setDiscoveredLocations] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('noor-discovered-locations');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Ignore
    }
    return [];
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const discoveredRef = useRef(discoveredLocations);
  // Keep ref in sync with state via effect (not during render)
  useEffect(() => {
    discoveredRef.current = discoveredLocations;
  }, [discoveredLocations]);

  // Listen for player position updates and check for discoveries in callback
  useEffect(() => {
    const handlePositionUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.playerPos) setPlayerPos(detail.playerPos);
      if (detail?.playerDirection) setPlayerDirection(detail.playerDirection);
    };
    window.addEventListener('noor:positionUpdate', handlePositionUpdate);

    // Poll player position from save data every 500ms
    // Discovery check is done within the polling callback (not directly in effect body)
    const interval = setInterval(() => {
      try {
        const save = localStorage.getItem('noor-save');
        if (save) {
          const data = JSON.parse(save);
          if (data.gameState?.playerPosition) {
            const pos = data.gameState.playerPosition;
            setPlayerPos(pos);

            // Check for location discovery within this callback
            const buildingLabelsData = mapData.buildingLabels;
            const currentDiscoveries = discoveredRef.current;
            const newDiscoveries: string[] = [];

            for (const building of buildingLabelsData) {
              const centerRow = building.row + Math.floor(building.height / 2);
              const centerCol = building.col + Math.floor(building.width / 2);
              const dist = Math.abs(pos.row - centerRow) + Math.abs(pos.col - centerCol);

              if (dist <= 3 && !currentDiscoveries.includes(building.label)) {
                newDiscoveries.push(building.label);
              }
            }

            if (newDiscoveries.length > 0) {
              const updated = [...currentDiscoveries, ...newDiscoveries];
              setDiscoveredLocations(updated);
              discoveredRef.current = updated;
              try {
                localStorage.setItem('noor-discovered-locations', JSON.stringify(updated));
              } catch (e) {
                // Ignore
              }

              // Dispatch 'noor:discovery' events so the DiscoveryLogPanel
              // (and any other listener) can record full discovery metadata.
              for (const building of buildingLabelsData) {
                if (newDiscoveries.includes(building.label)) {
                  const centerRow = building.row + Math.floor(building.height / 2);
                  const centerCol = building.col + Math.floor(building.width / 2);
                  window.dispatchEvent(new CustomEvent('noor:discovery', {
                    detail: {
                      id: `bldg-${building.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                      name: building.label,
                      type: 'building',
                      position: { x: centerCol, y: centerRow },
                      timestamp: Date.now(),
                      note: building.sublabel || undefined,
                    },
                  }));
                }
              }
            }
          }
          if (data.gameState?.playerDirection) {
            setPlayerDirection(data.gameState.playerDirection);
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

    const { cellSize } = ZOOM_LEVELS[zoomLevel];
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

          let color = '#1a1a1a';
          let borderColor = '#222222';

          if (groundTile === 2) { color = '#3a5f3a'; borderColor = '#4a6f4a'; }
          else if (groundTile === 3) { color = '#8B7355'; borderColor = '#9B8365'; }
          else if (groundTile === 1) { color = '#C4A76C'; borderColor = '#D4B77C'; }
          else if (groundTile === 4) { color = '#A0522D'; borderColor = '#B0623D'; }

          // Buildings
          if (buildingTile === 5) { color = '#696969'; borderColor = '#797979'; }
          if (buildingTile === 6) { color = '#8B4513'; borderColor = '#9B5523'; }

          ctx.fillStyle = color;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);

          // Subtle grid lines
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 0.3;
          ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }

      // Draw fountain/water and trees from decoration layer
      const decorationLayer = (mapData.layers as any).decoration;
      if (decorationLayer) {
        for (let row = 0; row < mapData.height; row++) {
          for (let col = 0; col < mapData.width; col++) {
            const decorTile = decorationLayer[row]?.[col];
            if (decorTile === 7) {
              ctx.fillStyle = '#7CB9E8';
              ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
            }
            if (decorTile === 8) {
              ctx.fillStyle = '#2d4a2d';
              ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
            }
          }
        }
      }

      // ---- Building Labels from mapData.buildingLabels ----
      const buildingLabelsData = mapData.buildingLabels;
      const fontSize = zoomLevel === 'large' ? 9 : zoomLevel === 'medium' ? 7 : 6;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';

      for (const building of buildingLabelsData) {
        const centerRow = building.row + Math.floor(building.height / 2);
        const centerCol = building.col + Math.floor(building.width / 2);
        const centerX = centerCol * cellSize + cellSize / 2;
        const centerY = centerRow * cellSize + cellSize / 2;

        // Background rectangle for label
        const label = building.label;
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(
          centerX - textWidth / 2 - 2,
          centerY - fontSize / 2 - 1,
          textWidth + 4,
          fontSize + 2
        );

        // Label text - white/amber
        ctx.fillStyle = '#E8D0A0';
        ctx.fillText(label, centerX, centerY + fontSize / 2 - 1);

        // Sublabel if present
        if (building.sublabel && zoomLevel !== 'small') {
          const subFontSize = fontSize - 1;
          ctx.font = `${subFontSize}px monospace`;
          const subWidth = ctx.measureText(building.sublabel).width;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(
            centerX - subWidth / 2 - 1,
            centerY + fontSize / 2 + 1,
            subWidth + 2,
            subFontSize + 1
          );
          ctx.fillStyle = '#A08060';
          ctx.fillText(building.sublabel, centerX, centerY + fontSize / 2 + subFontSize + 1);
          ctx.font = `bold ${fontSize}px monospace`;
        }

        // Discovery marker ✦ if player has been near
        if (discoveredLocations.includes(building.label)) {
          const discoveryFontSize = fontSize + 2;
          ctx.font = `bold ${discoveryFontSize}px serif`;
          ctx.fillStyle = '#FFD700';
          ctx.textAlign = 'right';
          ctx.fillText('✦', centerX + textWidth / 2 + 2, centerY - fontSize / 2 - 2);
          ctx.textAlign = 'center';
          ctx.font = `bold ${fontSize}px monospace`;
        }
      }

      // ---- NPC Position Markers ----
      const npcPosData = mapData.npcPositions as Record<string, { row: number; col: number; direction: string; appearsAfter?: string }>;
      for (const [id, pos] of Object.entries(npcPosData)) {
        let visible = true;
        if (pos.appearsAfter) {
          visible = completedObjectives.includes(pos.appearsAfter);
        }

        if (visible) {
          const npcColor = NPC_COLORS[id] || '#FF6B35';
          const npcX = pos.col * cellSize + cellSize / 2;
          const npcY = pos.row * cellSize + cellSize / 2;
          const npcRadius = cellSize / 2 - 1;

          // NPC glow
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = npcColor;
          ctx.beginPath();
          ctx.arc(npcX, npcY, npcRadius + 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;

          // NPC dot
          ctx.fillStyle = npcColor;
          ctx.beginPath();
          ctx.arc(npcX, npcY, npcRadius, 0, Math.PI * 2);
          ctx.fill();

          // Small white center highlight
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(npcX, npcY, Math.max(1, npcRadius - 2), 0, Math.PI * 2);
          ctx.fill();

          // NPC name label on medium/large zoom
          if (zoomLevel !== 'small') {
            const charInfo = characterData.characters[id as keyof typeof characterData.characters];
            const displayName = charInfo?.displayName || id;
            const nameFontSize = zoomLevel === 'large' ? 7 : 5;
            ctx.font = `${nameFontSize}px monospace`;
            ctx.textAlign = 'center';
            const nameWidth = ctx.measureText(displayName).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(npcX - nameWidth / 2 - 1, npcY - npcRadius - nameFontSize - 3, nameWidth + 2, nameFontSize + 2);
            ctx.fillStyle = npcColor;
            ctx.fillText(displayName, npcX, npcY - npcRadius - 2);
          }
        }
      }

      // ---- Player Position (pulsing amber/yellow) ----
      const pulse = (Math.sin(Date.now() / 250) + 1) / 2;
      const px = playerPos.col * cellSize + cellSize / 2;
      const py = playerPos.row * cellSize + cellSize / 2;
      const playerRadius = cellSize / 2;

      // Outer glow ring (amber/yellow pulsing)
      ctx.globalAlpha = 0.15 + pulse * 0.15;
      ctx.fillStyle = '#FFC107';
      ctx.beginPath();
      ctx.arc(px, py, playerRadius + pulse * 4, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow
      ctx.globalAlpha = 0.3 + pulse * 0.1;
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.arc(px, py, playerRadius + 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;

      // Player dot (bright amber)
      ctx.fillStyle = `rgba(255, 193, 7, ${0.85 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.arc(px, py, playerRadius - 1, 0, Math.PI * 2);
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
      ctx.strokeStyle = '#FFC107';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dirOffset.dx, py + dirOffset.dy);
      ctx.stroke();

      // Player square outline (amber)
      ctx.strokeStyle = '#FFC107';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        playerPos.col * cellSize + 1,
        playerPos.row * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );

      // ---- Compass Indicator ----
      const compassX = canvasW - cellSize * 2;
      const compassY = cellSize;
      const compassR = cellSize * 0.8;

      // Compass circle background
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(compassX, compassY, compassR + 2, 0, Math.PI * 2);
      ctx.fill();

      // Compass circle border
      ctx.strokeStyle = '#D4A574';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(compassX, compassY, compassR, 0, Math.PI * 2);
      ctx.stroke();

      // Compass needle pointing north
      ctx.fillStyle = '#FFC107';
      ctx.beginPath();
      ctx.moveTo(compassX, compassY - compassR + 2);
      ctx.lineTo(compassX - 2, compassY);
      ctx.lineTo(compassX + 2, compassY);
      ctx.closePath();
      ctx.fill();

      // South needle (darker)
      ctx.fillStyle = '#5A3A1A';
      ctx.beginPath();
      ctx.moveTo(compassX, compassY + compassR - 2);
      ctx.lineTo(compassX - 2, compassY);
      ctx.lineTo(compassX + 2, compassY);
      ctx.closePath();
      ctx.fill();

      // Compass labels
      const compassFontSize = Math.max(4, cellSize * 0.4);
      ctx.font = `bold ${compassFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFC107';
      ctx.fillText('N', compassX, compassY - compassR - compassFontSize / 2);
      ctx.fillStyle = '#8B7355';
      ctx.fillText('S', compassX, compassY + compassR + compassFontSize / 2);
      ctx.fillText('E', compassX + compassR + compassFontSize / 2, compassY);
      ctx.fillText('W', compassX - compassR - compassFontSize / 2, compassY);
      ctx.textBaseline = 'alphabetic';

      // ---- "San Diego — 1887" watermark ----
      const watermarkFontSize = Math.max(6, cellSize * 0.55);
      ctx.font = `italic ${watermarkFontSize}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(212, 165, 116, 0.25)';
      ctx.fillText('San Diego — 1887', canvasW / 2, canvasH - cellSize);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, playerPos, playerDirection, zoomLevel, discoveredLocations, completedObjectives]);

  if (!isOpen) return null;

  const { cellSize } = ZOOM_LEVELS[zoomLevel];
  const canvasW = mapData.width * cellSize;
  const canvasH = mapData.height * cellSize;

  return (
    <div className="absolute top-16 right-4 z-50 animate-panel-slide-in max-w-[calc(100vw-2rem)]">
      {/* Decorative amber border wrapper */}
      <div className="rounded-xl bg-stone-950/97 shadow-2xl shadow-amber-950/30 overflow-hidden">
        {/* Ornamental top border — filipino weaving-inspired pattern */}
        <div className="h-[3px] bg-gradient-to-r from-amber-600/0 via-amber-500 to-amber-600/0" />

        <div className="p-3">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
                <span className="text-base">🗺️</span> San Diego Plaza
              </h3>
              <div className="text-white/40 text-[10px] mt-0.5">
                1887 town map · <span className="text-amber-400/50">Chapter 1</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom toggle buttons */}
              <div className="flex gap-1">
                {(['small', 'medium', 'large'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setZoomLevel(level)}
                    className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
                      zoomLevel === level
                        ? 'bg-amber-500 text-stone-900 shadow shadow-amber-400/50'
                        : 'bg-stone-800/60 text-white/50 hover:bg-stone-700/60 hover:text-white/70'
                    }`}
                    aria-label={`Zoom ${level}`}
                  >
                    {ZOOM_LEVELS[level].label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => togglePanel('minimap')}
                className="close-btn-styled w-7 h-7 rounded-md bg-stone-800/40 text-white/60 text-sm flex items-center justify-center"
                aria-label="Close map"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Canvas with decorative amber border */}
          <div className="rounded-lg overflow-hidden border-2 border-amber-500/30 bg-black shadow-inner shadow-amber-900/20">
            <canvas
              ref={canvasRef}
              className="block"
              style={{ imageRendering: 'pixelated', width: canvasW, height: canvasH }}
            />
          </div>

          {/* Enhanced legend */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow shadow-amber-400/50 animate-pulse" />
              <span className="text-white/70">You (player)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8B4513' }} />
              <span className="text-white/70">Mang Tenyo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#D2691E' }} />
              <span className="text-white/70">Aling Nena</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#CD853F' }} />
              <span className="text-white/70">Mang Andres</span>
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
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 text-[8px]">✦</span>
              <span className="text-white/70">Discovered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-200" />
              <span className="text-white/70">Town Path</span>
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

          {/* Discovery counter */}
          <div className="mt-1 flex items-center gap-2 text-[10px]">
            <span className="text-amber-400/60">✦ Discovered:</span>
            <span className="text-white/50 font-mono">
              {discoveredLocations.length}/{mapData.buildingLabels.length} locations
            </span>
          </div>
        </div>

        {/* Ornamental bottom border */}
        <div className="h-[3px] bg-gradient-to-r from-amber-600/0 via-amber-500 to-amber-600/0" />
      </div>
    </div>
  );
}

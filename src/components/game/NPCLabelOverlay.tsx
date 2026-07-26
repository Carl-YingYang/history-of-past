'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import mapData from '@/data/mapData.json';
import characterData from '@/data/characters.json';

/**
 * NPCLabelOverlay - Shows floating name labels above NPCs when the player
 * is within a certain radius. Labels fade in/out smoothly and show a
 * "press Space to talk" hint when very close and the NPC has dialogue.
 *
 * Positioned absolutely within the <main> game area. Calculates screen
 * positions by computing tile offsets from the player and mapping them
 * to screen coordinates based on the canvas dimensions.
 */

const TILE_SIZE = 48; // Same as mapData.tileSize
const LABEL_RADIUS = 3; // Tiles within which labels appear
const INTERACT_RADIUS = 1.5; // Tiles within which "press Space" hint appears
const LABEL_OFFSET_Y = -40; // Pixels above NPC sprite center for label position

// NPC display names and colors from characters.json
const NPC_META: Record<string, { displayName: string; color: string }> = {};
for (const [id, char] of Object.entries(characterData.characters)) {
  if (id === 'student') continue; // Skip player
  NPC_META[id] = {
    displayName: char.displayName || id,
    color: char.placeholderColor || '#FFD700',
  };
}

// NPC dialogue availability (from trigger zones in mapData)
const NPC_DIALOGUE: Record<string, boolean> = {};
for (const zone of mapData.triggerZones) {
  if (zone.dialogueId && zone.npcId) {
    NPC_DIALOGUE[zone.npcId] = true;
  }
}
// Also mark NPCs with direct dialogue triggers
NPC_DIALOGUE['mang-tenyo'] = true;
NPC_DIALOGUE['kitchen-staff-1'] = true;
NPC_DIALOGUE['kitchen-staff-2'] = true;

interface NPCLabelInfo {
  id: string;
  displayName: string;
  color: string;
  tileRow: number;
  tileCol: number;
  distance: number;
  screenX: number;
  screenY: number;
  showInteractHint: boolean;
}

export default function NPCLabelOverlay() {
  const { completedObjectives, dialogueActive, chapterComplete } = useGameStore();
  const [playerPos, setPlayerPos] = useState({ row: 15, col: 10 });
  const [canvasRect, setCanvasRect] = useState<{ width: number; height: number } | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // Track player position from save data
  useEffect(() => {
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
    }, 300);

    // Also listen for custom position update events
    const handlePositionUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.playerPos) setPlayerPos(detail.playerPos);
    };
    window.addEventListener('noor:positionUpdate', handlePositionUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('noor:positionUpdate', handlePositionUpdate);
    };
  }, []);

  // Measure the game canvas container dimensions
  useEffect(() => {
    const measure = () => {
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainRef.current = mainEl as HTMLElement;
        const rect = mainEl.getBoundingClientRect();
        setCanvasRect({ width: rect.width, height: rect.height });
      }
    };

    measure();
    window.addEventListener('resize', measure);

    // Re-measure periodically since layout may change
    const interval = setInterval(measure, 1000);

    return () => {
      window.removeEventListener('resize', measure);
      clearInterval(interval);
    };
  }, []);

  // Compute label positions for visible NPCs using useMemo (no setState in effect)
  const labels = useMemo<NPCLabelInfo[]>(() => {
    if (!canvasRect) return [];

    const npcPosData = mapData.npcPositions as Record<string, { row: number; col: number; direction: string; appearsAfter?: string }>;
    const computedLabels: NPCLabelInfo[] = [];

    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;

    for (const [id, pos] of Object.entries(npcPosData)) {
      // Check if NPC is visible (appearsAfter condition)
      let npcVisible = true;
      if (pos.appearsAfter) {
        npcVisible = completedObjectives.includes(pos.appearsAfter);
      }

      if (!npcVisible) continue;

      // Calculate distance from player to NPC in tile units
      const dx = pos.col - playerPos.col;
      const dy = pos.row - playerPos.row;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only show label if within radius
      if (distance > LABEL_RADIUS) continue;

      // Compute screen position
      const screenX = centerX + dx * TILE_SIZE;
      const screenY = centerY + dy * TILE_SIZE + LABEL_OFFSET_Y;

      // Check if label would be on-screen
      if (screenX < -50 || screenX > canvasRect.width + 50 || screenY < -50 || screenY > canvasRect.height + 50) continue;

      const meta = NPC_META[id] || { displayName: id, color: '#FFD700' };

      computedLabels.push({
        id,
        displayName: meta.displayName,
        color: meta.color,
        tileRow: pos.row,
        tileCol: pos.col,
        distance,
        screenX,
        screenY,
        showInteractHint: distance <= INTERACT_RADIUS && !!NPC_DIALOGUE[id],
      });
    }

    return computedLabels;
  }, [playerPos, canvasRect, completedObjectives]);

  // Don't show labels during dialogue or chapter completion
  if (dialogueActive || chapterComplete) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {labels.map((label) => (
        <div
          key={label.id}
          className="absolute pointer-events-none transition-all duration-300 ease-out"
          style={{
            left: `${label.screenX}px`,
            top: `${label.screenY}px`,
            transform: 'translate(-50%, -100%)',
            opacity: 1 - Math.max(0, (label.distance - INTERACT_RADIUS) / (LABEL_RADIUS - INTERACT_RADIUS)) * 0.5,
          }}
        >
          {/* Name label with colored background */}
          <div
            className="px-2 py-0.5 rounded-sm text-center whitespace-nowrap"
            style={{
              backgroundColor: `${label.color}33`, // 20% opacity background
              borderColor: `${label.color}66`,
              borderWidth: '1px',
              borderStyle: 'solid',
              color: label.color,
              fontSize: '11px',
              fontWeight: '600',
              fontFamily: 'monospace',
              boxShadow: `0 0 8px ${label.color}22`,
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {label.displayName}
          </div>

          {/* "Press Space to talk" hint when very close */}
          {label.showInteractHint && (
            <div
              className="mt-0.5 text-center animate-pulse"
              style={{
                fontSize: '9px',
                color: '#FFC107',
                fontFamily: 'monospace',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              }}
            >
              Space — talk
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

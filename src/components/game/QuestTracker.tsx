'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import quests from '@/data/quests.json';
import mapData from '@/data/mapData.json';
import { Progress } from '@/components/ui/progress';

// Objective icon mapping based on objective type
const OBJECTIVE_ICONS: Record<string, string> = {
  'obj.ch1.follow_tenyo': '👣',       // footsteps — follow
  'obj.ch1.overhear_gossip': '👂',    // ear — gossip/listen
  'obj.ch1.see_ibarra': '👁️',        // eye — sighting
};

// Next-step hint text for each objective
const OBJECTIVE_HINTS: Record<string, { where: string; how: string; dir: string }> = {
  'obj.ch1.follow_tenyo': {
    where: 'Town Entrance',
    how: 'Walk up to Mang Tenyo near the cart and press Space to greet him.',
    dir: 'south',
  },
  'obj.ch1.overhear_gossip': {
    where: 'Market / Stalls',
    how: 'Wander into the market area (southwest). The kitchen staff will gossip when you get close.',
    dir: 'south-west',
  },
  'obj.ch1.see_ibarra': {
    where: 'Town Plaza',
    how: 'Walk to the central plaza (near the fountain) the next morning. Stay alert — Ibarra will appear briefly.',
    dir: 'north',
  },
};

// Objective world location (used for the directional compass arrow)
const OBJECTIVE_COORDS: Record<string, { row: number; col: number }> = {
  'obj.ch1.follow_tenyo':    { row: 14, col: 8 },
  'obj.ch1.overhear_gossip': { row: 9,  col: 4 },
  'obj.ch1.see_ibarra':      { row: 7,  col: 9 },
};

function getObjectiveIcon(objId: string): string {
  return OBJECTIVE_ICONS[objId] || '○';
}

// Compute a cardinal direction string from player position to target tile
function getCardinalDirection(
  playerRow: number, playerCol: number,
  targetRow: number, targetCol: number
): { arrow: string; label: string } {
  const dRow = targetRow - playerRow;
  const dCol = targetCol - playerCol;
  // Avoid divide-by-zero; just use sign
  const angle = Math.atan2(dRow, dCol); // Note: row grows downward
  // Convert to compass degrees (0 = east, going counterclockwise)
  // But for compass: 0 = N, 90 = E, 180 = S, 270 = W
  // dRow>0 means target is south; dCol>0 means target is east
  const compassDeg = (Math.atan2(dCol, -dRow) * 180 / Math.PI + 360) % 360;
  const dirs = [
    { min: 337.5, max: 360, arrow: '↑', label: 'North' },
    { min: 0, max: 22.5, arrow: '↑', label: 'North' },
    { min: 22.5, max: 67.5, arrow: '↗', label: 'Northeast' },
    { min: 67.5, max: 112.5, arrow: '→', label: 'East' },
    { min: 112.5, max: 157.5, arrow: '↘', label: 'Southeast' },
    { min: 157.5, max: 202.5, arrow: '↓', label: 'South' },
    { min: 202.5, max: 247.5, arrow: '↙', label: 'Southwest' },
    { min: 247.5, max: 292.5, arrow: '←', label: 'West' },
    { min: 292.5, max: 337.5, arrow: '↖', label: 'Northwest' },
  ];
  const found = dirs.find(d => compassDeg >= d.min && compassDeg < d.max);
  // Use angle to silence unused-variable lint (and for distance display)
  void angle;
  return found || { arrow: '·', label: 'Here' };
}

export default function QuestTracker() {
  const { completedObjectives, chapterComplete, chapterPhase } = useGameStore();
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [playerPos, setPlayerPos] = useState({ row: 15, col: 10 });
  const [stats, setStats] = useState({ tilesExplored: 0, npcsTalkedTo: 0 });
  const prevCompletedRef = useRef(completedObjectives);

  const currentQuest = quests.find(q => q.chapterId === 'ch1');

  // Celebration animation — detect newly completed objectives (must be before any early return)
  useEffect(() => {
    const prev = prevCompletedRef.current;
    const newlyCompleted = completedObjectives.find(id => !prev.includes(id));
    if (newlyCompleted) {
      setCelebratingId(newlyCompleted);
      setTimeout(() => setCelebratingId(null), 1200);
    }
    prevCompletedRef.current = completedObjectives;
  }, [completedObjectives]);

  // Track player position from save data (for the directional compass)
  useEffect(() => {
    const fetchPos = () => {
      try {
        const save = localStorage.getItem('noor-save');
        if (save) {
          const data = JSON.parse(save);
          if (data.gameState?.playerPosition) {
            setPlayerPos(data.gameState.playerPosition);
          }
        }
      } catch {
        // ignore
      }
    };
    fetchPos();
    const interval = window.setInterval(fetchPos, 400);

    // Track exploration stats from localStorage (separate key, written by game engine)
    const fetchStats = () => {
      try {
        const raw = localStorage.getItem('noor-stats');
        if (raw) {
          const parsed = JSON.parse(raw);
          setStats({
            tilesExplored: parsed.tilesExplored ?? 0,
            npcsTalkedTo: parsed.npcsTalkedTo ?? 0,
          });
        }
      } catch {
        // ignore
      }
    };
    fetchStats();
    const statsInterval = window.setInterval(fetchStats, 1000);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(statsInterval);
    };
  }, []);

  if (!currentQuest || chapterComplete) return null;

  const completedCount = currentQuest.objectives.filter(obj =>
    completedObjectives.includes(obj.id)
  ).length;
  const totalCount = currentQuest.objectives.length;
  const progress = (completedCount / totalCount) * 100;

  // Find the current (next incomplete) objective
  const currentObjective = currentQuest.objectives.find(obj => !completedObjectives.includes(obj.id));
  const hint = currentObjective ? OBJECTIVE_HINTS[currentObjective.id] : null;
  const coords = currentObjective ? OBJECTIVE_COORDS[currentObjective.id] : null;

  // Phase label mapping for richer UI
  const phaseLabels: Record<string, string> = {
    'intro': 'Arrival',
    'explore': 'Exploring',
    'gossip': 'Listening',
    'ibarra-sighting': 'Morning',
    'complete': 'Complete',
  };
  const phaseLabel = phaseLabels[chapterPhase] || chapterPhase;

  // Compute compass direction to current objective
  const compass = coords
    ? getCardinalDirection(playerPos.row, playerPos.col, coords.row, coords.col)
    : null;
  const distTiles = coords
    ? Math.round(Math.sqrt(
        Math.pow(coords.row - playerPos.row, 2) +
        Math.pow(coords.col - playerPos.col, 2)
      ))
    : 0;

  return (
    <div className="absolute top-16 right-4 z-20 max-w-xs w-72 md:w-80">
      <div className="rounded-xl bg-stone-950/92 backdrop-blur-md border border-amber-400/30 p-3 shadow-2xl shadow-black/40 parchment-texture">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-400/20">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-amber-400/60 font-bold text-[9px] tracking-widest uppercase">Quest</span>
              <span className="text-white/30 text-[9px] uppercase tracking-wider">·</span>
              <span className="text-amber-400/50 text-[9px] uppercase tracking-wider">{phaseLabel}</span>
            </div>
            <div className="text-white text-sm font-semibold truncate" title={currentQuest.title} style={{ fontFamily: 'Georgia, serif' }}>
              {currentQuest.title}
            </div>
          </div>
          <div className="text-amber-400 font-mono text-xs ml-2 shrink-0 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-400/20">
            {completedCount}/{totalCount}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <Progress value={progress} className="h-1.5 bg-stone-800" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-amber-400/50 text-[9px]">{Math.round(progress)}% complete</span>
            <span className="text-white/30 text-[9px]">{completedCount} of {totalCount} objectives</span>
          </div>
        </div>

        {/* Objectives with icons */}
        <div className="space-y-1.5">
          {currentQuest.objectives.map((obj, idx) => {
            const isCompleted = completedObjectives.includes(obj.id);
            const isCurrent = !isCompleted && completedObjectives.length === idx;
            const isCelebrating = celebratingId === obj.id;
            const objIcon = getObjectiveIcon(obj.id);
            return (
              <div
                key={obj.id}
                className={`relative flex items-start gap-2 text-xs p-1.5 rounded transition-all ${
                  isCurrent ? 'bg-amber-400/10 border border-amber-400/30 shadow-inner shadow-amber-900/20' : ''
                } ${isCelebrating ? 'animate-celebration-glow' : ''}`}
              >
                {/* Objective icon */}
                <span className={`mt-0.5 shrink-0 w-4 text-center ${
                  isCompleted ? 'text-emerald-400' : isCurrent ? 'text-amber-400 animate-pulse' : 'text-white/30'
                }`}>
                  {isCompleted ? '✓' : objIcon}
                </span>
                <span className={`leading-snug ${
                  isCompleted
                    ? 'text-emerald-400/70 line-through'
                    : isCurrent
                      ? 'text-white/95'
                      : 'text-white/50'
                }`}>
                  {obj.description}
                </span>
                {/* Celebration sparkle on newly completed */}
                {isCelebrating && (
                  <span className="absolute -top-1 -right-1 animate-sparkle text-amber-400 text-sm">✨</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Next Step callout — directional hint to current objective */}
        {hint && compass && (
          <div className="mt-3 pt-2 border-t border-amber-400/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-amber-400/70 text-[9px] uppercase tracking-widest font-bold">📍 Next Step</span>
              <span className="ml-auto text-amber-400/40 text-[9px] font-mono">{distTiles} tiles away</span>
            </div>
            <div className="rounded-md bg-amber-950/30 border border-amber-400/20 p-2">
              <div className="flex items-center gap-2 mb-1">
                {/* Compass arrow */}
                <span className="text-amber-300 text-lg font-bold leading-none" title={compass.label}>
                  {compass.arrow}
                </span>
                <div className="min-w-0">
                  <div className="text-amber-300 text-[11px] font-semibold" style={{ fontFamily: 'Georgia, serif' }}>
                    {hint.where}
                  </div>
                  <div className="text-white/40 text-[9px] uppercase tracking-wider">{compass.label}</div>
                </div>
              </div>
              <div className="text-white/65 text-[10px] leading-relaxed italic" style={{ fontFamily: 'Georgia, serif' }}>
                {hint.how}
              </div>
            </div>
          </div>
        )}

        {/* Learning objective hint */}
        <div className="mt-3 pt-2 border-t border-amber-400/10">
          <div className="text-amber-400/40 text-[9px] uppercase tracking-widest mb-1 font-semibold">
            💡 Learning Goal
          </div>
          <div className="text-white/55 text-[10px] italic leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
            {currentQuest.learningObjective}
          </div>
        </div>

        {/* Reward preview */}
        <div className="mt-2 pt-2 border-t border-amber-400/10 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400/60">Reward:</span>
            <span className="text-amber-400">⭐ 60 XP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400/60">+</span>
            <span className="text-emerald-400">🏅 Medal</span>
          </div>
        </div>

        {/* Exploration stats — encourage thorough exploration */}
        <div className="mt-2 pt-2 border-t border-amber-400/10 grid grid-cols-2 gap-2 text-[9px]">
          <div className="flex items-center gap-1">
            <span className="text-amber-400/60">🗺️</span>
            <span className="text-white/40">Tiles:</span>
            <span className="text-amber-400/80 font-mono">{stats.tilesExplored}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-amber-400/60">💬</span>
            <span className="text-white/40">Talks:</span>
            <span className="text-amber-400/80 font-mono">{stats.npcsTalkedTo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mark mapData import as used (for future expansion)
void mapData;

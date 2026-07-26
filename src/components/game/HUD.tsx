'use client';

import { useGameStore } from '@/stores/gameStore';
import chapters from '@/data/chapters.json';

export default function HUD() {
  const { xp, chapterMedals, timeOfDay, chapterPhase, chapterComplete, showMedal, medalInfo } = useGameStore();

  const chapter = chapters.find(c => c.id === 'ch1');

  return (
    <>
      {/* Top HUD bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="rounded-lg bg-stone-900/80 border border-amber-400/20 px-4 py-2 flex items-center gap-6 text-sm shadow-lg">
          {/* XP counter */}
          <div className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">⭐</span>
            <span className="text-white/70">XP:</span>
            <span className="text-amber-400 font-bold">{xp}</span>
          </div>
          
          {/* Time of day */}
          <div className="flex items-center gap-1">
            <span className={timeOfDay === 'morning' ? 'text-yellow-300' : 'text-orange-400'}>
              {timeOfDay === 'morning' ? '🌅' : '☀️'}
            </span>
            <span className="text-white/70 text-xs capitalize">{timeOfDay}</span>
          </div>
          
          {/* Medal */}
          {chapterMedals.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-emerald-400">🏅</span>
              <span className="text-emerald-400 font-bold text-xs">{chapterMedals[0].medalName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10">
        <div className="text-white/30 text-xs text-center">
          WASD to move · Space to talk
        </div>
      </div>

      {/* Medal display animation */}
      {showMedal && medalInfo && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-40 animate-bounce">
          <div className="rounded-2xl bg-stone-900/95 border-2 border-amber-400/50 p-6 text-center shadow-2xl">
            <div className="text-6xl mb-3">🏅</div>
            <h2 className="text-amber-400 text-2xl font-bold mb-1">Chapter Medal Earned!</h2>
            <div className="text-white text-lg mb-2">{medalInfo.medalName}</div>
            <div className="text-white/60 text-sm">{medalInfo.medalDescription}</div>
          </div>
        </div>
      )}
    </>
  );
}

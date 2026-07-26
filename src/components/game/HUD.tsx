'use client';

import { useGameStore } from '@/stores/gameStore';
import chapters from '@/data/chapters.json';

export default function HUD() {
  const { xp, chapterMedals, timeOfDay, chapterPhase, chapterComplete, showMedal, medalInfo } = useGameStore();

  const chapter = chapters.find(c => c.id === 'ch1');
  const xpForNextLevel = 100;
  const xpProgress = Math.min(100, (xp % xpForNextLevel));

  return (
    <>
      {/* Bottom HUD bar - XP, Time, Medal */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="rounded-xl bg-stone-950/85 backdrop-blur-md border border-amber-400/30 px-4 py-2.5 flex items-center gap-4 text-sm shadow-2xl">
          {/* XP counter with progress bar */}
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 text-base">⭐</span>
              <span className="text-white/70 text-xs">XP</span>
              <span className="text-amber-400 font-bold">{xp}</span>
            </div>
            {/* XP Progress bar */}
            <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-amber-400/20" />

          {/* Time of day */}
          <div className="flex flex-col items-center min-w-[70px]">
            <div className="flex items-center gap-1.5">
              <span className={`text-base ${timeOfDay === 'morning' ? 'text-yellow-300' : 'text-orange-400'}`}>
                {timeOfDay === 'morning' ? '🌅' : '☀️'}
              </span>
              <span className="text-white/70 text-xs capitalize">{timeOfDay}</span>
            </div>
            <div className="text-white/30 text-[10px] mt-0.5">1887</div>
          </div>

          {/* Divider */}
          {chapterMedals.length > 0 && (
            <>
              <div className="w-px h-8 bg-amber-400/20" />
              {/* Medal */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 text-base">🏅</span>
                  <span className="text-emerald-400 font-bold text-xs">{chapterMedals[0].medalName}</span>
                </div>
                <div className="text-white/30 text-[10px] mt-0.5">Chapter Medal</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controls hint - only show when no dialogue active */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="text-white/30 text-xs text-center bg-stone-950/50 px-3 py-1 rounded-full">
          WASD / D-Pad to move · Space / 💬 to talk
        </div>
      </div>

      {/* Medal display animation */}
      {showMedal && medalInfo && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-40 animate-bounce">
          <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-amber-950 border-2 border-amber-400/60 p-6 text-center shadow-2xl min-w-[280px]">
            <div className="text-6xl mb-3 animate-pulse">🏅</div>
            <h2 className="text-amber-400 text-xl font-bold mb-1 tracking-wide">CHAPTER MEDAL EARNED!</h2>
            <div className="text-white text-lg mb-2 font-semibold">{medalInfo.medalName}</div>
            <div className="text-white/60 text-sm italic max-w-xs">{medalInfo.medalDescription}</div>
            {/* Decorative border */}
            <div className="mt-4 flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-400"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

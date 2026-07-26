'use client';

import { useGameStore } from '@/stores/gameStore';
import chapters from '@/data/chapters.json';

export default function HUD() {
  const { xp, chapterMedals, timeOfDay, chapterPhase, chapterComplete, showMedal, medalInfo } = useGameStore();

  const chapter = chapters.find(c => c.id === 'ch1');
  const xpForNextLevel = 100;
  const xpProgress = Math.min(100, (xp % xpForNextLevel));
  const hasMedal = chapterMedals.length > 0;

  return (
    <>
      {/* Bottom HUD bar - XP, Time, Medal */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="rounded-xl bg-stone-950/85 backdrop-blur-md border border-amber-400/30 px-3 py-2 flex items-center gap-3 text-sm shadow-2xl shadow-black/50">
          {/* XP counter with progress bar */}
          <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 text-sm">⭐</span>
              <span className="text-white/60 text-[10px] uppercase tracking-wider">XP</span>
              <span className="text-amber-400 font-bold text-sm tabular-nums">{xp}</span>
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
          <div className="flex flex-col items-center min-w-[68px]">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${timeOfDay === 'morning' ? 'text-yellow-300' : 'text-orange-400'}`}>
                {timeOfDay === 'morning' ? '🌅' : '☀️'}
              </span>
              <span className="text-white/80 text-xs capitalize font-medium">{timeOfDay}</span>
            </div>
            <div className="text-amber-400/40 text-[10px] mt-0.5 font-mono">1887</div>
          </div>

          {/* Divider */}
          {hasMedal && (
            <>
              <div className="w-px h-8 bg-amber-400/20" />
              {/* Medal */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 text-sm">🏅</span>
                  <span className="text-emerald-400 font-bold text-xs">{chapterMedals[0].medalName}</span>
                </div>
                <div className="text-white/30 text-[9px] mt-0.5 uppercase tracking-wider">Chapter Medal</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top center: Chapter progress indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:block">
        <div className="rounded-full bg-stone-950/80 backdrop-blur-md border border-amber-400/20 px-3 py-1 flex items-center gap-2">
          <span className="text-amber-400/60 text-[10px] uppercase tracking-widest font-semibold">Chapter</span>
          <span className="text-amber-400 font-bold text-xs">1</span>
          <span className="text-white/30 text-[10px]">/</span>
          <span className="text-white/40 text-[10px]">11</span>
          <div className="ml-1 flex gap-0.5">
            {[...Array(11)].map((_, i) => (
              <div
                key={i}
                className={`w-1 h-3 rounded-sm transition-all ${
                  i === 0
                    ? 'bg-amber-400 shadow shadow-amber-400/50'
                    : i < 1
                      ? 'bg-emerald-500/60'
                      : 'bg-stone-700/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom controls hint - positioned to not conflict with dialogue (which is at bottom-20) */}
      {!chapterComplete && (
        <div className="absolute bottom-3 right-24 z-10 pointer-events-none hidden sm:block">
          <div className="text-white/40 text-[10px] text-right bg-stone-950/50 px-2.5 py-1 rounded-full backdrop-blur-sm">
            WASD move · Space talk · H help
          </div>
        </div>
      )}

      {/* Medal display animation */}
      {showMedal && medalInfo && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none">
          <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-amber-950 border-2 border-amber-400/60 p-6 text-center shadow-2xl shadow-amber-900/50 min-w-[300px]">
            <div className="text-6xl mb-3 animate-pulse">🏅</div>
            <h2 className="text-amber-400 text-lg font-bold mb-1 tracking-wide">CHAPTER MEDAL EARNED!</h2>
            <div className="text-white text-xl mb-2 font-bold">{medalInfo.medalName}</div>
            <div className="text-white/60 text-sm italic max-w-xs mx-auto">{medalInfo.medalDescription}</div>
            {/* Decorative border */}
            <div className="mt-4 flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
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

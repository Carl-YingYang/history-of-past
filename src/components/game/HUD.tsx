'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import chapters from '@/data/chapters.json';

export default function HUD() {
  const { xp, chapterMedals, timeOfDay, chapterPhase, chapterComplete, showMedal, medalInfo } = useGameStore();
  const [showXpSparkle, setShowXpSparkle] = useState(false);
  const prevXpRef = useRef(xp);

  const chapter = chapters.find(c => c.id === 'ch1');
  const xpForNextLevel = 100;
  const xpProgress = Math.min(100, (xp % xpForNextLevel));
  const hasMedal = chapterMedals.length > 0;

  // Animated sparkle effect when XP changes
  // Use requestAnimationFrame to defer state update outside effect body
  const sparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (xp !== prevXpRef.current) {
      prevXpRef.current = xp;
      // Defer state update to avoid lint warning about setState in effect
      requestAnimationFrame(() => {
        setShowXpSparkle(true);
        sparkleTimerRef.current = setTimeout(() => setShowXpSparkle(false), 800);
      });
    }
    return () => {
      if (sparkleTimerRef.current) clearTimeout(sparkleTimerRef.current);
    };
  }, [xp]);

  // Sun/moon icon based on time of day
  const timeIcon = timeOfDay === 'morning' ? '☀️' : '🌙';
  const timeIconColor = timeOfDay === 'morning' ? 'text-yellow-300' : 'text-blue-300';

  return (
    <>
      {/* Bottom HUD bar - XP, Time, Medal */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="rounded-xl bg-stone-950/85 backdrop-blur-md border border-amber-400/30 px-3 py-2 flex items-center gap-3 text-sm shadow-2xl shadow-black/50">
          {/* XP counter with animated bronze-to-gold progress bar */}
          <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 text-sm">⭐</span>
              <span className="text-white/60 text-[10px] uppercase tracking-wider">XP</span>
              <span className="text-amber-400 font-bold text-sm tabular-nums">{xp}</span>
              {/* Sparkle effect when XP changes */}
              {showXpSparkle && (
                <span className="animate-sparkle-burst text-amber-400 text-xs absolute" style={{ left: '70px', top: '-2px' }}>✨</span>
              )}
            </div>
            {/* XP Progress bar — gradient from bronze to gold */}
            <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 rounded-full transition-all duration-500 relative"
                style={{ width: `${xpProgress}%` }}
              >
                {/* Shimmer highlight on XP bar */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-sweep" style={{ width: '200%' }} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-amber-400/20" />

          {/* Time of day with sun/moon icon */}
          <div className="flex flex-col items-center min-w-[68px]">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${timeIconColor}`} style={{ filter: timeOfDay === 'morning' ? 'drop-shadow(0 0 4px rgba(255,200,0,0.5))' : 'drop-shadow(0 0 4px rgba(100,150,255,0.5))' }}>
                {timeIcon}
              </span>
              <span className="text-white/80 text-xs capitalize font-medium">{timeOfDay}</span>
            </div>
            <div className="text-amber-400/40 text-[10px] mt-0.5 font-mono">1887</div>
          </div>

          {/* Divider */}
          {hasMedal && (
            <>
              <div className="w-px h-8 bg-amber-400/20" />
              {/* Medal — badge/shield shape display */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="flex items-center gap-1.5">
                  <div className="relative w-6 h-6 flex items-center justify-center">
                    {/* Badge shape with inner medal icon */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-md rotate-3 shadow-md shadow-emerald-900/30" />
                    <span className="relative text-[11px]">🏅</span>
                  </div>
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
          <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-amber-950 border-2 border-amber-400/60 p-6 text-center shadow-2xl shadow-amber-900/50 min-w-[300px] animate-celebration-glow">
            {/* Medal badge shape */}
            <div className="relative w-16 h-16 mx-auto mb-3">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl rotate-6 shadow-lg shadow-emerald-900/40" />
              <div className="relative flex items-center justify-center w-full h-full text-4xl">🏅</div>
            </div>
            <h2 className="text-amber-400 text-lg font-bold mb-1 tracking-wide">CHAPTER MEDAL EARNED!</h2>
            <div className="text-white text-xl mb-2 font-bold">{medalInfo.medalName}</div>
            <div className="text-white/60 text-sm italic max-w-xs mx-auto">{medalInfo.medalDescription}</div>
            {/* Decorative border */}
            <div className="mt-4 flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-sparkle"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

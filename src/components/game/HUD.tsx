'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { gameEvents } from '@/lib/game/eventBus';
import chapters from '@/data/chapters.json';

// ── Location discovered notification type ──
interface DiscoveredLocation {
  id: string;
  name: string;
  timestamp: number;
}

// ── Phase definitions for Chapter 1 ──
const CHAPTER_PHASES = [
  { id: 'intro', label: 'Intro', shortLabel: 'I' },
  { id: 'explore', label: 'Explore', shortLabel: 'E' },
  { id: 'gossip', label: 'Gossip', shortLabel: 'G' },
  { id: 'ibarra-sighting', label: 'Ibarra', shortLabel: 'IB' },
  { id: 'complete', label: 'Complete', shortLabel: '✓' },
] as const;

// ── XP level calculation ──
function getLevel(xp: number): { level: number; xpInLevel: number; xpToNext: number } {
  const xpPerLevel = 60;
  const level = Math.floor(xp / xpPerLevel) + 1;
  const xpInLevel = xp % xpPerLevel;
  const xpToNext = xpPerLevel - xpInLevel;
  return { level, xpInLevel, xpToNext };
}

export default function HUD() {
  const { xp, chapterMedals, timeOfDay, chapterPhase, chapterComplete, showMedal, medalInfo } = useGameStore();
  const [showXpSparkle, setShowXpSparkle] = useState(false);
  const [showXpPulse, setShowXpPulse] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState<{ threshold: number; level: number } | null>(null);
  const prevXpRef = useRef(xp);

  // ── Location discovered state ──
  const [discoveredLocations, setDiscoveredLocations] = useState<DiscoveredLocation[]>([]);
  const discoveredIdsRef = useRef<Set<string>>(new Set());

  // ── Medal unlocked visual state ──
  const [showMedalUnlocked, setShowMedalUnlocked] = useState(false);

  const chapter = chapters.find(c => c.id === 'ch1');
  const { level, xpInLevel, xpToNext } = getLevel(xp);
  const xpPerLevel = 60;
  const xpProgress = Math.min(100, (xpInLevel / xpPerLevel) * 100);
  const hasMedal = chapterMedals.length > 0;

  // ── Animated sparkle + pulse effects when XP changes ──
  // The XP bar pulses (xp-pulse keyframe) AND we show a small burst of
  // sparkles. We also detect crossing 100/200/300 XP thresholds and show
  // a level-up toast.
  const sparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (xp !== prevXpRef.current) {
      const prevXp = prevXpRef.current;
      prevXpRef.current = xp;
      requestAnimationFrame(() => {
        setShowXpSparkle(true);
        setShowXpPulse(true);
        sparkleTimerRef.current = setTimeout(() => setShowXpSparkle(false), 1200);
        pulseTimerRef.current = setTimeout(() => setShowXpPulse(false), 900);
      });

      // ── Check for level-up threshold crossing (100 / 200 / 300 XP) ──
      // Wrapped in requestAnimationFrame to avoid a synchronous setState
      // inside the effect body (which would trip the
      // `react-hooks/set-state-in-effect` lint rule and cause cascading
      // renders). Mirrors the same pattern used for setShowXpSparkle above.
      const LEVEL_UP_THRESHOLDS = [100, 200, 300];
      for (const threshold of LEVEL_UP_THRESHOLDS) {
        if (prevXp < threshold && xp >= threshold) {
          const newLevel = Math.floor(threshold / xpPerLevel) + 1;
          requestAnimationFrame(() => {
            setShowLevelUp({ threshold, level: newLevel });
            if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
            levelUpTimerRef.current = setTimeout(() => setShowLevelUp(null), 2800);
          });
          break;
        }
      }
    }
    return () => {
      if (sparkleTimerRef.current) clearTimeout(sparkleTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [xp, xpPerLevel]);

  // Cleanup level-up timer on unmount
  useEffect(() => {
    return () => {
      if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    };
  }, []);

  // ── Listen for zone:enter events (location discovered) ──
  useEffect(() => {
    const unsubscribe = gameEvents.on('zone:enter', (data: unknown) => {
      const zone = data as { id?: string; name?: string; label?: string };
      const zoneId = zone?.id || '';
      const zoneName = zone?.name || zone?.label || '';

      // Only show if we have a name and haven't discovered it recently
      if (zoneName && !discoveredIdsRef.current.has(zoneId)) {
        discoveredIdsRef.current.add(zoneId);
        const location: DiscoveredLocation = {
          id: zoneId,
          name: zoneName,
          timestamp: Date.now(),
        };
        setDiscoveredLocations(prev => [...prev, location]);

        // Remove after fade-out (3s visible + 1s fade)
        setTimeout(() => {
          setDiscoveredLocations(prev => prev.filter(l => l.timestamp !== location.timestamp));
        }, 4000);
      }
    });
    return unsubscribe;
  }, []);

  // ── Medal unlocked visual effect ──
  const medalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (showMedal && medalInfo) {
      // Defer state update to avoid lint warning about setState in effect
      requestAnimationFrame(() => {
        setShowMedalUnlocked(true);
        medalTimerRef.current = setTimeout(() => setShowMedalUnlocked(false), 3000);
      });
    }
    return () => {
      if (medalTimerRef.current) clearTimeout(medalTimerRef.current);
    };
  }, [showMedal, medalInfo]);

  // ── Sun/moon icon based on time of day ──
  // The sun shows for morning, the moon for afternoon (the chapter opens at
  // dusk and transitions to morning after the gossip scene). We render a
  // small SVG so the icon visually changes shape with the time of day —
  // not just an emoji swap.
  const isMorning = timeOfDay === 'morning';
  const timeIconColor = isMorning ? 'text-yellow-300' : 'text-indigo-200';
  const timeGlowFilter = isMorning
    ? 'drop-shadow(0 0 4px rgba(255,200,0,0.55))'
    : 'drop-shadow(0 0 5px rgba(150,170,255,0.55))';

  // ── Get current phase index ──
  const currentPhaseIndex = CHAPTER_PHASES.findIndex(p => p.id === chapterPhase);

  // ── Sparkle particles for XP gain ──
  const sparkleParticles = [
    { emoji: '✨', x: 0, y: 0, delay: 0 },
    { emoji: '⭐', x: -12, y: -8, delay: 0.1 },
    { emoji: '✦', x: 10, y: -10, delay: 0.15 },
    { emoji: '✧', x: -6, y: -14, delay: 0.2 },
    { emoji: '💫', x: 14, y: -4, delay: 0.08 },
  ];

  return (
    <>
      {/* ── Location Discovered Notification ── */}
      {discoveredLocations.length > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-2">
          {discoveredLocations.map(loc => (
            <div
              key={loc.timestamp}
              className="animate-location-discover rounded-lg bg-stone-950/90 backdrop-blur-md border border-amber-400/40 px-4 py-2 shadow-lg shadow-amber-900/30"
            >
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-base">📍</span>
                <span className="text-amber-300 font-semibold text-sm">{loc.name}</span>
                <span className="text-amber-400/60 text-xs uppercase tracking-wider">discovered!</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Top center: Chapter progress + Phase indicator ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:flex flex-col items-center gap-2">
        {/* Chapter progress indicator */}
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

        {/* Phase progress indicator */}
        <div className="rounded-full bg-stone-950/70 backdrop-blur-sm border border-amber-400/15 px-3 py-1 flex items-center gap-1.5">
          {CHAPTER_PHASES.map((phase, i) => {
            const isComplete = i < currentPhaseIndex;
            const isCurrent = i === currentPhaseIndex;
            const isFuture = i > currentPhaseIndex;
            return (
              <div key={phase.id} className="flex items-center gap-1.5">
                {/* Phase dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                      isComplete
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                        : isCurrent
                          ? 'bg-amber-400 shadow-sm shadow-amber-400/60 animate-dot-glow'
                          : 'bg-stone-600/60'
                    }`}
                  />
                  <span
                    className={`text-[7px] mt-0.5 uppercase tracking-wider ${
                      isComplete
                        ? 'text-emerald-400/70'
                        : isCurrent
                          ? 'text-amber-400/80'
                          : 'text-stone-600/50'
                    }`}
                  >
                    {phase.shortLabel}
                  </span>
                </div>
                {/* Connector line between phases */}
                {i < CHAPTER_PHASES.length - 1 && (
                  <div
                    className={`w-3 h-px ${
                      isComplete ? 'bg-emerald-400/50' : isCurrent ? 'bg-amber-400/30' : 'bg-stone-700/40'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom HUD bar - XP, Time, Medal ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="relative rounded-xl bg-stone-950/85 backdrop-blur-md border border-amber-400/30 px-3 py-2 flex items-center gap-3 text-sm shadow-2xl shadow-black/50">
          {/* ── Decorative corner flourishes ── */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 pointer-events-none">
            <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <div className="absolute top-0.5 left-1.5 w-1 h-1 rounded-full bg-amber-500/40" />
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 pointer-events-none">
            <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <div className="absolute top-0.5 right-1.5 w-1 h-1 rounded-full bg-amber-500/40" />
          </div>
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <div className="absolute bottom-0.5 left-1.5 w-1 h-1 rounded-full bg-amber-500/40" />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <div className="absolute bottom-0.5 right-1.5 w-1 h-1 rounded-full bg-amber-500/40" />
          </div>

          {/* ── XP counter with level indicator ── */}
          <div className="flex flex-col items-center gap-0.5 min-w-[100px]">
            <div className="flex items-center gap-1.5 relative">
              <span className="text-amber-400 text-sm">⭐</span>
              <span className="text-amber-400/80 text-[10px] uppercase tracking-wider font-semibold">
                Lv.{level}
              </span>
              <span className="text-white/60 text-[10px] uppercase tracking-wider">XP</span>
              <span className="text-amber-400 font-bold text-sm tabular-nums">{xp}</span>
              {/* Multi-sparkle effect when XP changes */}
              {showXpSparkle && (
                <>
                  {sparkleParticles.map((p, i) => (
                    <span
                      key={i}
                      className="animate-sparkle-burst text-amber-400 text-xs absolute pointer-events-none"
                      style={{
                        left: `${70 + p.x}px`,
                        top: `${-2 + p.y}px`,
                        animationDelay: `${p.delay}s`,
                      }}
                    >
                      {p.emoji}
                    </span>
                  ))}
                </>
              )}
            </div>
            {/* XP Progress bar — gradient from bronze to gold, pulses on gain */}
            <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 rounded-full transition-all duration-500 relative ${showXpPulse ? 'animate-xp-pulse' : ''}`}
                style={{ width: `${xpProgress}%` }}
              >
                {/* Shimmer highlight on XP bar */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-sweep" style={{ width: '200%' }} />
              </div>
            </div>
            {/* XP to next level text */}
            <div className="text-amber-400/40 text-[8px] uppercase tracking-wider">
              {xpToNext} XP to next level
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-amber-400/20" />

          {/* Time of day with sun/moon SVG icon that changes with timeOfDay */}
          <div className="flex flex-col items-center min-w-[68px]">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-sm ${timeIconColor} inline-flex items-center justify-center`}
                style={{ filter: timeGlowFilter, width: '16px', height: '16px' }}
                aria-label={isMorning ? 'Morning sun' : 'Evening moon'}
                role="img"
              >
                {isMorning ? (
                  // Sun: yellow circle with rays
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="3.2" fill="currentColor" />
                    {/* 8 rays around the sun */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                      <line
                        key={deg}
                        x1="8"
                        y1="2"
                        x2="8"
                        y2="3.6"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        transform={`rotate(${deg} 8 8)`}
                      />
                    ))}
                  </svg>
                ) : (
                  // Moon: crescent shape (full circle minus an offset circle)
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M12.5 8.2a4.5 4.5 0 1 1-5-5 3.5 3.5 0 0 0 5 5z"
                      fill="currentColor"
                    />
                    {/* Tiny star next to the moon for visual interest */}
                    <circle cx="12.2" cy="3.5" r="0.6" fill="currentColor" opacity="0.7" />
                    <circle cx="13.5" cy="5.5" r="0.4" fill="currentColor" opacity="0.5" />
                  </svg>
                )}
              </span>
              <span className="text-white/80 text-xs capitalize font-medium">{timeOfDay}</span>
            </div>
            <div className="text-amber-400/40 text-[10px] mt-0.5 font-mono">1887</div>
          </div>

          {/* Medal section */}
          {hasMedal && (
            <>
              <div className="w-px h-8 bg-amber-400/20" />
              {/* Medal — shield-shaped badge display */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="flex items-center gap-1.5">
                  <div className="relative w-6 h-7 flex items-center justify-center">
                    {/* Shield shape with CSS */}
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-900/30"
                      style={{
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)',
                      }}
                    />
                    {/* Inner shield border */}
                    <div
                      className="absolute bg-gradient-to-br from-emerald-300/40 to-emerald-700/40"
                      style={{
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)',
                        top: '2px',
                        left: '2px',
                        right: '2px',
                        bottom: '2px',
                      }}
                    />
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

      {/* ── Bottom controls hint — styled panel ── */}
      {!chapterComplete && (
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none hidden sm:block">
          <div className="text-white/50 text-[10px] text-right bg-stone-950/70 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-amber-400/20 shadow-md shadow-black/30">
            <div className="flex items-center gap-1.5">
              <kbd className="inline-block bg-stone-800/80 text-amber-400/70 text-[9px] px-1 py-0.5 rounded border border-amber-400/15 font-mono">WASD</kbd>
              <span className="text-white/30">move</span>
              <span className="text-amber-400/20">·</span>
              <kbd className="inline-block bg-stone-800/80 text-amber-400/70 text-[9px] px-1 py-0.5 rounded border border-amber-400/15 font-mono">Space</kbd>
              <span className="text-white/30">talk</span>
              <span className="text-amber-400/20">·</span>
              <kbd className="inline-block bg-stone-800/80 text-amber-400/70 text-[9px] px-1 py-0.5 rounded border border-amber-400/15 font-mono">H</kbd>
              <span className="text-white/30">help</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Level-up toast — shows when XP crosses 100/200/300 thresholds ── */}
      {showLevelUp && (
        <div
          className="absolute top-20 left-1/2 z-40 pointer-events-none animate-level-up-toast"
          style={{ transform: 'translateX(-50%)' }}
          role="status"
          aria-live="polite"
          aria-label={`Level up! Reached ${showLevelUp.threshold} XP, now level ${showLevelUp.level}`}
        >
          <div className="rounded-full bg-gradient-to-br from-amber-900/95 via-amber-950/95 to-stone-950/95 border-2 border-amber-400/60 px-5 py-2.5 shadow-2xl shadow-amber-900/50 flex items-center gap-3 backdrop-blur-md">
            {/* Starburst icon */}
            <span className="text-2xl" aria-hidden="true">🌟</span>
            <div className="flex flex-col">
              <span className="text-amber-300 text-[10px] uppercase tracking-[0.3em] font-bold">
                Level Up!
              </span>
              <span className="text-white text-sm font-bold tracking-wide">
                Level {showLevelUp.level}
                <span className="text-amber-400/60 mx-1.5 font-normal">·</span>
                <span className="text-amber-300 font-mono">{showLevelUp.threshold} XP</span>
              </span>
            </div>
            {/* Decorative sparkles around the toast */}
            <span className="absolute -top-2 -right-2 text-amber-400 text-xs animate-sparkle" aria-hidden="true">✦</span>
            <span className="absolute -bottom-1 -left-2 text-amber-300 text-xs animate-sparkle" style={{ animationDelay: '0.2s' }} aria-hidden="true">✦</span>
          </div>
        </div>
      )}

      {/* ── Medal display animation ── */}
      {showMedal && medalInfo && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none">
          <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-amber-950 border-2 border-amber-400/60 p-6 text-center shadow-2xl shadow-amber-900/50 min-w-[300px] animate-celebration-glow relative overflow-hidden">
            {/* Filipino weaving pattern overlay */}
            <div className="absolute inset-0 filipino-weaving-border opacity-30 pointer-events-none" />

            {/* Medal unlocked visual text */}
            {showMedalUnlocked && (
              <div className="animate-medal-unlocked mb-3 flex items-center justify-center gap-2">
                <span className="text-amber-400 text-lg">🔔</span>
                <span className="text-amber-300 font-bold text-sm uppercase tracking-widest">Medal Unlocked!</span>
                <span className="text-amber-400 text-lg">🔔</span>
              </div>
            )}

            {/* Medal badge — shield shape */}
            <div className="relative w-16 h-20 mx-auto mb-3">
              {/* Shield outer shape */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-900/40"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)',
                }}
              />
              {/* Shield inner border */}
              <div
                className="absolute bg-gradient-to-br from-emerald-300/30 to-emerald-800/30"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)',
                  top: '3px',
                  left: '3px',
                  right: '3px',
                  bottom: '3px',
                }}
              />
              {/* Weaving pattern inside shield */}
              <div
                className="absolute filipino-weaving-border opacity-40"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)',
                  top: '4px',
                  left: '4px',
                  right: '4px',
                  bottom: '4px',
                }}
              />
              <div className="relative flex items-center justify-center w-full h-full text-4xl">🏅</div>
            </div>
            <h2 className="text-amber-400 text-lg font-bold mb-1 tracking-wide">CHAPTER MEDAL EARNED!</h2>
            <div className="text-white text-xl mb-2 font-bold">{medalInfo.medalName}</div>
            <div className="text-white/60 text-sm italic max-w-xs mx-auto">{medalInfo.medalDescription}</div>
            {/* Decorative border with weaving pattern dots */}
            <div className="mt-4 flex justify-center gap-1.5">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-sparkle"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
            {/* Ornamental bottom line */}
            <div className="mt-2 mx-8 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
          </div>
        </div>
      )}
    </>
  );
}

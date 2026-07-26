'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import rizalQuotes from '@/data/rizalQuotes.json';

type RizalQuote = typeof rizalQuotes[0];

/**
 * IntroScreen - Title-card overlay shown on first load.
 *
 * Behaviour:
 *   - Shows the game title, subtitle, and a "Begin Journey" button.
 *   - On click, fades out and reveals the game world.
 *   - Auto-hides once `gameReady` is true AND the user has clicked Begin
 *     (or has existing save data — in which case it shows "Continue").
 *   - Also shows a tiny "press any key" hint after 4 seconds.
 *
 * Fix: Pre-computed particle positions to avoid SSR hydration mismatch
 * (Math.random() produces different values on server vs client).
 */

// Deterministic particle positions — pre-computed to avoid hydration mismatch
const PARTICLES = [
  { w: 3.5, h: 4.0, l: 15, t: 20, bg: 0, dur: 4.5, glow: true },
  { w: 2.8, h: 3.6, l: 42, t: 55, bg: 1, dur: 4.8, glow: true },
  { w: 4.2, h: 3.2, l: 72, t: 35, bg: 2, dur: 5.2, glow: true },
  { w: 2.5, h: 3.8, l: 88, t: 65, bg: 0, dur: 6.0, glow: true },
  { w: 3.8, h: 2.5, l: 25, t: 80, bg: 1, dur: 5.8, glow: true },
  { w: 1.8, h: 2.2, l: 55, t: 15, bg: 2, dur: 6.3, glow: false },
  { w: 3.2, h: 3.5, l: 10, t: 45, bg: 0, dur: 5.4, glow: false },
  { w: 2.6, h: 2.0, l: 78, t: 72, bg: 1, dur: 4.7, glow: false },
  { w: 4.0, h: 3.0, l: 35, t: 88, bg: 2, dur: 5.9, glow: false },
  { w: 2.2, h: 3.7, l: 92, t: 30, bg: 0, dur: 6.5, glow: false },
  { w: 3.6, h: 2.1, l: 48, t: 70, bg: 1, dur: 5.1, glow: false },
  { w: 1.6, h: 4.2, l: 82, t: 50, bg: 2, dur: 7.0, glow: false },
  { w: 3.0, h: 3.3, l: 18, t: 60, bg: 0, dur: 6.8, glow: false },
  { w: 2.4, h: 2.8, l: 65, t: 40, bg: 1, dur: 5.3, glow: false },
  { w: 3.9, h: 3.1, l: 30, t: 25, bg: 2, dur: 4.4, glow: false },
];

const BG_COLORS = [
  'rgba(251,191,36,0.5)',
  'rgba(255,220,120,0.4)',
  'rgba(251,191,36,0.25)',
];

export default function IntroScreen() {
  const { gameReady, completedObjectives, setIntroVisible } = useGameStore();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [mounted, setMounted] = useState(false);

  const hasProgress = completedObjectives.length > 0;

  // Pick a deterministic "quote of the day" — rotates daily so the same user
  // sees the same quote on a given calendar day, but a new one each day.
  // Uses local date, not server time, so it's stable across reloads.
  const quoteOfDay = useMemo<RizalQuote>(() => {
    const now = new Date();
    // Day-of-year — simple, good enough for rotation
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
    const idx = dayOfYear % rizalQuotes.length;
    return rizalQuotes[idx] as RizalQuote;
  }, []);

  const handleBegin = useCallback(() => {
    setFading(true);
    setIntroVisible(false);
    setTimeout(() => setVisible(false), 800);
  }, [setIntroVisible]);

  useEffect(() => {
    // After 4 seconds, show "press any key" hint
    const t = setTimeout(() => setShowHint(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Listen for keyboard to also dismiss
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleBegin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, handleBegin]);

  if (!visible) return null;

  // Don't render particles until mounted (client-side) to avoid hydration mismatch
  const particleElems = mounted ? PARTICLES.map((p, i) => (
    <div
      key={i}
      className="absolute rounded-full animate-particle-drift"
      style={{
        width: `${p.w}px`,
        height: `${p.h}px`,
        left: `${p.l}%`,
        top: `${p.t}%`,
        background: BG_COLORS[p.bg],
        animationDelay: `${i * 0.4}s`,
        animationDuration: `${p.dur}s`,
        boxShadow: p.glow ? '0 0 4px rgba(251,191,36,0.3)' : 'none',
      }}
    />
  )) : null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-700 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse at center, rgba(20,12,4,0.92) 0%, rgba(0,0,0,0.98) 70%)',
      }}
      suppressHydrationWarning
    >
      {/* Vignette effect — dark edges overlay */}
      <div
        className="absolute inset-0 pointer-events-none animate-vignette-fade"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.9) 100%)',
        }}
      />

      {/* Atmospheric warm glow at center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 55%, rgba(255,180,80,0.06) 0%, transparent 50%)',
        }}
      />

      {/* Animated floating particles/sparkles — deterministic positions */}
      {particleElems}

      {/* Additional decorative elements — filipino sun rays */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" suppressHydrationWarning>
        {[...Array(8)].map((_, i) => (
          <div
            key={`ray-${i}`}
            className="absolute left-1/2 top-[55%] w-px bg-gradient-to-b from-amber-400 to-transparent"
            style={{
              height: '120px',
              transformOrigin: 'top center',
              transform: `rotate(${i * 45}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative text-center max-w-2xl px-6 z-10">
        {/* Top decoration — Filipino sun emblem */}
        <div className="flex items-center justify-center gap-3 mb-6 opacity-60 animate-subtitle-fade" style={{ animationDelay: '0.3s' }}>
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
          <span className="text-amber-400/80 text-xs tracking-[0.4em] uppercase">An Educational RPG</span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
        </div>

        {/* Title */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold text-amber-400 mb-2 tracking-wider animate-subtitle-fade"
          style={{
            fontFamily: 'Georgia, serif',
            textShadow: '0 0 24px rgba(255,180,80,0.4), 0 2px 8px rgba(0,0,0,0.8)',
            letterSpacing: '0.05em',
            animationDelay: '0.5s',
          }}
        >
          Project Noor
        </h1>

        {/* Subtitle — sequential fade-in */}
        <div className="text-amber-100/70 text-xl md:text-2xl italic mb-1 animate-subtitle-fade" style={{ fontFamily: 'Georgia, serif', animationDelay: '1s' }}>
          A Stranger in San Diego
        </div>

        {/* Setting line — delayed fade */}
        <div className="text-white/50 text-sm mb-8 mt-2 animate-subtitle-fade" style={{ animationDelay: '1.5s' }}>
          based on <span className="italic text-amber-300/80">Noli Me Tangere</span> by José Rizal · 1887
        </div>

        {/* Decorative ornament */}
        <div className="flex items-center justify-center gap-2 mb-8 text-amber-400/40 animate-subtitle-fade" style={{ animationDelay: '2s' }}>
          <span>✦</span>
          <span className="text-2xl">❦</span>
          <span>✦</span>
        </div>

        {/* Description — delayed fade */}
        <p className="text-white/70 text-sm md:text-base leading-relaxed max-w-lg mx-auto mb-6 animate-subtitle-fade" style={{ fontFamily: 'Georgia, serif', animationDelay: '2.3s' }}>
          You wake at the edge of a town you don&apos;t recognize.
          The air smells of woodsmoke and earth. The year, you&apos;ll soon learn, is 1887 —
          and a young man named Crisóstomo Ibarra has just returned from Europe.
        </p>

        {/* ── Quote of the Day — rotates daily ── */}
        <div
          className="relative max-w-xl mx-auto mb-8 px-5 py-4 rounded-lg border border-amber-400/20 bg-gradient-to-br from-amber-950/30 to-stone-950/40 animate-subtitle-fade"
          style={{ animationDelay: '2.6s' }}
        >
          {/* Decorative open-quote glyph */}
          <span className="absolute -top-3 left-4 text-3xl text-amber-400/40 select-none" style={{ fontFamily: 'Georgia, serif' }}>&ldquo;</span>
          {/* Tiny header */}
          <div className="text-amber-400/50 text-[9px] uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
            <span className="h-px w-6 bg-amber-400/30" />
            <span>Quote of the Day · José Rizal</span>
            <span className="h-px w-6 bg-amber-400/30" />
          </div>
          {/* English text */}
          <p className="text-amber-100/80 text-sm md:text-base italic leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
            {quoteOfDay.text}
          </p>
          {/* Original Spanish (if any) */}
          {quoteOfDay.original && (
            <p className="text-amber-300/50 text-xs italic mt-2" style={{ fontFamily: 'Georgia, serif' }}>
              <span className="text-amber-400/40 mr-1">orig.</span>
              {quoteOfDay.original}
            </p>
          )}
          {/* Source attribution */}
          <div className="text-white/40 text-xs mt-3 flex items-center gap-2">
            <span className="text-amber-400/40">—</span>
            <span>{quoteOfDay.source}</span>
            <span className="ml-auto text-amber-400/30 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-400/20">
              {quoteOfDay.category}
            </span>
          </div>
        </div>

        {/* Begin button — ornamental border style */}
        <button
          onClick={handleBegin}
          disabled={!gameReady}
          className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-full
                     bg-gradient-to-br from-amber-600 to-amber-800 text-white font-bold tracking-wide
                     border-2 border-amber-400/50 shadow-2xl shadow-amber-900/50
                     hover:from-amber-500 hover:to-amber-700 hover:scale-105
                     active:scale-100 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-wait animate-subtitle-fade"
          style={{ animationDelay: '2.8s' }}
        >
          <span className="text-lg">{hasProgress ? '▶' : '✦'}</span>
          <span>{gameReady ? (hasProgress ? 'Continue Journey' : 'Begin Journey') : 'Loading…'}</span>
          {/* Ornamental inner ring */}
          <span className="absolute inset-0 rounded-full ring-2 ring-amber-300/0 group-hover:ring-amber-300/40 transition-all" />
          {/* Decorative corner dots on button */}
          <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-amber-400/30 group-hover:bg-amber-400/60 transition-all" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400/30 group-hover:bg-amber-400/60 transition-all" />
          <span className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-amber-400/30 group-hover:bg-amber-400/60 transition-all" />
          <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-amber-400/30 group-hover:bg-amber-400/60 transition-all" />
        </button>

        {/* Press any key hint */}
        {showHint && gameReady && (
          <div className="text-white/40 text-xs mt-6 animate-pulse animate-subtitle-fade" style={{ animationDelay: '3.2s' }}>
            Press <kbd className="px-1.5 py-0.5 bg-stone-800/80 rounded text-amber-400 text-[10px] mx-1 border border-amber-400/20">Enter</kbd>
            or click to begin
          </div>
        )}

        {/* Footer attribution */}
        <div className="absolute -bottom-12 left-0 right-0 text-center">
          <div className="text-white/30 text-[10px] tracking-widest uppercase">
            Chapter 1 of 11 · Build v0.4
          </div>
        </div>
      </div>
    </div>
  );
}

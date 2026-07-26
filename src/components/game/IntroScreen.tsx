'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';

/**
 * IntroScreen - Title-card overlay shown on first load.
 *
 * Behaviour:
 *   - Shows the game title, subtitle, and a "Begin Journey" button.
 *   - On click, fades out and reveals the game world.
 *   - Auto-hides once `gameReady` is true AND the user has clicked Begin
 *     (or has existing save data — in which case it shows "Continue").
 *   - Also shows a tiny "press any key" hint after 4 seconds.
 */
export default function IntroScreen() {
  const { gameReady, completedObjectives } = useGameStore();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const hasProgress = completedObjectives.length > 0;

  const handleBegin = useCallback(() => {
    setFading(true);
    setTimeout(() => setVisible(false), 800);
  }, []);

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

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-700 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse at center, rgba(20,12,4,0.92) 0%, rgba(0,0,0,0.98) 70%)',
      }}
    >
      {/* Atmospheric warm glow at center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 55%, rgba(255,180,80,0.06) 0%, transparent 50%)',
        }}
      />

      {/* Subtle floating dust particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-amber-200/20 animate-pulse"
          style={{
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            left: `${10 + Math.random() * 80}%`,
            top: `${15 + Math.random() * 70}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}

      <div className="relative text-center max-w-2xl px-6 z-10">
        {/* Top decoration */}
        <div className="flex items-center justify-center gap-3 mb-6 opacity-60">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
          <span className="text-amber-400/80 text-xs tracking-[0.4em] uppercase">An Educational RPG</span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
        </div>

        {/* Title */}
        <h1
          className="text-6xl md:text-7xl font-bold text-amber-400 mb-2 tracking-wider"
          style={{
            fontFamily: 'Georgia, serif',
            textShadow: '0 0 24px rgba(255,180,80,0.4), 0 2px 8px rgba(0,0,0,0.8)',
            letterSpacing: '0.05em',
          }}
        >
          Project Noor
        </h1>

        {/* Subtitle */}
        <div className="text-amber-100/70 text-xl md:text-2xl italic mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          A Stranger in San Diego
        </div>

        {/* Setting line */}
        <div className="text-white/50 text-sm mb-8 mt-2">
          based on <span className="italic text-amber-300/80">Noli Me Tangere</span> by José Rizal · 1887
        </div>

        {/* Decorative ornament */}
        <div className="flex items-center justify-center gap-2 mb-8 text-amber-400/40">
          <span>✦</span>
          <span className="text-2xl">❦</span>
          <span>✦</span>
        </div>

        {/* Description */}
        <p className="text-white/70 text-sm md:text-base leading-relaxed max-w-lg mx-auto mb-8" style={{ fontFamily: 'Georgia, serif' }}>
          You wake at the edge of a town you don&apos;t recognize.
          The air smells of woodsmoke and earth. The year, you&apos;ll soon learn, is 1887 —
          and a young man named Crisóstomo Ibarra has just returned from Europe.
        </p>

        {/* Begin button */}
        <button
          onClick={handleBegin}
          disabled={!gameReady}
          className="group relative inline-flex items-center gap-3 px-8 py-3 rounded-full
                     bg-gradient-to-br from-amber-600 to-amber-800 text-white font-bold tracking-wide
                     border-2 border-amber-400/50 shadow-2xl shadow-amber-900/50
                     hover:from-amber-500 hover:to-amber-700 hover:scale-105
                     active:scale-100 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-wait"
        >
          <span className="text-lg">{hasProgress ? '▶' : '✦'}</span>
          <span>{gameReady ? (hasProgress ? 'Continue Journey' : 'Begin Journey') : 'Loading…'}</span>
          <span className="absolute inset-0 rounded-full ring-2 ring-amber-300/0 group-hover:ring-amber-300/40 transition-all" />
        </button>

        {/* Press any key hint */}
        {showHint && gameReady && (
          <div className="text-white/40 text-xs mt-6 animate-pulse">
            Press <kbd className="px-1.5 py-0.5 bg-stone-800/80 rounded text-amber-400 text-[10px] mx-1">Enter</kbd>
            or click to begin
          </div>
        )}

        {/* Footer attribution */}
        <div className="absolute -bottom-12 left-0 right-0 text-center">
          <div className="text-white/30 text-[10px] tracking-widest uppercase">
            Chapter 1 of 11 · Build v0.2
          </div>
        </div>
      </div>
    </div>
  );
}

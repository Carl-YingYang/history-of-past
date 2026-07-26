'use client';

import { useEffect, useState, useCallback } from 'react';
import { gameEvents } from '@/lib/game/eventBus';
import { useUIStore } from './UIManager';

/**
 * AchievementToast - Animated top-center toast that appears whenever an
 * achievement unlocks. Listens to the `achievement:unlock` event emitted by
 * achievementManager.ts (payload: { id, name, description, icon, category,
 * xpReward }) and stacks multiple toasts vertically.
 *
 * Behavior:
 *   - Auto-dismisses each toast 5 seconds after it appears.
 *   - Manual dismiss via the ✕ button.
 *   - Each toast animates in with `animate-achievement-toast-in` (see globals.css).
 *   - A small set of ✦ sparkle particles decorates the toast on appear.
 *   - A "VIEW ALL" link at the bottom of each toast opens the achievements
 *     panel via the shared useUIStore.
 *
 * Mounts once at the app root and renders only when there is at least one
 * active toast.
 */

interface AchievementPayload {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
}

interface ActiveToast extends AchievementPayload {
  toastId: number; // for React key
}

// Pre-computed sparkle positions so they don't recompute on every render
const SPARKLES = [
  { top: '-8px', left: '12%', size: 'text-xs', delay: '0s' },
  { top: '-4px', right: '18%', size: 'text-sm', delay: '0.2s' },
  { bottom: '-6px', left: '28%', size: 'text-[10px]', delay: '0.4s' },
  { top: '40%', right: '-6px', size: 'text-xs', delay: '0.6s' },
] as const;

export default function AchievementToast() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const openPanel = useUIStore(s => s.openPanel);

  // Subscribe once to the achievement:unlock event. Each new payload gets a
  // unique toastId (Date.now + random) and is appended to the active list.
  useEffect(() => {
    const unsub = gameEvents.on('achievement:unlock', (data: unknown) => {
      const payload = data as AchievementPayload;
      if (!payload || typeof payload !== 'object' || !payload.id) return;
      const toastId = Date.now() + Math.random();
      setToasts(prev => [...prev, { ...payload, toastId }]);
      // Auto-dismiss after 5s
      window.setTimeout(() => {
        setToasts(prev => prev.filter(t => t.toastId !== toastId));
      }, 5000);
    });
    return unsub;
  }, []);

  const dismiss = useCallback((toastId: number) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  }, []);

  const handleViewAll = useCallback(() => {
    openPanel('achievements');
    // Clear toasts so the panel doesn't fight for attention
    setToasts([]);
  }, [openPanel]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <div
          key={toast.toastId}
          className="relative pointer-events-auto animate-achievement-toast-in"
          role="status"
        >
          {/* Sparkle particles around the toast */}
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              className={`absolute text-amber-300 animate-achievement-sparkle select-none ${s.size}`}
              style={{
                top: 'top' in s ? s.top : undefined,
                bottom: 'bottom' in s ? s.bottom : undefined,
                left: 'left' in s ? s.left : undefined,
                right: 'right' in s ? s.right : undefined,
                animationDelay: s.delay,
                filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.6))',
              }}
              aria-hidden="true"
            >
              ✦
            </span>
          ))}

          {/* Toast card */}
          <div className="relative w-[min(420px,calc(100vw-2rem))] min-w-[320px] max-w-md rounded-xl bg-stone-950/95 border border-amber-400/60 shadow-2xl shadow-amber-900/40 overflow-hidden">
            {/* Top accent: 2px golden gradient bar */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.9) 20%, rgba(255,237,160,1) 50%, rgba(251,191,36,0.9) 80%, transparent 100%)',
              }}
              aria-hidden="true"
            />

            {/* Close button */}
            <button
              type="button"
              onClick={() => dismiss(toast.toastId)}
              className="absolute top-2 right-2 w-6 h-6 rounded-md bg-stone-800/60 text-white/50 text-xs flex items-center justify-center hover:bg-stone-700/80 hover:text-white transition-colors z-10"
              aria-label="Dismiss achievement notification"
            >
              ✕
            </button>

            <div className="flex items-start gap-3 p-4 pt-4 pr-8">
              {/* Left: large achievement icon inside a circular golden glow */}
              <div className="shrink-0 w-14 h-14 rounded-full bg-amber-500/20 ring-2 ring-amber-400/60 flex items-center justify-center text-4xl leading-none"
                   style={{ boxShadow: '0 0 14px rgba(251,191,36,0.35)' }}
                   aria-hidden="true">
                {toast.icon}
              </div>

              {/* Right: text content */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                  Achievement Unlocked
                </div>
                <div className="text-white font-bold text-lg leading-tight mt-0.5 truncate">
                  {toast.name}
                </div>
                <div className="text-white/60 text-xs leading-relaxed mt-1 line-clamp-2">
                  {toast.description}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/50 text-amber-300 text-[10px] font-semibold">
                    +{toast.xpReward} XP
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone-800/60 border border-white/10 text-white/50 text-[10px] uppercase tracking-wider">
                    {toast.category}
                  </span>
                  <button
                    type="button"
                    onClick={handleViewAll}
                    className="ml-auto text-amber-400/80 hover:text-amber-300 text-[10px] font-semibold uppercase tracking-wider underline-offset-2 hover:underline transition-colors"
                  >
                    View All →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { gameEvents } from '@/lib/game/eventBus';
import { saveManager } from '@/lib/game/saveManager';

/**
 * SaveIndicator - A small status chip that shows the last save time and
 * briefly flashes when a save completes.
 *
 * Sits unobtrusively in the bottom-right corner of the game area, just above
 * the footer. Clicking it triggers a manual save.
 *
 * Why:
 *   - Autosave runs every ~10s, but the player has no visibility into it.
 *   - This chip reassures the player that their progress is being recorded
 *     and lets them manually save on demand.
 */

function formatRelativeTime(ts: number): string {
  if (!ts) return 'never saved';
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function SaveIndicator() {
  const [lastSave, setLastSave] = useState<number>(0);
  const [flash, setFlash] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [now, setNow] = useState<number>(Date.now());
  const flashTimerRef = useRef<number | null>(null);

  // Initialize from saveManager on mount
  useEffect(() => {
    setLastSave(saveManager.getLastSaveTime());

    const onSaveComplete = (data: unknown) => {
      const d = data as { success: boolean; timestamp: number };
      setLastSave(d.timestamp);
      setFlash(d.success ? 'saved' : 'error');
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      // Show "✓ Saved" confirmation for ~2s, then return to idle.
      flashTimerRef.current = window.setTimeout(() => setFlash('idle'), 2000);
    };

    // `on()` returns an unsubscribe function — use that for cleanup
    const unsubscribe = gameEvents.on('save:complete', onSaveComplete);

    // Tick every 5s so the relative time stays fresh ("just now" → "5s ago")
    const tickInterval = window.setInterval(() => setNow(Date.now()), 5_000);

    return () => {
      unsubscribe();
      window.clearInterval(tickInterval);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleManualSave = async () => {
    if (flash === 'saving') return;
    setFlash('saving');
    await saveManager.saveProgress();
    // The save:complete event handler will set flash to 'saved' or 'error'
  };

  // Visual state → styling
  const stateStyles = {
    idle:   { dot: 'bg-emerald-400',   text: 'text-white/60',   ring: 'border-amber-400/20',  bg: 'bg-stone-900/80',  label: 'Auto-save on' },
    saving: { dot: 'bg-amber-400',     text: 'text-amber-300',  ring: 'border-amber-400/50',  bg: 'bg-amber-950/60',  label: 'Saving…' },
    saved:  { dot: 'bg-emerald-400',   text: 'text-emerald-300',ring: 'border-emerald-400/40',bg: 'bg-emerald-950/40',label: '✓ Saved' },
    error:  { dot: 'bg-rose-400',      text: 'text-rose-300',   ring: 'border-rose-400/40',   bg: 'bg-rose-950/40',   label: 'Save failed (local only)' },
  }[flash];

  return (
    <button
      onClick={handleManualSave}
      disabled={flash === 'saving'}
      title={`Last save: ${lastSave ? new Date(lastSave).toLocaleString() : 'never'}\nClick to save now`}
      className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${stateStyles.ring} ${stateStyles.bg} backdrop-blur-sm shadow-md transition-all hover:scale-105 disabled:cursor-wait disabled:hover:scale-100 ${flash === 'saved' ? 'animate-save-saved-flash' : ''}`}
      aria-label={`Save status: ${stateStyles.label}. Last saved ${formatRelativeTime(lastSave)}. Click to save now.`}
    >
      {/* Status icon — varies by state */}
      {flash === 'saving' ? (
        // Spinning saver icon while a save is in progress
        <span
          className="animate-save-spin text-amber-400 text-xs inline-flex items-center justify-center"
          aria-hidden="true"
          style={{ width: '12px', height: '12px' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 2h6.5L10 3.5V10H2V2zm1.5 0v2.5h4V2H6v1.5H5V2H3.5z"
              fill="currentColor"
              opacity="0.95"
            />
          </svg>
        </span>
      ) : flash === 'saved' ? (
        // Green check mark — fades in/out via animate-save-saved-flash on the button
        <span className="text-emerald-400 text-xs font-bold" aria-hidden="true">✓</span>
      ) : flash === 'error' ? (
        <span className="text-rose-400 text-xs" aria-hidden="true">⚠</span>
      ) : (
        // Idle: subtle status dot
        <span className={`relative inline-flex w-2 h-2 rounded-full ${stateStyles.dot}`} />
      )}

      {/* Status label / relative time */}
      <span className={`text-[10px] font-mono tracking-wide ${stateStyles.text}`}>
        {/* `now` is referenced here so the relative time re-renders every tick */}
        {flash === 'idle' ? formatRelativeTime(lastSave || now - 1000) : stateStyles.label}
      </span>

      {/* Save icon (only when idle) */}
      {flash === 'idle' && (
        <span className="text-amber-400/60 text-xs ml-0.5" aria-hidden="true">⤓</span>
      )}
    </button>
  );
}

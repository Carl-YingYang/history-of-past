'use client';

import { useState, useEffect } from 'react';
import { useUIStore } from './UIManager';
import { useGameStore } from '@/stores/gameStore';
import { toggleFieldNotesPanel } from './FieldNotesPanel';
import { toggleDiscoveryLogPanel } from './DiscoveryLogPanel';
import codex from '@/data/codex.json';
import { achievementManager } from '@/lib/game/achievementManager';

/**
 * Toolbar - Responsive flex layout for game panel toggle buttons.
 *
 * Replaces the previous absolute-positioned buttons (left-4, left-[88px],
 * left-[172px], left-[264px]) which overlapped on smaller screens.
 *
 * Layout: horizontal flex row that wraps on mobile, with consistent spacing.
 * Each button shows its icon, label, and a small counter.
 *
 * Live counters:
 *   - Codex: unlocked / total codex entries (from gameStore)
 *   - Trophies: unlocked / total achievements (from achievementManager)
 *   - Notes: number of personal notes the player has written (from localStorage,
 *            updated reactively via the 'noor:field-notes-updated' event)
 *   - Discovery Log: number of unique places discovered (from localStorage,
 *            updated reactively via the 'noor:discovery' event)
 */
export default function Toolbar() {
  const { activePanel, togglePanel } = useUIStore();
  const { unlockedCodex } = useGameStore();

  const allCodexEntries = codex as typeof codex;
  const unlockedCodexCount = unlockedCodex.length;
  const totalCodexCount = allCodexEntries.length;

  const unlockedAchievements = achievementManager.getUnlockedCount();
  const totalAchievements = achievementManager.getTotalCount();

  // Live notes count — initialized lazily from localStorage, then updated
  // reactively via the 'noor:field-notes-updated' event dispatched by
  // FieldNotesPanel whenever notes change.
  const [notesCount, setNotesCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem('noor-field-notes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch { /* ignore */ }
    return 0;
  });
  // Live discovery count — same pattern, via 'noor:discovery' event.
  const [discoveryCount, setDiscoveryCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem('noor-discovery-log');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch { /* ignore */ }
    return 0;
  });

  useEffect(() => {
    // Subscribe to live updates (initial values already read via lazy useState)
    const onNotesUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { count: number } | undefined;
      if (detail && typeof detail.count === 'number') {
        setNotesCount(detail.count);
      }
    };
    // The DiscoveryLogPanel dispatches 'noor:discovery-updated' AFTER it has
    // persisted to localStorage — so we read the authoritative count from
    // the event detail (not from localStorage, which avoids the race).
    const onDiscoveryUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { count: number } | undefined;
      if (detail && typeof detail.count === 'number') {
        setDiscoveryCount(detail.count);
      }
    };
    window.addEventListener('noor:field-notes-updated', onNotesUpdate);
    window.addEventListener('noor:discovery-updated', onDiscoveryUpdated);
    return () => {
      window.removeEventListener('noor:field-notes-updated', onNotesUpdate);
      window.removeEventListener('noor:discovery-updated', onDiscoveryUpdated);
    };
  }, []);

  const buttons: {
    id: 'codex' | 'journal' | 'settings' | 'minimap' | 'help' | 'glossary' | 'achievements' | 'storylog' | 'about';
    icon: string;
    label: string;
    shortcut: string;
    counter?: string;
  }[] = [
    { id: 'codex', icon: '📖', label: 'Codex', shortcut: 'C', counter: `${unlockedCodexCount}/${totalCodexCount}` },
    { id: 'journal', icon: '📔', label: 'Journal', shortcut: 'J' },
    { id: 'glossary', icon: '📚', label: 'Glossary', shortcut: 'G' },
    { id: 'achievements', icon: '🏆', label: 'Trophies', shortcut: 'A', counter: `${unlockedAchievements}/${totalAchievements}` },
    { id: 'storylog', icon: '📜', label: 'Log', shortcut: 'L' },
    { id: 'minimap', icon: '🗺️', label: 'Map', shortcut: 'M' },
    { id: 'about', icon: '❦', label: 'About', shortcut: 'B' },
    { id: 'settings', icon: '⚙️', label: 'Settings', shortcut: 'S' },
  ];

  return (
    <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 flex-wrap max-w-[calc(100vw-120px)]">
      {buttons.map(btn => {
        const isOpen = activePanel === btn.id;
        return (
          <button
            key={btn.id}
            onClick={() => togglePanel(btn.id)}
            className={`group rounded-lg border p-1.5 shadow-lg transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-stone-950 ${
              isOpen
                ? 'bg-amber-900/80 border-amber-400/60 shadow-amber-900/30'
                : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90 hover:border-amber-400/50'
            }`}
            title={`${btn.label} (${btn.shortcut})`}
            aria-label={`Open ${btn.label}`}
          >
            <div className="flex items-center gap-1">
              <span className="text-sm">{btn.icon}</span>
              <span className={`text-amber-400 font-bold text-[10px] leading-none ${
                isOpen ? 'text-amber-300' : ''
              }`}>
                {btn.label}
              </span>
            </div>
            {btn.counter && (
              <div className="text-white/40 text-[9px] mt-0.5 text-center font-mono leading-none">
                {btn.counter}
              </div>
            )}
            {/* Shortcut hint - hidden on smallest screens */}
            <div className="hidden md:block text-white/25 text-[8px] text-center font-mono leading-none mt-0.5">
              {btn.shortcut}
            </div>
          </button>
        );
      })}

      {/* Discovery Log — separate toggle (custom event, like Field Notes) */}
      <button
        onClick={toggleDiscoveryLogPanel}
        className="group rounded-lg border p-1.5 shadow-lg transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-400/60 bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90 hover:border-amber-400/50"
        title="Discovery Log (D)"
        aria-label="Open Discovery Log"
      >
        <div className="flex items-center gap-1">
          <span className="text-sm">🧭</span>
          <span className="text-amber-400 font-bold text-[10px] leading-none">Log</span>
        </div>
        <div className="text-white/40 text-[9px] mt-0.5 text-center font-mono leading-none">
          {discoveryCount}
        </div>
        <div className="hidden md:block text-white/25 text-[8px] text-center font-mono leading-none mt-0.5">
          D
        </div>
      </button>

      {/* Field Notes — separate toggle (custom event) */}
      <button
        onClick={toggleFieldNotesPanel}
        className="group rounded-lg border p-1.5 shadow-lg transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-400/60 bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90 hover:border-amber-400/50"
        title="Field Notes (N)"
        aria-label="Open Field Notes"
      >
        <div className="flex items-center gap-1">
          <span className="text-sm">✏️</span>
          <span className="text-amber-400 font-bold text-[10px] leading-none">Notes</span>
        </div>
        <div className="text-white/40 text-[9px] mt-0.5 text-center font-mono leading-none">
          {notesCount}
        </div>
        <div className="hidden md:block text-white/25 text-[8px] text-center font-mono leading-none mt-0.5">
          N
        </div>
      </button>
    </div>
  );
}

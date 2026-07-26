'use client';

import { useUIStore } from './UIManager';
import { useGameStore } from '@/stores/gameStore';
import { toggleFieldNotesPanel } from './FieldNotesPanel';
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
 */
export default function Toolbar() {
  const { activePanel, togglePanel } = useUIStore();
  const { unlockedCodex } = useGameStore();

  const allCodexEntries = codex as typeof codex;
  const unlockedCodexCount = unlockedCodex.length;
  const totalCodexCount = allCodexEntries.length;

  const unlockedAchievements = achievementManager.getUnlockedCount();
  const totalAchievements = achievementManager.getTotalCount();

  const buttons: {
    id: 'codex' | 'journal' | 'settings' | 'minimap' | 'help' | 'glossary' | 'achievements' | 'storylog';
    icon: string;
    label: string;
    shortcut: string;
    counter?: string;
  }[] = [
    { id: 'codex', icon: '📖', label: 'Codex', shortcut: 'C', counter: `${unlockedCodexCount}/${totalCodexCount}` },
    { id: 'journal', icon: '📔', label: 'Journal', shortcut: 'J' },
    { id: 'glossary', icon: '📖', label: 'Glossary', shortcut: 'G' },
    { id: 'achievements', icon: '🏆', label: 'Trophies', shortcut: 'A', counter: `${unlockedAchievements}/${totalAchievements}` },
    { id: 'storylog', icon: '📜', label: 'Log', shortcut: 'L' },
    { id: 'minimap', icon: '🗺️', label: 'Map', shortcut: 'M' },
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

      {/* Field Notes — separate toggle (not part of the UIManager single-panel system) */}
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
          you
        </div>
        <div className="hidden md:block text-white/25 text-[8px] text-center font-mono leading-none mt-0.5">
          N
        </div>
      </button>
    </div>
  );
}

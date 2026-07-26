'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from './UIManager';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * SettingsPanel - Sound toggles, reset progress, keyboard reference, and about.
 *
 * v0.3 changes (Round 7):
 *   - Version bumped from v0.2 → v0.3
 *   - Complete keyboard shortcut list (was missing A/G/L/N/B/D/T/Space/WASD/arrows)
 *   - Three clearly-styled sections: Audio, Game Data, Reference
 *   - Visual polish: section headers with icons, color-coded shortcut badges,
 *     decorative corner flourishes, weaving-pattern top border
 */
export default function SettingsPanel() {
  const { resetGame } = useGameStore();
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'settings';

  // Initialize from localStorage lazily to avoid effect-based setState
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('noor-sound') !== 'false';
  });
  const [musicEnabled, setMusicEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('noor-music') !== 'false';
  });

  const toggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('noor-sound', String(enabled));
    window.dispatchEvent(new CustomEvent('noor:setting', { detail: { sound: enabled } }));
  };

  const toggleMusic = (enabled: boolean) => {
    setMusicEnabled(enabled);
    localStorage.setItem('noor-music', String(enabled));
    window.dispatchEvent(new CustomEvent('noor:setting', { detail: { music: enabled } }));
  };

  const handleReset = () => {
    resetGame();
    // Also clear server-side save by sending a reset request
    fetch('/api/save', { method: 'DELETE' }).catch(() => {});
    localStorage.removeItem('noor-save');
    // Clear all secondary localStorage keys too so a fresh start is truly fresh
    localStorage.removeItem('noor-field-notes');
    localStorage.removeItem('noor-discovery-log');
    localStorage.removeItem('noor-stats');
    // Reload the page to fully reset game state
    setTimeout(() => window.location.reload(), 500);
  };

  if (!isOpen) return null;

  // Shortcut groups for the reference table
  const movementShortcuts = [
    { keys: ['W', 'A', 'S', 'D'], desc: 'Move (8-dir)' },
    { keys: ['↑', '↓', '←', '→'], desc: 'Move (arrows)' },
    { keys: ['Space'], desc: 'Talk / advance' },
  ];
  const panelShortcuts = [
    { key: 'C', desc: 'Codex' },
    { key: 'J', desc: 'Journal' },
    { key: 'G', desc: 'Glossary' },
    { key: 'A', desc: 'Achievements' },
    { key: 'L', desc: 'Story Log' },
    { key: 'M', desc: 'Map' },
    { key: 'B', desc: 'About Chapter' },
    { key: 'Q', desc: 'Quote Library' },
    { key: 'T', desc: 'People / NPCs' },
    { key: 'D', desc: 'Discovery Log' },
    { key: 'N', desc: 'Field Notes' },
    { key: 'S', desc: 'Settings' },
    { key: 'H', desc: 'Help' },
    { key: 'Esc', desc: 'Close panel' },
  ];

  return (
    <div className="absolute top-16 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto custom-scroll-amber rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 animate-panel-slide-in">
      {/* Header with weaving pattern */}
      <div className="sticky top-0 z-10 bg-stone-950/97 panel-ornamental-header">
        <div className="filipino-weaving-border h-[5px]" />
        <div className="p-3 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-l from-amber-950/40 to-transparent">
          <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
            <span className="text-base">⚙️</span> Settings
          </h3>
          <button
            onClick={() => togglePanel('settings')}
            className="close-btn-styled w-7 h-7 rounded-md bg-stone-800/40 text-white/60 text-sm flex items-center justify-center"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* ── Section 1: Audio ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-400/80 text-xs">🔊</span>
            <h4 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold">Audio</h4>
            <div className="flex-1 h-px bg-gradient-to-r from-amber-400/20 to-transparent" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium flex items-center gap-2">
                  <span>🔊</span> Sound Effects
                </div>
                <div className="text-white/40 text-xs mt-0.5">UI clicks and notifications</div>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={toggleSound}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium flex items-center gap-2">
                  <span>🎵</span> Background Music
                </div>
                <div className="text-white/40 text-xs mt-0.5">Atmospheric music</div>
              </div>
              <Switch
                checked={musicEnabled}
                onCheckedChange={toggleMusic}
              />
            </div>
          </div>
        </section>

        {/* ── Section 2: Game Data ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-400/80 text-xs">💾</span>
            <h4 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold">Game Data</h4>
            <div className="flex-1 h-px bg-gradient-to-r from-amber-400/20 to-transparent" />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full">
                🗑️ Reset All Progress
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your save data, including:
                  <ul className="list-disc list-inside mt-2 text-xs">
                    <li>Completed objectives and quests</li>
                    <li>Unlocked Codex entries</li>
                    <li>Journal entries</li>
                    <li>Field Notes &amp; Discovery Log</li>
                    <li>Achievements &amp; XP</li>
                    <li>Chapter Medals</li>
                  </ul>
                  <div className="mt-2 text-xs font-semibold text-red-400">This action cannot be undone.</div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Yes, reset everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="text-white/30 text-[10px] mt-2 italic">
            Saves to both localStorage and your account on the server.
          </div>
        </section>

        {/* ── Section 3: Keyboard Reference ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-400/80 text-xs">⌨️</span>
            <h4 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold">Keyboard Shortcuts</h4>
            <div className="flex-1 h-px bg-gradient-to-r from-amber-400/20 to-transparent" />
          </div>

          {/* Movement shortcuts */}
          <div className="mb-3">
            <div className="text-amber-400/50 text-[10px] uppercase tracking-wider mb-1.5">Movement</div>
            <div className="space-y-1">
              {movementShortcuts.map(s => (
                <div key={s.desc} className="flex items-center justify-between text-[10px] text-white/60">
                  <span>{s.desc}</span>
                  <div className="flex items-center gap-0.5">
                    {s.keys.map(k => (
                      <kbd key={k} className="px-1.5 py-0.5 bg-stone-800/80 border border-amber-400/20 rounded text-amber-400 font-mono text-[9px] min-w-[18px] text-center">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel shortcuts */}
          <div>
            <div className="text-amber-400/50 text-[10px] uppercase tracking-wider mb-1.5">Panels</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-white/60">
              {panelShortcuts.map(s => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <kbd className="px-1 py-0 bg-stone-800 rounded text-amber-400 font-mono text-[9px] min-w-[18px] text-center border border-amber-400/20">{s.key}</kbd>
                  <span>{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── About ── */}
        <section className="border-t border-amber-400/20 pt-3">
          <div className="text-center">
            <div className="text-amber-400/80 text-sm font-bold" style={{ fontFamily: 'Georgia, serif' }}>Project Noor v0.4</div>
            <div className="text-white/40 text-[10px] mt-1 italic">
              Educational RPG · Noli Me Tangere
            </div>
            <div className="text-white/25 text-[10px] mt-1">
              Built with Next.js · Canvas · Prisma
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 text-amber-400/30">
              <span>✦</span>
              <span className="text-[10px]">Chapter 1 of 11</span>
              <span>✦</span>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom ornamental border */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
    </div>
  );
}

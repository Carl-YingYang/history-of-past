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
    // Reload the page to fully reset game state
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <>
      {/* Settings gear button */}
      <button
        onClick={() => togglePanel('settings')}
        className={`absolute top-4 right-4 z-20 w-10 h-10 rounded-lg border flex items-center justify-center shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? 'bg-amber-900/80 border-amber-400/60'
            : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90'
        }`}
        title="Settings (S)"
        aria-label="Open settings"
      >
        <span className="text-amber-400 text-base">⚙️</span>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute top-16 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 animate-panel-slide-in">
          <div className="p-3 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-l from-amber-950/40 to-transparent rounded-t-xl panel-ornamental-header">
            <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
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

          <div className="p-4 space-y-4">
            {/* Sound Effects Toggle */}
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

            {/* Background Music Toggle */}
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

            <div className="border-t border-amber-400/20 pt-4">
              {/* Reset Progress */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full">
                    🗑️ Reset Progress
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
                        <li>XP and Chapter Medals</li>
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
            </div>

            {/* About */}
            <div className="border-t border-amber-400/20 pt-3 text-center">
              <div className="text-amber-400/60 text-xs font-semibold">Project Noor v0.2</div>
              <div className="text-white/30 text-[10px] mt-1">
                Educational RPG · Noli Me Tangere
              </div>
              <div className="text-white/20 text-[10px] mt-1">
                Built with Next.js · Canvas · Prisma
              </div>
            </div>

            {/* Keyboard shortcuts reference */}
            <div className="border-t border-amber-400/20 pt-3">
              <div className="text-amber-400/60 text-[10px] uppercase tracking-widest mb-2 font-semibold">
                Keyboard Shortcuts
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-white/60">
                <div><kbd className="px-1 py-0 bg-stone-800 rounded text-amber-400">C</kbd> Codex</div>
                <div><kbd className="px-1 py-0 bg-stone-800 rounded text-amber-400">J</kbd> Journal</div>
                <div><kbd className="px-1 py-0 bg-stone-800 rounded text-amber-400">M</kbd> Map</div>
                <div><kbd className="px-1 py-0 bg-stone-800 rounded text-amber-400">S</kbd> Settings</div>
                <div><kbd className="px-1 py-0 bg-stone-800 rounded text-amber-400">H</kbd> Help</div>
                <div><kbd className="px-1 py-0 bg-stone-800 rounded text-amber-400">Esc</kbd> Close</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

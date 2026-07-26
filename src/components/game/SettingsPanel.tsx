'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
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
  const [isOpen, setIsOpen] = useState(false);
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
    setIsOpen(false);
    // Reload the page to fully reset game state
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <>
      {/* Settings gear button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 right-[280px] z-20 rounded-lg bg-stone-900/90 border border-amber-400/30 p-2 shadow-lg hover:bg-stone-800/90 transition-colors"
        title="Settings"
        aria-label="Open settings"
      >
        <div className="text-amber-400 font-bold text-xs">⚙️</div>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute top-16 right-[280px] z-30 w-72 rounded-xl bg-stone-900/95 border border-amber-400/30 shadow-2xl">
          <div className="p-3 border-b border-amber-400/20 flex items-center justify-between">
            <h3 className="text-amber-400 font-bold text-sm">⚙️ Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/50 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-medium">🔊 Sound Effects</div>
                <div className="text-white/40 text-xs">UI clicks and notifications</div>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={toggleSound}
              />
            </div>

            {/* Background Music Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-medium">🎵 Background Music</div>
                <div className="text-white/40 text-xs">Atmospheric music</div>
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
              <div className="text-amber-400/60 text-xs">Project Noor v0.1</div>
              <div className="text-white/30 text-xs mt-1">Educational RPG · Noli Me Tangere</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

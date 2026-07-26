'use client';

import { useEffect, useState } from 'react';
import GameCanvas from '@/components/game/GameCanvas';
import DialogueBox from '@/components/game/DialogueBox';
import QuestTracker from '@/components/game/QuestTracker';
import CodexPanel from '@/components/game/CodexPanel';
import JournalPanel from '@/components/game/JournalPanel';
import SettingsPanel from '@/components/game/SettingsPanel';
import Minimap from '@/components/game/Minimap';
import HUD from '@/components/game/HUD';
import TouchControls from '@/components/game/TouchControls';
import InteractButton from '@/components/game/InteractButton';
import ChapterCompleteScreen from '@/components/game/ChapterCompleteScreen';
import HelpPanel from '@/components/game/HelpPanel';
import IntroScreen from '@/components/game/IntroScreen';
import {
  GlobalKeyboardShortcuts,
  ModalBackdrop,
  useUIStore,
} from '@/components/game/UIManager';
import { soundManager } from '@/lib/game/soundManager';
import { useGameStore } from '@/stores/gameStore';

export default function Home() {
  const [audioReady, setAudioReady] = useState(false);
  const { chapterComplete } = useGameStore();
  const { activePanel } = useUIStore();

  // Set page title and init sound on first user gesture
  useEffect(() => {
    document.title = 'Project Noor — A Stranger in San Diego';

    // Initialize audio context on first user interaction (browser autoplay policy)
    const initAudio = () => {
      if (audioReady) return;
      soundManager.initOnUserGesture();
      setAudioReady(true);
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    document.addEventListener('touchstart', initAudio);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, [audioReady]);

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Global keyboard shortcuts mounted once at root */}
      <GlobalKeyboardShortcuts />

      {/* Header */}
      <header className="bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/40 border-b border-amber-400/20 px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-lg tracking-wide">Project Noor</span>
              <span className="hidden sm:inline text-amber-400/40">|</span>
              <span className="hidden sm:inline text-white/70 text-sm italic">Noli Me Tangere — 1887</span>
            </div>
          </div>
          <div className="text-amber-400/60 text-xs font-medium tracking-wider uppercase hidden md:block">
            Chapter 1: A Stranger in San Diego
          </div>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 relative overflow-hidden" style={{ minHeight: '500px' }}>
        <GameCanvas />

        {/* Intro / title screen overlay (fades out once game has started) */}
        <IntroScreen />

        {/* Modal backdrop dims the game when a panel is open */}
        <ModalBackdrop />

        {/* Dialogue box (hidden automatically when a panel is open) */}
        <DialogueBox />

        {/* Top-bar panels */}
        <CodexPanel />
        <JournalPanel />
        <SettingsPanel />
        <Minimap />
        <HelpPanel />

        {/* HUD (XP, time, medal, chapter progress) */}
        <HUD />

        {/* Quest tracker sidebar (top-right) */}
        <QuestTracker />

        {/* Touch controls (bottom-left, also visible on desktop for accessibility) */}
        {!chapterComplete && activePanel === null && (
          <>
            <TouchControls />
            <InteractButton />
          </>
        )}

        {/* End-of-chapter summary screen */}
        <ChapterCompleteScreen />
      </main>

      {/* Footer - sticky to bottom */}
      <footer className="bg-stone-900/95 border-t border-amber-400/20 px-4 py-2 mt-auto shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-amber-400/60 text-xs">
            📚 An educational RPG based on José Rizal&apos;s <em>Noli Me Tangere</em>
          </div>
          <div className="text-white/30 text-xs hidden sm:block">
            WASD: Move · Space: Talk · C/J/M/S: Panels · H: Help · Esc: Close
          </div>
        </div>
      </footer>
    </div>
  );
}

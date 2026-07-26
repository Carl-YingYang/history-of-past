'use client';

import { useEffect } from 'react';
import GameCanvas from '@/components/game/GameCanvas';
import DialogueBox from '@/components/game/DialogueBox';
import QuestTracker from '@/components/game/QuestTracker';
import CodexPanel from '@/components/game/CodexPanel';
import HUD from '@/components/game/HUD';
import ChapterCompleteScreen from '@/components/game/ChapterCompleteScreen';

export default function Home() {
  // Set page title
  useEffect(() => {
    document.title = 'Project Noor — A Stranger in San Diego';
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Header */}
      <header className="bg-stone-900/95 border-b border-amber-400/20 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 font-bold text-lg">Project Noor</span>
            <span className="text-white/40 text-sm">|</span>
            <span className="text-white/70 text-sm italic">Noli Me Tangere — 1887</span>
          </div>
          <div className="text-white/40 text-xs">
            Chapter 1: A Stranger in San Diego
          </div>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 relative" style={{ minHeight: '500px' }}>
        <GameCanvas />
        <DialogueBox />
        <QuestTracker />
        <CodexPanel />
        <HUD />
        <ChapterCompleteScreen />
      </main>

      {/* Footer */}
      <footer className="bg-stone-900/95 border-t border-amber-400/20 px-4 py-2 mt-auto">
        <div className="flex items-center justify-between">
          <div className="text-white/40 text-xs">
            An educational RPG based on José Rizal&apos;s Noli Me Tangere
          </div>
          <div className="text-white/30 text-xs">
            WASD: Move · Space: Interact · Esc: Close panels
          </div>
        </div>
      </footer>
    </div>
  );
}

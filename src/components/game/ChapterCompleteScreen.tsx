'use client';

import { useGameStore } from '@/stores/gameStore';
import chapters from '@/data/chapters.json';

export default function ChapterCompleteScreen() {
  const { chapterComplete, xp, unlockedCodex, chapterMedals } = useGameStore();

  if (!chapterComplete) return null;

  const chapter = chapters.find(c => c.id === 'ch1');

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="rounded-2xl bg-stone-900/95 border-2 border-amber-400/50 p-8 max-w-lg text-center shadow-2xl">
        <div className="text-amber-400 text-5xl mb-4">🏅</div>
        
        <h1 className="text-3xl font-bold text-white mb-2">Chapter Complete!</h1>
        
        <div className="text-amber-400 text-xl font-semibold mb-4">
          {chapter?.title}
        </div>
        
        <div className="space-y-4 mb-6">
          {/* Medal */}
          <div className="rounded-lg bg-amber-900/20 p-3 border border-amber-400/30">
            <div className="text-amber-400 text-lg font-bold">Medal: {chapter?.medal}</div>
            <div className="text-white/60 text-sm">{chapter?.medalDescription}</div>
          </div>
          
          {/* XP earned */}
          <div className="rounded-lg bg-stone-800/30 p-3 border border-stone-700/30">
            <div className="text-white text-sm">
              Knowledge XP: <span className="text-amber-400 font-bold">{xp}</span>
            </div>
          </div>
          
          {/* Codex unlocks */}
          <div className="rounded-lg bg-stone-800/30 p-3 border border-stone-700/30">
            <div className="text-white text-sm mb-2">Codex Entries Unlocked:</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {unlockedCodex.map(id => {
                const entry = chapter?.codexUnlockIds?.includes(id) ? id : null;
                if (!entry) return null;
                return (
                  <span key={id} className="text-xs bg-amber-900/30 border border-amber-400/30 rounded px-2 py-1 text-amber-400">
                    {id.replace('char.', '')}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="text-white/50 text-xs mb-4">
          Your progress has been saved. Check the Codex for detailed entries about what you learned.
        </div>
        
        <div className="text-emerald-400 text-sm">
          🎓 This was Chapter 1 — more chapters coming soon!
        </div>
      </div>
    </div>
  );
}

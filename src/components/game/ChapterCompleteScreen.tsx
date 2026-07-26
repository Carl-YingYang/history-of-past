'use client';

import { useGameStore } from '@/stores/gameStore';
import chapters from '@/data/chapters.json';
import codex from '@/data/codex.json';

export default function ChapterCompleteScreen() {
  const { chapterComplete, xp, unlockedCodex, chapterMedals } = useGameStore();

  if (!chapterComplete) return null;

  const chapter = chapters.find(c => c.id === 'ch1');
  const unlockedEntries = codex.filter(e => unlockedCodex.includes(e.id));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="rounded-2xl bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/40 border-2 border-amber-400/50 p-8 max-w-lg w-full text-center shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Medal icon */}
        <div className="text-7xl mb-4 animate-bounce">🏅</div>

        <div className="text-amber-400/60 text-xs tracking-widest uppercase font-bold mb-1">Chapter Complete</div>
        <h1 className="text-3xl font-bold text-white mb-2">{chapter?.title}</h1>

        {/* Decorative divider */}
        <div className="flex items-center justify-center gap-2 my-4">
          <div className="h-px bg-gradient-to-r from-transparent to-amber-400/50 w-16" />
          <div className="text-amber-400/60 text-xs">✦</div>
          <div className="h-px bg-gradient-to-l from-transparent to-amber-400/50 w-16" />
        </div>

        <div className="space-y-3 mb-6 text-left">
          {/* Medal earned */}
          <div className="rounded-xl bg-gradient-to-br from-amber-900/30 to-amber-950/20 p-4 border border-amber-400/30">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏅</div>
              <div className="flex-1">
                <div className="text-amber-400/60 text-xs uppercase tracking-wide">Medal Earned</div>
                <div className="text-amber-400 text-lg font-bold">{chapter?.medal}</div>
                <div className="text-white/60 text-xs italic mt-1">{chapter?.medalDescription}</div>
              </div>
            </div>
          </div>

          {/* XP earned */}
          <div className="rounded-xl bg-stone-800/40 p-4 border border-stone-700/30">
            <div className="flex items-center gap-3">
              <div className="text-3xl">⭐</div>
              <div className="flex-1">
                <div className="text-white/60 text-xs uppercase tracking-wide">Knowledge XP</div>
                <div className="text-amber-400 text-lg font-bold">{xp} XP</div>
              </div>
            </div>
          </div>

          {/* Codex unlocks */}
          <div className="rounded-xl bg-stone-800/40 p-4 border border-stone-700/30">
            <div className="flex items-start gap-3">
              <div className="text-3xl">📖</div>
              <div className="flex-1">
                <div className="text-white/60 text-xs uppercase tracking-wide mb-2">Codex Entries Unlocked</div>
                <div className="flex flex-wrap gap-1.5">
                  {unlockedEntries.map(entry => (
                    <span
                      key={entry.id}
                      className="text-xs bg-amber-900/30 border border-amber-400/30 rounded px-2 py-1 text-amber-400"
                    >
                      {(entry as any).icon || '📄'} {entry.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress saved */}
        <div className="rounded-lg bg-emerald-900/20 border border-emerald-400/30 p-3 mb-4">
          <div className="text-emerald-400 text-sm flex items-center justify-center gap-2">
            <span>✓</span>
            <span>Progress saved to your account</span>
          </div>
        </div>

        <div className="text-white/50 text-xs">
          📚 Check the Codex and Journal panels to review what you learned.
        </div>

        <div className="mt-4 pt-4 border-t border-amber-400/10">
          <div className="text-amber-400/60 text-sm font-semibold">
            🎓 Chapter 1 Complete!
          </div>
          <div className="text-white/40 text-xs mt-1">
            More chapters coming soon...
          </div>
        </div>
      </div>
    </div>
  );
}

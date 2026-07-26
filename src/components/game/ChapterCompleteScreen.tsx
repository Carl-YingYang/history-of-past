'use client';

import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from './UIManager';
import chapters from '@/data/chapters.json';
import codex from '@/data/codex.json';

export default function ChapterCompleteScreen() {
  const { chapterComplete, xp, unlockedCodex, chapterMedals, resetGame } = useGameStore();
  const { closePanel } = useUIStore();

  if (!chapterComplete) return null;

  const chapter = chapters.find(c => c.id === 'ch1');
  const unlockedEntries = codex.filter(e => unlockedCodex.includes(e.id));

  const handleNewGame = () => {
    // Close any open panel first
    closePanel();
    // Reset the game state
    resetGame();
    // Reload the page to get fresh canvas state
    window.location.reload();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="rounded-2xl bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/40 border-2 border-amber-400/50 p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl max-h-[90vh] overflow-y-auto animate-panel-slide-in">
        {/* Medal icon with animation */}
        <div className="relative mb-4">
          <div className="text-7xl animate-bounce inline-block">🏅</div>
          {/* Celebration sparkle particles */}
          <div className="absolute -top-2 left-1/2 w-2 h-2 rounded-full bg-amber-400 animate-sparkle" style={{ animationDelay: '0.1s' }} />
          <div className="absolute -top-4 right-1/3 w-1.5 h-1.5 rounded-full bg-amber-300 animate-sparkle" style={{ animationDelay: '0.3s' }} />
          <div className="absolute -top-1 left-1/3 w-1.5 h-1.5 rounded-full bg-amber-500 animate-sparkle" style={{ animationDelay: '0.5s' }} />
        </div>

        <div className="text-amber-400/60 text-xs tracking-widest uppercase font-bold mb-1">Chapter Complete</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>{chapter?.title}</h1>

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
                <div className="mt-1 h-1.5 bg-stone-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 rounded-full" style={{ width: `${Math.min(100, xp)}%` }} />
                </div>
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

        <div className="text-white/50 text-xs mb-4">
          📚 Check the Codex and Journal panels to review what you learned.
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {/* New Game button */}
          <button
            onClick={handleNewGame}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                       bg-gradient-to-br from-amber-600 to-amber-800 text-white font-bold tracking-wide
                       border-2 border-amber-400/50 shadow-lg shadow-amber-900/30
                       hover:from-amber-500 hover:to-amber-700 hover:scale-[1.02]
                       active:scale-100 transition-all duration-200"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <span className="text-lg">🔄</span>
            <span>Start New Journey</span>
          </button>

          {/* Continue reviewing button */}
          <button
            onClick={() => {
              // Just close the complete screen overlay so user can explore/review panels
              // We set chapterComplete to false temporarily
              // Actually, let's keep it visible but allow panel navigation
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl
                       bg-stone-800/60 text-white/70 font-medium
                       border border-stone-700/40 shadow-md
                       hover:bg-stone-700/80 hover:text-white/90 hover:scale-[1.02]
                       active:scale-100 transition-all duration-200 text-sm"
          >
            <span>📖</span>
            <span>Review Codex & Journal</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-amber-400/10">
          <div className="text-amber-400/60 text-sm font-semibold">
            🎓 Chapter 1 Complete!
          </div>
          <div className="text-white/40 text-xs mt-1">
            More chapters coming soon — stay curious, stay Filipino.
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import codex from '@/data/codex.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function CodexPanel() {
  const { unlockedCodex, codexEntries } = useGameStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  const unlockedEntries = codexEntries.filter(e => unlockedCodex.includes(e.id));

  if (!isOpen && unlockedEntries.length === 0) return null;

  const selectedData = codexEntries.find(e => e.id === selectedEntry);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 left-4 z-20 rounded-lg bg-stone-900/90 border border-amber-400/30 p-2 shadow-lg hover:bg-stone-800/90 transition-colors"
        title="Rizal Codex"
      >
        <div className="text-amber-400 font-bold text-xs">📖 Codex</div>
        {unlockedEntries.length > 0 && (
          <div className="text-white/50 text-xs mt-0.5">{unlockedEntries.length} entries</div>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-16 left-4 z-30 w-80 rounded-xl bg-stone-900/95 border border-amber-400/30 shadow-2xl">
          <div className="p-3 border-b border-amber-400/20">
            <div className="flex items-center justify-between">
              <h3 className="text-amber-400 font-bold text-sm">📖 Rizal Codex</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/50 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          <ScrollArea className="max-h-80">
            <div className="p-3 space-y-2">
              {unlockedEntries.length === 0 ? (
                <div className="text-white/50 text-sm text-center py-4">
                  No entries unlocked yet. Explore the town to learn more!
                </div>
              ) : (
                unlockedEntries.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry.id === selectedEntry ? null : entry.id)}
                    className={`w-full text-left rounded-lg p-3 transition-colors ${
                      selectedEntry === entry.id
                        ? 'bg-amber-900/30 border border-amber-400/50'
                        : 'bg-stone-800/30 border border-stone-700/30 hover:bg-stone-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-semibold">{entry.name}</span>
                      <Badge variant="outline" className={`text-xs ${
                        entry.kind === 'fictional' 
                          ? 'border-amber-400/50 text-amber-400' 
                          : 'border-emerald-400/50 text-emerald-400'
                      }`}>
                        {entry.kind === 'fictional' ? '✍ Fictional' : '🏛 Historical'}
                      </Badge>
                    </div>
                    {selectedEntry === entry.id && (
                      <div className="mt-2 text-white/70 text-xs leading-relaxed">
                        {entry.summary}
                        {entry.details && (
                          <div className="mt-2 text-white/50 italic">{entry.details}</div>
                        )}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
}

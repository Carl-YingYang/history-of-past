'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function JournalPanel() {
  const { journalEntries } = useGameStore();
  const [isOpen, setIsOpen] = useState(false);

  const sortedEntries = [...journalEntries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 left-32 z-20 rounded-lg bg-stone-900/90 border border-amber-400/30 p-2 shadow-lg hover:bg-stone-800/90 transition-colors"
        title="Journal"
      >
        <div className="text-amber-400 font-bold text-xs">📔 Journal</div>
        {journalEntries.length > 0 && (
          <div className="text-white/50 text-xs mt-0.5">{journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}</div>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-16 left-32 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-900/95 border border-amber-400/30 shadow-2xl">
          <div className="p-3 border-b border-amber-400/20 flex items-center justify-between">
            <h3 className="text-amber-400 font-bold text-sm">📔 Journal Entries</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/50 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <ScrollArea className="max-h-96">
            <div className="p-3 space-y-3">
              {sortedEntries.length === 0 ? (
                <div className="text-white/50 text-sm text-center py-8">
                  <div className="text-3xl mb-2">📔</div>
                  No journal entries yet.
                  <div className="text-xs mt-1 text-white/30">Explore San Diego to record your observations.</div>
                </div>
              ) : (
                sortedEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="rounded-lg p-3 bg-amber-950/20 border border-amber-400/20 hover:border-amber-400/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs border-amber-400/50 text-amber-400">
                        Entry #{sortedEntries.length - idx}
                      </Badge>
                      <span className="text-white/40 text-xs">
                        {new Date(entry.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-white/80 text-sm leading-relaxed italic" style={{ fontFamily: 'Georgia, serif' }}>
                      &ldquo;{entry.text}&rdquo;
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
}

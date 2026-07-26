'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from './UIManager';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function JournalPanel() {
  const { journalEntries } = useGameStore();
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'journal';

  const sortedEntries = [...journalEntries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => togglePanel('journal')}
        className={`absolute top-4 left-[88px] z-20 rounded-lg border p-2 shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? 'bg-amber-900/80 border-amber-400/60'
            : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90'
        }`}
        title="Journal (J)"
        aria-label="Open Journal"
      >
        <div className="text-amber-400 font-bold text-xs flex items-center gap-1">
          <span className="text-sm">📔</span> Journal
        </div>
        {journalEntries.length > 0 ? (
          <div className="text-white/50 text-[10px] mt-0.5 text-center font-mono">
            {journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}
          </div>
        ) : (
          <div className="text-white/30 text-[10px] mt-0.5 text-center">empty</div>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-16 left-[88px] z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 to-transparent rounded-t-xl">
            <div>
              <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
                <span className="text-base">📔</span> Journal Entries
              </h3>
              <div className="text-white/40 text-xs mt-0.5">
                {journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'} recorded
              </div>
            </div>
            <button
              onClick={() => togglePanel('journal')}
              className="w-7 h-7 rounded-md hover:bg-stone-800 text-white/60 hover:text-white text-sm flex items-center justify-center"
              aria-label="Close Journal"
            >
              ✕
            </button>
          </div>

          <ScrollArea className="h-[440px]">
            <div className="p-3 space-y-3">
              {sortedEntries.length === 0 ? (
                <div className="text-white/50 text-sm text-center py-12">
                  <div className="text-5xl mb-3 opacity-60">📔</div>
                  <div className="text-white/70">No journal entries yet.</div>
                  <div className="text-xs mt-2 text-white/30 max-w-[260px] mx-auto leading-relaxed">
                    As you explore San Diego and meet its people, your observations will be recorded here.
                  </div>
                </div>
              ) : (
                sortedEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="rounded-lg p-3 bg-amber-950/20 border border-amber-400/20 hover:border-amber-400/40 hover:bg-amber-950/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400/50 text-amber-400 bg-amber-950/30">
                        Entry #{sortedEntries.length - idx}
                      </Badge>
                      <span className="text-white/40 text-[10px]">
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

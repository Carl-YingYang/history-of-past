'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from './UIManager';
import codex from '@/data/codex.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function CodexPanel() {
  const { unlockedCodex } = useGameStore();
  const { activePanel, togglePanel } = useUIStore();
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('all');

  const isOpen = activePanel === 'codex';

  const allEntries = codex as typeof codex;
  const unlockedEntries = allEntries.filter(e => unlockedCodex.includes(e.id));
  const lockedEntries = allEntries.filter(e => !unlockedCodex.includes(e.id));

  // Group by category
  const characters = unlockedEntries.filter(e => e.category === 'characters');
  const places = unlockedEntries.filter(e => e.category === 'places');
  const concepts = unlockedEntries.filter(e => e.category === 'concepts');

  const selectedData = allEntries.find(e => e.id === selectedEntry);

  const renderEntryCard = (entry: typeof codex[0]) => {
    const isSelected = selectedEntry === entry.id;
    const entryColor = (entry as any).color || '#8B7355';
    const entryIcon = (entry as any).icon || '📄';

    return (
      <button
        key={entry.id}
        onClick={() => setSelectedEntry(entry.id === selectedEntry ? null : entry.id)}
        className={`w-full text-left rounded-lg p-3 transition-all border ${
          isSelected
            ? 'bg-amber-900/30 border-amber-400/60 shadow-md shadow-amber-900/20'
            : 'bg-stone-800/40 border-stone-700/40 hover:bg-stone-800/60 hover:border-stone-600/60 hover:translate-x-0.5'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 ring-1 ring-inset ring-white/5"
            style={{ backgroundColor: entryColor + '30', border: `1px solid ${entryColor}50` }}
          >
            {entryIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-white text-sm font-semibold">{entry.name}</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                entry.kind === 'fictional'
                  ? 'border-amber-400/50 text-amber-400 bg-amber-950/30'
                  : 'border-emerald-400/50 text-emerald-400 bg-emerald-950/30'
              }`}>
                {entry.kind === 'fictional' ? '✍ Fictional' : '🏛 Historical'}
              </Badge>
            </div>
            {!isSelected && (
              <div className="text-white/50 text-xs line-clamp-2 leading-snug">
                {entry.summary}
              </div>
            )}
            {isSelected && (
              <div className="mt-2 text-white/75 text-xs leading-relaxed">
                {entry.summary}
                {entry.details && (
                  <div className="mt-2 text-white/55 italic border-l-2 border-amber-400/40 pl-2 leading-relaxed">
                    {entry.details}
                  </div>
                )}
                {entry.relatedEntries && entry.relatedEntries.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider">Related:</span>
                    {entry.relatedEntries.map(relId => {
                      const rel = allEntries.find(e => e.id === relId);
                      const isUnlocked = unlockedCodex.includes(relId);
                      return rel ? (
                        <span
                          key={relId}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isUnlocked
                              ? 'bg-amber-900/30 text-amber-400 cursor-pointer hover:bg-amber-900/50'
                              : 'bg-stone-800/40 text-white/30'
                          }`}
                          onClick={(e) => {
                            if (isUnlocked) {
                              e.stopPropagation();
                              setSelectedEntry(relId);
                            }
                          }}
                        >
                          {rel.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderLockedEntry = (entry: typeof codex[0]) => (
    <div
      key={entry.id}
      className="rounded-lg p-3 bg-stone-900/40 border border-stone-800/40 opacity-60"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center text-lg bg-stone-900/60 border border-stone-800/60">
          🔒
        </div>
        <div>
          <div className="text-white/40 text-sm font-semibold">??? Locked Entry</div>
          <div className="text-white/30 text-xs">Discover more to unlock</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => togglePanel('codex')}
        className={`absolute top-4 left-4 z-20 rounded-lg border p-2 shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? 'bg-amber-900/80 border-amber-400/60'
            : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90'
        }`}
        title="Rizal Codex (C)"
        aria-label="Open Codex"
      >
        <div className="text-amber-400 font-bold text-xs flex items-center gap-1">
          <span className="text-sm">📖</span> Codex
        </div>
        <div className="text-white/50 text-[10px] mt-0.5 text-center font-mono">
          {unlockedEntries.length}/{allEntries.length}
        </div>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-16 left-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 animate-panel-slide-in">
          <div className="p-3 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 to-transparent rounded-t-xl panel-ornamental-header">
            <div>
              <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
                <span className="text-base">📖</span> Rizal Codex
              </h3>
              <div className="text-white/40 text-xs mt-0.5">
                {unlockedEntries.length} of {allEntries.length} entries unlocked
              </div>
            </div>
            <button
              onClick={() => togglePanel('codex')}
              className="close-btn-styled w-7 h-7 rounded-md bg-stone-800/40 text-white/60 text-sm flex items-center justify-center"
              aria-label="Close Codex"
            >
              ✕
            </button>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="px-3 pt-3">
              <TabsList className="w-full bg-stone-900/60 grid grid-cols-4 h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="characters" className="text-xs">People</TabsTrigger>
                <TabsTrigger value="places" className="text-xs">Places</TabsTrigger>
                <TabsTrigger value="concepts" className="text-xs">Concepts</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[420px]">
              <div className="p-3">
                <TabsContent value="all" className="mt-0 space-y-2">
                  {unlockedEntries.length === 0 && lockedEntries.length === 0 ? (
                    <div className="text-white/50 text-sm text-center py-8">
                      <div className="text-3xl mb-2">📖</div>
                      No entries yet.
                      <div className="text-xs mt-1 text-white/30">Explore San Diego to learn more!</div>
                    </div>
                  ) : (
                    <>
                      {unlockedEntries.map(renderEntryCard)}
                      {lockedEntries.length > 0 && (
                        <>
                          <div className="text-white/40 text-[10px] uppercase tracking-widest mt-4 mb-2 px-1 flex items-center gap-2">
                            <div className="h-px flex-1 bg-white/10" />
                            <span>Locked ({lockedEntries.length})</span>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          {lockedEntries.map(renderLockedEntry)}
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="characters" className="mt-0 space-y-2">
                  {characters.length === 0 ? (
                    <div className="text-white/50 text-sm text-center py-8">
                      <div className="text-3xl mb-2">👤</div>
                      No character entries unlocked.
                    </div>
                  ) : (
                    characters.map(renderEntryCard)
                  )}
                </TabsContent>

                <TabsContent value="places" className="mt-0 space-y-2">
                  {places.length === 0 ? (
                    <div className="text-white/50 text-sm text-center py-8">
                      <div className="text-3xl mb-2">🏛</div>
                      No place entries unlocked.
                    </div>
                  ) : (
                    places.map(renderEntryCard)
                  )}
                </TabsContent>

                <TabsContent value="concepts" className="mt-0 space-y-2">
                  {concepts.length === 0 ? (
                    <div className="text-white/50 text-sm text-center py-8">
                      <div className="text-3xl mb-2">💭</div>
                      No concept entries unlocked.
                    </div>
                  ) : (
                    concepts.map(renderEntryCard)
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      )}
    </>
  );
}

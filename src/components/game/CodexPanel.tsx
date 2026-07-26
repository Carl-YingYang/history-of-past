'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import codex from '@/data/codex.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function CodexPanel() {
  const { unlockedCodex } = useGameStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

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
            ? 'bg-amber-900/30 border-amber-400/50 shadow-md'
            : 'bg-stone-800/30 border-stone-700/30 hover:bg-stone-800/50 hover:border-stone-600/50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: entryColor + '30', border: `1px solid ${entryColor}50` }}
          >
            {entryIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-white text-sm font-semibold">{entry.name}</span>
              <Badge variant="outline" className={`text-xs ${
                entry.kind === 'fictional'
                  ? 'border-amber-400/50 text-amber-400'
                  : 'border-emerald-400/50 text-emerald-400'
              }`}>
                {entry.kind === 'fictional' ? '✍ Fictional' : '🏛 Historical'}
              </Badge>
            </div>
            {isSelected && (
              <div className="mt-2 text-white/70 text-xs leading-relaxed">
                {entry.summary}
                {entry.details && (
                  <div className="mt-2 text-white/50 italic border-l-2 border-amber-400/30 pl-2">
                    {entry.details}
                  </div>
                )}
                {entry.relatedEntries && entry.relatedEntries.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <span className="text-white/40 text-xs">Related:</span>
                    {entry.relatedEntries.map(relId => {
                      const rel = allEntries.find(e => e.id === relId);
                      const isUnlocked = unlockedCodex.includes(relId);
                      return rel ? (
                        <span
                          key={relId}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            isUnlocked
                              ? 'bg-amber-900/30 text-amber-400 cursor-pointer hover:bg-amber-900/50'
                              : 'bg-stone-800/30 text-white/30'
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
      className="rounded-lg p-3 bg-stone-900/30 border border-stone-800/30 opacity-50"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-stone-900/50 border border-stone-800/50">
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
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 left-16 z-20 rounded-lg bg-stone-900/90 border border-amber-400/30 p-2 shadow-lg hover:bg-stone-800/90 transition-colors"
        title="Rizal Codex"
      >
        <div className="text-amber-400 font-bold text-xs">📖 Codex</div>
        <div className="text-white/50 text-xs mt-0.5">{unlockedEntries.length}/{allEntries.length}</div>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-16 left-16 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-900/95 border border-amber-400/30 shadow-2xl">
          <div className="p-3 border-b border-amber-400/20 flex items-center justify-between">
            <div>
              <h3 className="text-amber-400 font-bold text-sm">📖 Rizal Codex</h3>
              <div className="text-white/40 text-xs mt-0.5">
                {unlockedEntries.length} of {allEntries.length} entries unlocked
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/50 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <div className="px-3 pt-3">
              <TabsList className="w-full bg-stone-800/50 grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="characters" className="text-xs">People</TabsTrigger>
                <TabsTrigger value="places" className="text-xs">Places</TabsTrigger>
                <TabsTrigger value="concepts" className="text-xs">Concepts</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-80">
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
                          <div className="text-white/40 text-xs uppercase tracking-wider mt-3 mb-1 px-1">
                            Locked ({lockedEntries.length})
                          </div>
                          {lockedEntries.map(renderLockedEntry)}
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="characters" className="mt-0 space-y-2">
                  {characters.length === 0 ? (
                    <div className="text-white/50 text-sm text-center py-8">No character entries unlocked.</div>
                  ) : (
                    characters.map(renderEntryCard)
                  )}
                </TabsContent>

                <TabsContent value="places" className="mt-0 space-y-2">
                  {places.length === 0 ? (
                    <div className="text-white/50 text-sm text-center py-8">No place entries unlocked.</div>
                  ) : (
                    places.map(renderEntryCard)
                  )}
                </TabsContent>

                <TabsContent value="concepts" className="mt-0 space-y-2">
                  {concepts.length === 0 ? (
                    <div className="text-white/50 text-sm text-center py-8">No concept entries unlocked.</div>
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

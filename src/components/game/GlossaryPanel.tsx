'use client';

import { useMemo, useState } from 'react';
import { useUIStore } from './UIManager';
import glossaryData from '@/data/glossary.json';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * GlossaryPanel - Bilingual Filipino/Tagalog → English term reference.
 *
 * Pattern follows CodexPanel: a small icon button in the top bar toggles a
 * modal-style panel (z-50) that floats above the game canvas. The panel is
 * only rendered when `activePanel === 'glossary'` in the central UI store
 * (UIManager), guaranteeing it cannot collide with the Codex, Journal,
 * Settings, Minimap, or Help panels — only one overlay may be open at a time.
 *
 * Keyboard shortcut: G (registered in UIManager's GlobalKeyboardShortcuts).
 */

type GlossaryEntry = {
  id: string;
  term: string;
  pronunciation: string;
  partOfSpeech: string;
  translation: string;
  definition: string;
  example: string;
  exampleTranslation: string;
  category:
    | 'greetings'
    | 'people'
    | 'food'
    | 'objects'
    | 'verbs'
    | 'phrases'
    | 'exclamations';
  firstAvailableChapter: string;
};

const ALL_ENTRIES = glossaryData as GlossaryEntry[];

const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📚' },
  { id: 'greetings', label: 'Greetings', icon: '👋' },
  { id: 'people', label: 'People', icon: '👥' },
  { id: 'food', label: 'Food', icon: '🍚' },
  { id: 'phrases', label: 'Phrases', icon: '💬' },
  { id: 'verbs', label: 'Verbs', icon: '⚡' },
  { id: 'exclamations', label: 'Exclamations', icon: '❗' },
  { id: 'objects', label: 'Objects', icon: '🏛' },
];

// Warm, earth-toned color tokens per category (no indigo/blue).
const CATEGORY_STYLES: Record<string, { badge: string; dot: string }> = {
  greetings: {
    badge: 'border-amber-400/50 text-amber-300 bg-amber-950/40',
    dot: 'bg-amber-400',
  },
  people: {
    badge: 'border-rose-400/50 text-rose-300 bg-rose-950/40',
    dot: 'bg-rose-400',
  },
  food: {
    badge: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/40',
    dot: 'bg-emerald-400',
  },
  phrases: {
    badge: 'border-teal-400/50 text-teal-300 bg-teal-950/40',
    dot: 'bg-teal-400',
  },
  verbs: {
    badge: 'border-orange-400/50 text-orange-300 bg-orange-950/40',
    dot: 'bg-orange-400',
  },
  exclamations: {
    badge: 'border-yellow-400/50 text-yellow-300 bg-yellow-950/40',
    dot: 'bg-yellow-400',
  },
  objects: {
    badge: 'border-stone-400/50 text-stone-200 bg-stone-800/60',
    dot: 'bg-stone-300',
  },
};

export default function GlossaryPanel() {
  const { activePanel, togglePanel } = useUIStore();
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState<string>('');

  const isOpen = activePanel === 'glossary';

  // Filter + sort (alphabetical by term, case-insensitive) — memoized so
  // rapid typing in the search input doesn't re-sort on every keystroke
  // unless the input actually changed.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_ENTRIES.filter((e) => {
      if (tab !== 'all' && e.category !== tab) return false;
      if (!q) return true;
      return (
        e.term.toLowerCase().includes(q) ||
        e.translation.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        e.pronunciation.toLowerCase().includes(q) ||
        e.partOfSpeech.toLowerCase().includes(q) ||
        e.example.toLowerCase().includes(q) ||
        e.exampleTranslation.toLowerCase().includes(q)
      );
    }).sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
  }, [tab, query]);

  const renderCard = (entry: GlossaryEntry) => {
    const style = CATEGORY_STYLES[entry.category] ?? CATEGORY_STYLES.objects;
    return (
      <div
        key={entry.id}
        className="rounded-lg p-3 bg-stone-900/50 border border-stone-700/40 hover:border-amber-400/30 hover:bg-stone-900/70 transition-colors"
      >
        {/* Term header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-white font-bold text-base leading-tight">
                {entry.term}
              </h4>
              <span className="text-amber-400/70 italic text-xs">
                {entry.pronunciation}
              </span>
            </div>
            <div className="text-amber-300/90 text-sm mt-0.5 font-medium">
              {entry.translation}
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 uppercase tracking-wider ${style.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${style.dot}`} />
            {entry.partOfSpeech}
          </Badge>
        </div>

        {/* Definition */}
        <p className="mt-2 text-white/70 text-xs leading-relaxed">
          {entry.definition}
        </p>

        {/* Example sentence */}
        {entry.example && (
          <div className="mt-2 border-l-2 border-amber-400/40 pl-2.5">
            <p className="text-white/80 text-xs italic leading-relaxed">
              “{entry.example}”
            </p>
            <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed">
              “{entry.exampleTranslation}”
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Toggle button (top bar, after Codex + Journal) */}
      <button
        onClick={() => togglePanel('glossary')}
        className={`absolute top-4 left-[172px] z-20 rounded-lg border p-2 shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? 'bg-amber-900/80 border-amber-400/60'
            : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90'
        }`}
        title="Filipino Glossary (G)"
        aria-label="Open Filipino Glossary"
      >
        <div className="text-amber-400 font-bold text-xs flex items-center gap-1">
          <span className="text-sm">📖</span> Glossary
        </div>
        <div className="text-white/50 text-[10px] mt-0.5 text-center font-mono">
          {ALL_ENTRIES.length} terms
        </div>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-2xl rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-stone-950 to-stone-950 rounded-t-xl shrink-0">
            <div>
              <h3 className="text-amber-400 font-bold text-base flex items-center gap-2">
                <span className="text-lg">📖</span> Filipino Glossary
              </h3>
              <div className="text-white/40 text-xs mt-0.5 italic">
                Mga salitang Tagalog · Filipino-English reference
              </div>
            </div>
            <button
              onClick={() => togglePanel('glossary')}
              className="w-8 h-8 rounded-md hover:bg-stone-800 text-white/60 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close Glossary"
            >
              ✕
            </button>
          </div>

          {/* Tabs + Search */}
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="w-full shrink-0"
          >
            <div className="px-3 pt-3">
              <TabsList className="w-full bg-stone-900/60 h-auto flex flex-wrap gap-1 p-1">
                {CATEGORIES.map((c) => (
                  <TabsTrigger
                    key={c.id}
                    value={c.id}
                    className="text-xs h-8 flex-1 min-w-[68px]"
                  >
                    <span className="mr-1">{c.icon}</span>
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Search input — shared across all tabs */}
            <div className="px-3 pt-3">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-400/50 text-sm pointer-events-none">
                  🔍
                </span>
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by term, translation, or meaning…"
                  className="pl-8 bg-stone-900/60 border-stone-700/60 text-white placeholder:text-white/30 text-sm focus-visible:border-amber-400/60"
                  aria-label="Search glossary terms"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded hover:bg-stone-800 text-white/50 hover:text-white text-xs flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable list with custom scrollbar styling */}
            <div
              className="max-h-[70vh] overflow-y-auto p-3
                         [&::-webkit-scrollbar]:w-2
                         [&::-webkit-scrollbar-track]:bg-stone-900/40
                         [&::-webkit-scrollbar-track]:rounded-full
                         [&::-webkit-scrollbar-thumb]:bg-amber-400/30
                         [&::-webkit-scrollbar-thumb]:rounded-full
                         [&::-webkit-scrollbar-thumb:hover]:bg-amber-400/50"
            >
              {CATEGORIES.map((c) => {
                const list =
                  c.id === 'all'
                    ? filtered
                    : filtered.filter((e) => e.category === c.id);
                return (
                  <TabsContent key={c.id} value={c.id} className="mt-0 space-y-2">
                    {list.length === 0 ? (
                      <div className="text-white/50 text-sm text-center py-10">
                        <div className="text-3xl mb-2">🔍</div>
                        {query
                          ? 'No terms match your search.'
                          : `No ${c.label.toLowerCase()} entries yet.`}
                        <div className="text-xs mt-1 text-white/30">
                          {query
                            ? 'Try a different word or clear the search.'
                            : 'Try another category or search term.'}
                        </div>
                      </div>
                    ) : (
                      list.map(renderCard)
                    )}
                  </TabsContent>
                );
              })}
            </div>
          </Tabs>

          {/* Footer — term count */}
          <div className="p-2.5 border-t border-amber-400/20 bg-stone-950/80 rounded-b-xl shrink-0">
            <div className="text-center text-white/40 text-[11px] font-mono tracking-wider">
              {filtered.length} of {ALL_ENTRIES.length} terms
              {query && (
                <span className="text-amber-400/60 ml-1">
                  · matching “{query}”
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

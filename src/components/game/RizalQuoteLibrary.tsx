'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUIStore } from './UIManager';
import { Input } from '@/components/ui/input';
import rizalQuotes from '@/data/rizalQuotes.json';

/**
 * RizalQuoteLibrary - Browse all 16 Rizal quotes, filter by category,
 * search by text, save favorites to localStorage.
 *
 * Uses the shared useUIStore panel system (panel id: 'quotes').
 * Renders when `activePanel === 'quotes'`.
 * Keyboard shortcut: Q (registered in UIManager GlobalKeyboardShortcuts).
 *
 * Favorites stored in localStorage 'noor-favorite-quotes' as array of quote indices.
 * Favorite toggle dispatches 'noor:quotes-updated' custom event with { favoritesCount }.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RizalQuote {
  id: string;
  text: string;
  source: string;
  tagalog: string;
  category: string;
  original: string | null;
}

type CategoryFilter = 'all' | 'language' | 'education' | 'freedom' | 'youth' | 'patriotism' | 'novel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'noor-favorite-quotes';
const QUOTES_UPDATE_EVENT = 'noor:quotes-updated';

const ALL_QUOTES: RizalQuote[] = rizalQuotes as RizalQuote[];

const CATEGORY_ORDER: CategoryFilter[] = [
  'all', 'language', 'education', 'freedom', 'youth', 'patriotism', 'novel',
];

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All',
  language: 'Language',
  education: 'Education',
  freedom: 'Freedom',
  youth: 'Youth',
  patriotism: 'Patriotism',
  novel: 'Novel',
};

const CATEGORY_META: Record<string, {
  pillClass: string;
  icon: string;
}> = {
  language: {
    pillClass: 'bg-amber-400/20 text-amber-300',
    icon: '🗣️',
  },
  education: {
    pillClass: 'bg-emerald-400/20 text-emerald-300',
    icon: '📖',
  },
  freedom: {
    pillClass: 'bg-sky-400/20 text-sky-300',
    icon: '🕊️',
  },
  youth: {
    pillClass: 'bg-pink-400/20 text-pink-300',
    icon: '🌱',
  },
  patriotism: {
    pillClass: 'bg-red-400/20 text-red-300',
    icon: '🇵🇭',
  },
  novel: {
    pillClass: 'bg-purple-400/20 text-purple-300',
    icon: '✒️',
  },
};

// ---------------------------------------------------------------------------
// localStorage helpers (SSR-safe)
// ---------------------------------------------------------------------------

function loadFavorites(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && n >= 0 && n < ALL_QUOTES.length);
  } catch {
    return [];
  }
}

function saveFavorites(list: number[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage full or blocked — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Heart bounce animation (CSS keyframe)
// ---------------------------------------------------------------------------

// We'll use inline styles for the bounce animation since it's per-toggle
const HEART_BOUNCE_STYLE = {
  transition: 'transform 0.15s ease',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RizalQuoteLibrary() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'quotes';

  // Lazy initializer — reads favorites once on first render
  const [favorites, setFavorites] = useState<number[]>(() => loadFavorites());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [bouncingHeart, setBouncingHeart] = useState<number | null>(null);

  // Derived: category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of ALL_QUOTES) {
      counts[q.category] = (counts[q.category] ?? 0) + 1;
    }
    counts['all'] = ALL_QUOTES.length;
    return counts;
  }, []);

  // Derived: unique categories present in data
  const uniqueCategories = useMemo(() => {
    const cats = new Set(ALL_QUOTES.map(q => q.category));
    return cats.size;
  }, []);

  // Derived: filtered + searched list
  const visibleQuotes = useMemo(() => {
    let list = [...ALL_QUOTES];
    if (filter !== 'all') list = list.filter(q => q.category === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(quote =>
        quote.text.toLowerCase().includes(q) ||
        quote.source.toLowerCase().includes(q) ||
        (quote.original && quote.original.toLowerCase().includes(q)) ||
        quote.tagalog.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filter, search]);

  // Toggle favorite for a quote (by index)
  const toggleFavorite = useCallback((index: number) => {
    setFavorites(prev => {
      const isFav = prev.includes(index);
      const next = isFav ? prev.filter(i => i !== index) : [...prev, index];
      saveFavorites(next);

      // Dispatch custom event with updated count
      window.dispatchEvent(new CustomEvent(QUOTES_UPDATE_EVENT, {
        detail: { favoritesCount: next.length },
      }));

      // Trigger bounce animation
      setBouncingHeart(index);
      setTimeout(() => setBouncingHeart(null), 300);

      return next;
    });
  }, []);

  // Copy quote text to clipboard
  const handleShare = useCallback(async (quote: RizalQuote) => {
    const textToCopy = `"${quote.text}" — ${quote.source}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(textarea);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-16 left-4 z-50 w-[460px] max-w-[calc(100vw-2rem)] max-h-[80vh] rounded-xl bg-stone-950/95 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in flex flex-col overflow-hidden"
      role="dialog"
      aria-label="Rizal Quote Library"
    >
      {/* Header */}
      <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/50 via-stone-950 to-stone-950 panel-ornamental-header shrink-0">
        <div>
          <h3
            className="text-amber-400 font-bold text-base flex items-center gap-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <span className="text-lg">💡</span> Rizal Quote Library <span className="text-amber-400/60 text-sm" aria-hidden="true">✦</span>
          </h3>
          <div className="text-white/50 text-xs mt-0.5">
            Words of wisdom from José Rizal
          </div>
        </div>
        <button
          type="button"
          onClick={() => togglePanel('quotes')}
          className="close-btn-styled w-8 h-8 rounded-md bg-stone-800/40 text-white/60 flex items-center justify-center shrink-0"
          aria-label="Close Quote Library"
        >
          ✕
        </button>
      </div>

      {/* Search + Category filter bar */}
      <div className="p-3 border-b border-amber-400/15 bg-stone-900/40 shrink-0 space-y-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quotes by text, source, or language…"
          className="h-8 text-xs bg-stone-950/80 border-amber-400/20 text-amber-100 placeholder:text-white/30 focus-visible:border-amber-400/60"
          aria-label="Search quotes"
        />
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORY_ORDER.map(chip => {
            const isActive = filter === chip;
            const count = categoryCounts[chip] ?? 0;
            const meta = chip !== 'all' ? CATEGORY_META[chip] : null;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setFilter(chip)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                  isActive
                    ? meta
                      ? `${meta.pillClass} border-current/40`
                      : 'bg-amber-900/50 border-amber-400/60 text-amber-300'
                    : 'bg-stone-800/40 border-white/10 text-white/50 hover:text-white/80'
                }`}
                aria-pressed={isActive}
              >
                {CATEGORY_LABELS[chip]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable quote cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scroll-amber">
        {visibleQuotes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3 opacity-50">📜</div>
            <div
              className="text-amber-300/80 text-sm italic"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              No quotes match your search.
            </div>
            <div className="text-xs mt-3 text-white/30 max-w-[280px] mx-auto leading-relaxed">
              Try a different keyword or change the category filter.
            </div>
          </div>
        ) : (
          visibleQuotes.map((quote, idx) => {
            // Find the original index in ALL_QUOTES for favorites tracking
            const originalIndex = ALL_QUOTES.indexOf(quote);
            const isFav = favorites.includes(originalIndex);
            const meta = CATEGORY_META[quote.category];
            const isBouncing = bouncingHeart === originalIndex;

            return (
              <div
                key={quote.id}
                className="rounded-lg p-3 bg-gradient-to-br from-amber-950/20 to-stone-950/30 border border-amber-400/15 hover:border-amber-400/30 transition-colors relative corner-flourish"
              >
                {/* Quote text */}
                <p
                  className="text-white/85 text-sm leading-relaxed italic"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  &ldquo;{quote.text}&rdquo;
                </p>

                {/* Original Spanish text */}
                {quote.original && (
                  <p className="mt-1.5 text-amber-400/70 text-xs italic leading-snug">
                    <span className="text-amber-500/50 not-italic text-[10px] uppercase tracking-wider">orig.</span>{' '}
                    {quote.original}
                  </p>
                )}

                {/* Source attribution */}
                <div className="mt-2 text-[11px] text-white/50 leading-snug not-italic">
                  — {quote.source}
                </div>

                {/* Bottom row: category badge + actions */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {/* Category pill */}
                  {meta && (
                    <span className={`rounded-full text-[9px] px-2 py-0.5 ${meta.pillClass}`}>
                      {CATEGORY_LABELS[quote.category as CategoryFilter]}
                    </span>
                  )}

                  {/* Actions: favorite + share */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(originalIndex)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all hover:bg-stone-800/50"
                      style={isBouncing ? { ...HEART_BOUNCE_STYLE, transform: 'scale(1.35)' } : HEART_BOUNCE_STYLE}
                      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFav ? '❤️' : '🤍'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(quote)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm bg-stone-800/30 hover:bg-stone-700/50 text-white/60 hover:text-white/90 transition-colors"
                      aria-label="Copy quote to clipboard"
                      title="Copy quote to clipboard"
                    >
                      📋
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-amber-400/15 bg-stone-900/40 shrink-0">
        <div className="text-[10px] text-white/50 text-center">
          <span className="text-amber-300/90 font-semibold">{ALL_QUOTES.length}</span> quotes
          <span className="text-white/30 mx-1">·</span>
          <span className="text-amber-300/90 font-semibold">{favorites.length}</span> favorites
          <span className="text-white/30 mx-1">·</span>
          <span className="text-amber-300/90 font-semibold">{uniqueCategories}</span> categories
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported helper (used by Toolbar / game code / keyboard shortcut)
// ---------------------------------------------------------------------------

/**
 * Toggle the Rizal Quote Library panel open/closed from anywhere.
 * Safe to call on the server (no-op).
 */
export function toggleRizalQuoteLibrary() {
  if (typeof window === 'undefined') return;
  const store = useUIStore.getState();
  store.togglePanel('quotes');
}

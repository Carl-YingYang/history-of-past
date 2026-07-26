'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from './UIManager';
import codex from '@/data/codex.json';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type CodexEntry = typeof codex[0];

// Category mapping: codex.json → tab labels
const CATEGORY_TAB_MAP: Record<string, string> = {
  characters: 'People',
  places: 'Places',
  concepts: 'Concepts',
};

// Category icons for empty state
const CATEGORY_EMPTY_ICONS: Record<string, string> = {
  characters: '👤',
  places: '🏛',
  concepts: '💭',
};

export default function CodexPanel() {
  const { unlockedCodex } = useGameStore();
  const { activePanel, togglePanel } = useUIStore();
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('all');

  // Track newly unlocked entries for sparkle animation
  const prevUnlockedRef = useRef<string[]>(unlockedCodex);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

  useEffect(() => {
    const prev = prevUnlockedRef.current;
    const newIds = unlockedCodex.filter(id => !prev.includes(id));
    if (newIds.length > 0) {
      setNewlyUnlocked(newIds);
      // Clear the sparkle state after animation completes
      setTimeout(() => setNewlyUnlocked([]), 1200);
    }
    prevUnlockedRef.current = unlockedCodex;
  }, [unlockedCodex]);

  const isOpen = activePanel === 'codex';

  const allEntries = codex as CodexEntry[];
  const unlockedEntries = allEntries.filter(e => unlockedCodex.includes(e.id));
  const lockedEntries = allEntries.filter(e => !unlockedCodex.includes(e.id));

  // Filter entries by tab, including both unlocked and locked
  const getEntriesByTab = (tabValue: string) => {
    if (tabValue === 'all') return { unlocked: unlockedEntries, locked: lockedEntries };
    const filteredUnlocked = unlockedEntries.filter(e => e.category === tabValue);
    const filteredLocked = lockedEntries.filter(e => e.category === tabValue);
    return { unlocked: filteredUnlocked, locked: filteredLocked };
  };

  const selectedData = allEntries.find(e => e.id === selectedEntry);
  const isUnlocked = (id: string) => unlockedCodex.includes(id);

  // ── Locked entry card ──
  const renderLockedEntry = (entry: CodexEntry) => {
    const entryColor = entry.color || '#8B7355';
    return (
      <div
        key={entry.id}
        className="relative rounded-lg p-3 border border-stone-800/30 overflow-hidden group cursor-not-allowed"
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-stone-950/60 z-10 rounded-lg" />
        {/* Subtle shimmer on hover */}
        <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent" />

        <div className="flex items-start gap-3 relative z-20">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 opacity-40"
            style={{ backgroundColor: entryColor + '15', boxShadow: `0 0 0 1px ${entryColor}20` }}
          >
            🔒
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white/25 text-sm font-semibold tracking-wide">
              ??? {CATEGORY_TAB_MAP[entry.category] || 'Unknown'} Entry
            </div>
            <div className="text-white/15 text-xs mt-1 flex items-center gap-1">
              <span className="text-[10px]">🔓</span>
              <span>Unlock by exploring San Diego</span>
            </div>
            {/* Category hint - small colored dot */}
            <div className="mt-1.5 flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full opacity-30"
                style={{ backgroundColor: entryColor }}
              />
              <span className="text-white/15 text-[10px] uppercase tracking-wider">
                {CATEGORY_TAB_MAP[entry.category] || entry.category}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Unlocked entry card ──
  const renderEntryCard = (entry: CodexEntry) => {
    const isSelected = selectedEntry === entry.id;
    const isExpanded = expandedEntry === entry.id;
    const entryColor = entry.color || '#8B7355';
    const entryIcon = entry.icon || '📄';
    const isNewlyUnlocked = newlyUnlocked.includes(entry.id);

    return (
      <div
        key={entry.id}
        className={`relative rounded-lg p-3 transition-all duration-300 border overflow-hidden ${
          isSelected
            ? 'bg-amber-900/20 border-amber-400/50 shadow-lg shadow-amber-900/20'
            : 'bg-stone-800/30 border-stone-700/30 hover:bg-stone-800/50 hover:border-stone-600/50 hover:shadow-md'
        } ${isNewlyUnlocked ? 'animate-codex-unlock' : ''}`}
      >
        {/* Sparkle particles for newly unlocked */}
        {isNewlyUnlocked && (
          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
            <span className="absolute top-1 left-2 animate-codex-sparkle text-amber-400 text-xs">✦</span>
            <span className="absolute top-2 right-4 animate-codex-sparkle text-amber-300 text-xs" style={{ animationDelay: '0.1s' }}>✦</span>
            <span className="absolute bottom-2 left-4 animate-codex-sparkle text-amber-400 text-sm" style={{ animationDelay: '0.2s' }}>✦</span>
            <span className="absolute bottom-1 right-2 animate-codex-sparkle text-yellow-300 text-xs" style={{ animationDelay: '0.3s' }}>✦</span>
            <span className="absolute top-1/2 left-1 animate-codex-sparkle text-amber-400 text-xs" style={{ animationDelay: '0.15s' }}>✦</span>
          </div>
        )}

        {/* Colored accent line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${entryColor}, transparent)` }}
        />

        <div className="flex items-start gap-3 relative">
          {/* Colored icon circle */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 transition-transform duration-200 group-hover:scale-105"
            style={{
              backgroundColor: entryColor + '20',
              boxShadow: `0 0 0 2px ${entryColor}40, 0 0 8px ${entryColor}15`,
            }}
          >
            {entryIcon}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + Badge row */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-white text-sm font-bold tracking-wide">{entry.name}</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 border font-medium ${
                  entry.kind === 'fictional'
                    ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/25'
                    : 'border-sky-500/50 text-sky-400 bg-sky-950/25'
                }`}
              >
                {entry.kind === 'fictional' ? '✍ Fictional' : '🏛 Historical'}
              </Badge>
            </div>

            {/* Summary - italic style */}
            <div className="text-white/55 text-xs italic leading-relaxed line-clamp-2">
              {entry.summary}
            </div>

            {/* View Details button */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 px-2 text-amber-400/80 hover:text-amber-400 hover:bg-amber-950/30 text-[11px] font-medium"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedEntry(isExpanded ? null : entry.id);
                setSelectedEntry(entry.id);
              }}
            >
              {isExpanded ? '✕ Close Details' : '▼ View Details'}
            </Button>

            {/* Expanded details section */}
            {isExpanded && (
              <div className="mt-2 animate-codex-expand">
                <div className="text-white/65 text-xs leading-relaxed pb-2">
                  {entry.details && (
                    <div className="border-l-2 pl-2.5 italic" style={{ borderColor: entryColor + '60' }}>
                      {entry.details}
                    </div>
                  )}
                </div>

                {/* Related entries - clickable amber buttons */}
                {entry.relatedEntries && entry.relatedEntries.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-white/35 text-[10px] uppercase tracking-wider font-medium">
                      Related:
                    </span>
                    {entry.relatedEntries.map(relId => {
                      const rel = allEntries.find(e => e.id === relId);
                      const relUnlocked = isUnlocked(relId);
                      return rel ? (
                        <button
                          key={relId}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all duration-200 ${
                            relUnlocked
                              ? 'bg-amber-900/25 text-amber-400 hover:bg-amber-900/40 hover:text-amber-300 cursor-pointer border border-amber-500/25 hover:border-amber-500/40'
                              : 'bg-stone-900/30 text-white/20 border border-stone-800/30 cursor-not-allowed'
                          }`}
                          onClick={(e) => {
                            if (relUnlocked) {
                              e.stopPropagation();
                              setSelectedEntry(relId);
                              setExpandedEntry(relId);
                            }
                          }}
                          disabled={!relUnlocked}
                        >
                          {relUnlocked ? rel.name : '???'}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render a tab section with both unlocked and locked entries ──
  const renderTabSection = (tabValue: string) => {
    const { unlocked, locked } = getEntriesByTab(tabValue);
    const total = unlocked.length + locked.length;
    const tabLabel = tabValue === 'all' ? 'All' : CATEGORY_TAB_MAP[tabValue] || tabValue;
    const emptyIcon = tabValue === 'all' ? '📖' : CATEGORY_EMPTY_ICONS[tabValue] || '📄';

    if (total === 0) {
      return (
        <div className="text-white/50 text-sm text-center py-10">
          <div className="text-4xl mb-3 opacity-60">{emptyIcon}</div>
          <div className="font-medium">No {tabLabel} entries yet</div>
          <div className="text-xs mt-1 text-white/30">Explore San Diego to learn more!</div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {/* Unlocked entries */}
        {unlocked.map(renderEntryCard)}

        {/* Locked entries section separator */}
        {locked.length > 0 && (
          <>
            <div className="text-white/35 text-[10px] uppercase tracking-widest mt-3 mb-2 px-1 flex items-center gap-2 font-medium">
              <div className="h-px flex-1 bg-white/10" />
              <span>🔒 Locked ({locked.length})</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            {locked.map(renderLockedEntry)}
          </>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 left-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-amber-400/40 shadow-2xl shadow-amber-950/30 animate-panel-slide-in parchment-texture corner-flourish overflow-hidden"
      style={{ backgroundColor: 'rgba(12,10,8,0.97)' }}
    >
      {/* ── Ornamental Header ── */}
      <div className="relative panel-ornamental-header filipino-weaving-border">
        <div className="p-4 border-b border-amber-400/20 flex items-center justify-between">
          <div>
            <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2 tracking-wide">
              <span className="text-base">📖</span>
              <span>Rizal Codex</span>
              <span className="text-amber-400/40 text-xs">✦</span>
            </h3>
            <div className="text-white/45 text-xs mt-1 flex items-center gap-2">
              <span className="text-amber-500/70 font-medium">{unlockedEntries.length}</span>
              <span className="text-white/30">/</span>
              <span>{allEntries.length}</span>
              <span className="text-white/30">entries unlocked</span>
              <span className="text-amber-400/30">✦</span>
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
      </div>

      {/* ── Category Tabs ── */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-1 bg-stone-900/50 rounded-lg p-1">
          {['all', 'characters', 'places', 'concepts'].map(tabValue => {
            const isActive = tab === tabValue;
            const label = tabValue === 'all' ? 'All' : CATEGORY_TAB_MAP[tabValue] || tabValue;
            const count = tabValue === 'all'
              ? unlockedEntries.length
              : unlockedEntries.filter(e => e.category === tabValue).length;
            return (
              <button
                key={tabValue}
                className={`flex-1 text-xs font-medium rounded-md py-1.5 px-2 transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-900/30 text-amber-400 shadow-sm shadow-amber-900/20 border border-amber-500/30'
                    : 'text-white/40 hover:text-white/60 hover:bg-stone-800/40 border border-transparent'
                }`}
                onClick={() => setTab(tabValue)}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1 text-[10px] ${isActive ? 'text-amber-500/70' : 'text-white/25'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable entries list ── */}
      <div className="max-h-96 overflow-y-auto codex-scroll px-3 pb-3">
        {renderTabSection(tab)}
      </div>

      {/* ── Bottom ornamental border ── */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
    </div>
  );
}

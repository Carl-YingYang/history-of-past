'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUIStore } from './UIManager';
import { storyLogManager, type StoryEvent, type StoryEventType } from '@/lib/game/storyLogManager';
import { gameEvents } from '@/lib/game/eventBus';
import { Badge } from '@/components/ui/badge';

/**
 * StoryLogPanel - Chronological log of every major story event in the game.
 *
 * Follows the same pattern as JournalPanel.tsx:
 *   - Uses `useUIStore` (single source of truth for which overlay is open).
 *   - Renders a toggle button in the top bar + a panel body.
 *   - Body is a vertical-scroll list of cards.
 *
 * Differences from Journal:
 *   - Multiple event types (dialogue / quest / codex / achievement / etc.)
 *   - Filter tabs (All / Dialogue / Quests / Discoveries / Achievements)
 *   - Vertical-timeline visual layout
 *   - "Clear log" action with inline confirmation
 *   - Persists to its own localStorage key (noor-story-log) — separate from
 *     the save data, so the log survives save resets.
 */

// ---------------------------------------------------------------------------
// Filter + display config
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'dialogue' | 'quests' | 'discoveries' | 'achievements';

const FILTER_MAP: Record<FilterTab, StoryEventType[]> = {
  all: [],
  dialogue: ['dialogue-start', 'dialogue-end'],
  quests: ['quest-objective', 'quest-complete'],
  discoveries: ['codex-unlock', 'time-transition', 'panel-opened'],
  achievements: ['chapter-medal', 'chapter-complete', 'xp-gained', 'achievement-unlock'],
};

const TAB_LABELS: Record<FilterTab, string> = {
  all: 'All',
  dialogue: 'Dialogue',
  quests: 'Quests',
  discoveries: 'Discoveries',
  achievements: 'Achievements',
};

interface BadgeStyle {
  label: string;
  className: string;
}

const TYPE_BADGE: Record<StoryEventType, BadgeStyle> = {
  'dialogue-start': {
    label: 'Dialogue',
    className: 'border-sky-400/50 text-sky-300 bg-sky-950/50',
  },
  'dialogue-end': {
    label: 'Dialogue',
    className: 'border-sky-400/50 text-sky-300 bg-sky-950/50',
  },
  'quest-objective': {
    label: 'Quest',
    className: 'border-amber-400/50 text-amber-300 bg-amber-950/50',
  },
  'quest-complete': {
    label: 'Quest',
    className: 'border-amber-400/50 text-amber-300 bg-amber-950/50',
  },
  'chapter-medal': {
    label: 'Medal',
    className: 'border-yellow-400/50 text-yellow-200 bg-yellow-950/50',
  },
  'chapter-complete': {
    label: 'Chapter',
    className: 'border-yellow-400/50 text-yellow-200 bg-yellow-950/50',
  },
  'time-transition': {
    label: 'Time',
    className: 'border-purple-400/50 text-purple-300 bg-purple-950/50',
  },
  'codex-unlock': {
    label: 'Codex',
    className: 'border-purple-400/50 text-purple-300 bg-purple-950/50',
  },
  'xp-gained': {
    label: 'XP',
    className: 'border-yellow-400/50 text-yellow-200 bg-yellow-950/50',
  },
  'panel-opened': {
    label: 'UI',
    className: 'border-stone-400/40 text-stone-300 bg-stone-800/60',
  },
  'achievement-unlock': {
    label: 'Achievement',
    className: 'border-yellow-400/50 text-yellow-200 bg-yellow-950/50',
  },
};

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const date = new Date(ts);
  const isToday = date.toDateString() === new Date(now).toDateString();
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  if (isToday) return `Today ${timeStr}`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoryLogPanel() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'storylog';

  // Start with an empty array on both server and client to avoid hydration
  // mismatches. The actual events are read from storyLogManager after mount
  // (its constructor has loaded localStorage by then).
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [tab, setTab] = useState<FilterTab>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  // Initialize storyLogManager and subscribe to new events.
  useEffect(() => {
    storyLogManager.init();
    // Defer the initial sync to a microtask so we don't call setState
    // synchronously inside the effect body (react-hooks/set-state-in-effect).
    // The events are visible on the next tick — fast enough that the user
    // never sees a flash of empty state.
    queueMicrotask(() => setEvents(storyLogManager.getEvents()));

    const unsub = gameEvents.on('storylog:event', () => {
      setEvents(storyLogManager.getEvents());
    });
    return unsub;
  }, []);

  // Reset the clear-confirmation state if the panel closes.
  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => setConfirmClear(false));
    }
  }, [isOpen]);

  const totalCount = events.length;

  const filteredEvents = useMemo(() => {
    const types = FILTER_MAP[tab];
    if (tab === 'all' || types.length === 0) return events;
    return events.filter(e => types.includes(e.type));
  }, [events, tab]);

  const handleClear = () => {
    storyLogManager.clearLog();
    setConfirmClear(false);
  };

  return (
    <>
      {/* Toggle button in the top bar (next to Journal) */}
      <button
        onClick={() => togglePanel('storylog')}
        className={`absolute top-4 left-[172px] z-20 rounded-lg border p-2 shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? 'bg-amber-900/80 border-amber-400/60'
            : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90'
        }`}
        title="Story Log (L)"
        aria-label="Open Story Log"
        aria-expanded={isOpen}
      >
        <div className="text-amber-400 font-bold text-xs flex items-center gap-1">
          <span className="text-sm">📜</span> Log
        </div>
        {totalCount > 0 ? (
          <div className="text-white/50 text-[10px] mt-0.5 text-center font-mono">
            {totalCount} {totalCount === 1 ? 'event' : 'events'}
          </div>
        ) : (
          <div className="text-white/30 text-[10px] mt-0.5 text-center">empty</div>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute top-16 left-[172px] z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/30 animate-panel-slide-in flex flex-col"
          role="dialog"
          aria-label="Story Log"
        >
          {/* Header */}
          <div className="p-3 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 to-transparent rounded-t-xl shrink-0 panel-ornamental-header">
            <div>
              <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2">
                <span className="text-base">📜</span> Story Log
              </h3>
              <div className="text-white/40 text-xs mt-0.5">
                {totalCount} {totalCount === 1 ? 'event' : 'events'} recorded
              </div>
            </div>
            <button
              onClick={() => togglePanel('storylog')}
              className="close-btn-styled w-7 h-7 rounded-md bg-stone-800/40 text-white/60 text-sm flex items-center justify-center"
              aria-label="Close Story Log"
            >
              ✕
            </button>
          </div>

          {/* Filter tabs */}
          <div className="px-3 pt-3 shrink-0">
            <div
              role="tablist"
              aria-label="Filter story events by category"
              className="w-full bg-stone-900/60 grid grid-cols-5 h-9 rounded-lg p-[3px] gap-[2px]"
            >
              {(Object.keys(TAB_LABELS) as FilterTab[]).map(t => {
                const isActive = tab === t;
                return (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTab(t)}
                    className={`text-xs rounded-md border border-transparent transition-colors ${
                      isActive
                        ? 'bg-amber-900/60 text-amber-300 border-amber-400/40 shadow-sm'
                        : 'text-white/50 hover:text-white/80 hover:bg-stone-800/60'
                    }`}
                  >
                    {TAB_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable event list (timeline) */}
          <div
            className="flex-1 overflow-y-auto max-h-[70vh] py-3 px-3
                       [scrollbar-width:thin]
                       [&::-webkit-scrollbar]:w-1.5
                       [&::-webkit-scrollbar-track]:bg-transparent
                       [&::-webkit-scrollbar-thumb]:rounded-full
                       [&::-webkit-scrollbar-thumb]:bg-amber-400/30
                       [&::-webkit-scrollbar-thumb:hover]:bg-amber-400/50"
          >
            {filteredEvents.length === 0 ? (
              <div className="text-white/50 text-sm text-center py-12 px-4">
                <div className="text-5xl mb-3 opacity-60">📜</div>
                <div className="text-white/70" style={{ fontFamily: 'Georgia, serif' }}>
                  {totalCount === 0
                    ? 'Your story has not yet begun.'
                    : 'No events in this category.'}
                </div>
                <div className="text-xs mt-3 text-white/30 max-w-[280px] mx-auto leading-relaxed italic">
                  {totalCount === 0
                    ? 'Talk to people, explore San Diego, and your journey will be recorded here.'
                    : 'Try a different filter to see more of your journey.'}
                </div>
              </div>
            ) : (
              <ol className="relative pl-6 space-y-3">
                {/* Vertical timeline line */}
                <div
                  className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-amber-400/40 via-amber-400/20 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                {filteredEvents.map((event, idx) => {
                  const badge = TYPE_BADGE[event.type] || {
                    label: event.type,
                    className: 'border-stone-400/40 text-stone-300 bg-stone-800/60',
                  };
                  return (
                    <li
                      key={event.id}
                      className="relative"
                      aria-label={`Event ${idx + 1}: ${event.title}`}
                    >
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-[19px] top-3 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-stone-950 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        aria-hidden="true"
                      />
                      {/* Card */}
                      <div className="rounded-lg p-3 bg-amber-950/20 border border-amber-400/20 hover:border-amber-400/40 hover:bg-amber-950/30 transition-colors">
                        <div className="flex items-start gap-2.5">
                          {/* Event icon */}
                          <div className="text-lg leading-none shrink-0 mt-0.5" aria-hidden="true">
                            {event.icon}
                          </div>
                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-white text-sm font-semibold leading-tight">
                                {event.title}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${badge.className}`}
                              >
                                {badge.label}
                              </Badge>
                            </div>
                            <p
                              className="text-white/65 text-xs leading-relaxed"
                              style={{ fontFamily: 'Georgia, serif' }}
                            >
                              {event.description}
                            </p>
                            <div className="text-white/35 text-[10px] mt-1.5 font-mono">
                              {formatTimestamp(event.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Footer: count + clear action */}
          <div className="p-3 border-t border-amber-400/20 bg-stone-950/60 rounded-b-xl shrink-0 flex items-center justify-between gap-2">
            <div className="text-white/45 text-[11px]">
              Showing{' '}
              <span className="text-amber-400 font-semibold">{filteredEvents.length}</span>{' '}
              of <span className="text-white/70">{totalCount}</span> events
            </div>
            {confirmClear ? (
              <div className="flex items-center gap-1.5">
                <span className="text-white/60 text-[11px] mr-1 hidden sm:inline">Clear all?</span>
                <button
                  onClick={handleClear}
                  className="text-[11px] px-2 py-1 rounded-md bg-red-900/70 hover:bg-red-800 border border-red-500/40 text-red-100 transition-colors"
                  aria-label="Confirm clear story log"
                >
                  Yes, clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-[11px] px-2 py-1 rounded-md bg-stone-800 hover:bg-stone-700 border border-stone-600/40 text-white/80 transition-colors"
                  aria-label="Cancel clearing story log"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={totalCount === 0}
                className="text-[11px] px-2 py-1 rounded-md bg-stone-800/60 hover:bg-stone-700/80 border border-stone-600/30 text-white/60 hover:text-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-800/60"
                aria-label="Clear story log"
              >
                🗑 Clear log
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

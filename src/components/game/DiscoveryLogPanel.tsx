'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUIStore } from './UIManager';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * DiscoveryLogPanel - Auto-records every place / zone / NPC / landmark the
 * player enters in San Diego.
 *
 * Distinct from:
 *   - Field Notes (player-written observations)
 *   - Journal (story beats, driven by quest events)
 *   - Story Log (every raw event, chronological, includes UI/XP/etc.)
 *
 * The Discovery Log focuses on the WORLD — every distinct place discovered.
 *
 * Recording protocol:
 *   - Other code dispatches a CustomEvent 'noor:discovery' on window with
 *     `detail: { id, name, type, position: {x, y}, timestamp?, note? }`.
 *   - This component listens, dedupes by `id`, persists to localStorage
 *     under 'noor-discovery-log', and re-renders.
 *
 * Toggle protocol (mirrors FieldNotesPanel):
 *   - A custom 'noor:toggle-discovery-log' event flips open/closed.
 *   - Escape key closes when open (capture-phase, beats the global handler).
 *
 * Persists to localStorage only — these are personal exploration breadcrumbs,
 * not game-progression data, so they're independent of the save system.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DiscoveryType = 'building' | 'zone' | 'npc' | 'landmark';

interface Discovery {
  id: string;
  name: string;
  type: DiscoveryType;
  position: { x: number; y: number };
  timestamp: number;
  note?: string;
}

type FilterChip = 'all' | DiscoveryType;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'noor-discovery-log';
const TOGGLE_EVENT = 'noor:toggle-discovery-log';
const DISCOVERY_EVENT = 'noor:discovery';

const TYPE_META: Record<DiscoveryType, {
  icon: string;
  label: string;
  badgeClass: string;   // bg + border + text classes for the badge
  iconWrap: string;     // bg + border for the circular icon
}> = {
  building: {
    icon: '🏛',
    label: 'Building',
    badgeClass: 'border-amber-400/50 text-amber-300 bg-amber-950/40',
    iconWrap: 'bg-amber-500/15 border-amber-400/40',
  },
  zone: {
    icon: '🌿',
    label: 'Zone',
    badgeClass: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/40',
    iconWrap: 'bg-emerald-500/15 border-emerald-400/40',
  },
  npc: {
    icon: '👤',
    label: 'NPC',
    badgeClass: 'border-sky-400/50 text-sky-300 bg-sky-950/40',
    iconWrap: 'bg-sky-500/15 border-sky-400/40',
  },
  landmark: {
    icon: '⭐',
    label: 'Landmark',
    badgeClass: 'border-rose-400/50 text-rose-300 bg-rose-950/40',
    iconWrap: 'bg-rose-500/15 border-rose-400/40',
  },
};

const FILTER_ORDER: FilterChip[] = ['all', 'building', 'zone', 'npc', 'landmark'];

const FILTER_LABELS: Record<FilterChip, string> = {
  all: 'All',
  building: 'Buildings',
  zone: 'Zones',
  npc: 'NPCs',
  landmark: 'Landmarks',
};

// ---------------------------------------------------------------------------
// localStorage helpers (SSR-safe)
// ---------------------------------------------------------------------------

function loadDiscoveries(): Discovery[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation
    return parsed.filter(
      (d): d is Discovery =>
        d && typeof d === 'object' &&
        typeof d.id === 'string' &&
        typeof d.name === 'string' &&
        typeof d.type === 'string' &&
        d.position && typeof d.position.x === 'number'
    );
  } catch {
    return [];
  }
}

function saveDiscoveries(list: Discovery[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage full or blocked — silently ignore
  }
}

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiscoveryLogPanel() {
  const { activePanel } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  // Lazy initializer — reads once on first render
  const [discoveries, setDiscoveries] = useState<Discovery[]>(() => loadDiscoveries());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChip>('all');

  // Listen for toggle events from the Toolbar button / keyboard shortcut.
  useEffect(() => {
    const handler = () => setIsOpen(prev => !prev);
    window.addEventListener(TOGGLE_EVENT, handler);
    return () => window.removeEventListener(TOGGLE_EVENT, handler);
  }, []);

  // Listen for incoming discovery events. Dedupe by id, persist, re-render.
  // After persisting, dispatch a 'noor:discovery-updated' event with the new
  // count so external subscribers (e.g. the Toolbar badge) can update
  // reactively without racing on localStorage read timing.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<Discovery>;
      const incoming = ce.detail;
      if (!incoming || !incoming.id) return;
      setDiscoveries(prev => {
        if (prev.some(d => d.id === incoming.id)) return prev; // dedupe
        const next = [...prev, { ...incoming, timestamp: incoming.timestamp ?? Date.now() }];
        saveDiscoveries(next);
        // Notify external subscribers (Toolbar badge) of the new count.
        window.dispatchEvent(new CustomEvent('noor:discovery-updated', {
          detail: { count: next.length },
        }));
        return next;
      });
    };
    window.addEventListener(DISCOVERY_EVENT, handler as EventListener);
    return () => window.removeEventListener(DISCOVERY_EVENT, handler as EventListener);
  }, []);

  // Close on Escape (capture phase so we beat the global UIManager handler).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          (active as HTMLElement).blur();
          return;
        }
        setIsOpen(false);
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen]);

  // Derived: filtered + searched list, newest first.
  const visible = useMemo(() => {
    let list = [...discoveries].sort((a, b) => b.timestamp - a.timestamp);
    if (filter !== 'all') list = list.filter(d => d.type === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(d => d.name.toLowerCase().includes(q));
    return list;
  }, [discoveries, filter, search]);

  const counts = useMemo(() => {
    const c = { total: discoveries.length, building: 0, zone: 0, npc: 0, landmark: 0 };
    for (const d of discoveries) c[d.type] += 1;
    return c;
  }, [discoveries]);

  const handleClear = useCallback(() => {
    setDiscoveries([]);
    saveDiscoveries([]);
    // Notify subscribers that the count has reset to 0.
    window.dispatchEvent(new CustomEvent('noor:discovery-updated', {
      detail: { count: 0 },
    }));
  }, []);

  const handleExport = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(discoveries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noor-discoveries-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Best-effort export; ignore failures silently
    }
  }, [discoveries]);

  if (!isOpen) return null;
  // Don't show if a modal panel is active — avoid stacking
  if (activePanel !== null) return null;

  return (
    <div
      className="absolute top-16 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] max-h-[80vh] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in flex flex-col"
      role="dialog"
      aria-label="Discovery Log"
    >
      {/* Header */}
      <div className="p-3 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-amber-950/20 to-transparent panel-ornamental-header shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧭</span>
          <div>
            <h3
              className="text-amber-400 font-bold text-sm flex items-center gap-2"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Discovery Log
            </h3>
            <div className="text-white/40 text-[10px] mt-0.5">
              Auto-recorded as you explore San Diego
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="close-btn-styled w-7 h-7 rounded-md bg-stone-800/40 text-white/60 text-sm flex items-center justify-center hover:bg-stone-700/60 hover:text-white"
          aria-label="Close Discovery Log"
        >
          ✕
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="p-3 border-b border-amber-400/15 bg-stone-900/40 shrink-0 space-y-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search discoveries…"
          className="h-8 text-xs bg-stone-950/80 border-amber-400/20 text-amber-100 placeholder:text-white/30 focus-visible:border-amber-400/60"
          aria-label="Search discoveries"
        />
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_ORDER.map(chip => {
            const isActive = filter === chip;
            const count =
              chip === 'all'
                ? counts.total
                : counts[chip as Exclude<FilterChip, 'all'>];
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setFilter(chip)}
                className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                  isActive
                    ? 'bg-amber-900/50 border-amber-400/60 text-amber-300'
                    : 'bg-stone-800/40 border-white/10 text-white/50 hover:text-white/80'
                }`}
                aria-pressed={isActive}
              >
                {FILTER_LABELS[chip]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scroll-amber">
        {visible.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3 opacity-50">🗺️</div>
            <div
              className="text-amber-300/80 text-sm italic"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {discoveries.length === 0
                ? 'No discoveries yet. Walk around San Diego to find new places!'
                : 'No discoveries match your search.'}
            </div>
            <div className="text-xs mt-3 text-white/30 max-w-[280px] mx-auto leading-relaxed">
              Buildings, zones, NPCs, and landmarks you encounter will be
              recorded here automatically.
            </div>
          </div>
        ) : (
          visible.map(d => {
            const meta = TYPE_META[d.type];
            return (
              <div
                key={d.id}
                className={`rounded-lg border ${meta.badgeClass.split(' ').find(c => c.startsWith('border-')) ?? 'border-amber-400/30'} bg-stone-900/40 p-2.5 hover:bg-stone-900/60 transition-colors`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Icon */}
                  <div
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg border ${meta.iconWrap}`}
                    aria-hidden="true"
                  >
                    {meta.icon}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-semibold leading-tight truncate">
                        {d.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-white/40">
                      <span title="When discovered">{formatTimestamp(d.timestamp)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono" title="Tile coordinates">
                        ({d.position.x}, {d.position.y})
                      </span>
                    </div>
                    {d.note && (
                      <div
                        className="mt-1 text-[11px] text-white/60 italic leading-snug"
                        style={{ fontFamily: 'Georgia, serif' }}
                      >
                        {d.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: stats + actions */}
      <div className="px-3 py-2 border-t border-amber-400/15 bg-stone-900/40 flex items-center justify-between gap-2 shrink-0">
        <div className="text-[10px] text-white/50 leading-tight">
          <span className="text-amber-300/90 font-semibold">{counts.total}</span> discoveries
          <span className="text-white/30 mx-1">·</span>
          <span className="text-amber-300/90 font-semibold">{counts.building}</span> buildings
          <span className="text-white/30 mx-1">·</span>
          <span className="text-sky-300/90 font-semibold">{counts.npc}</span> NPCs
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleExport}
            disabled={discoveries.length === 0}
            className="px-2 py-0.5 rounded-md bg-stone-800/70 hover:bg-stone-700/80 disabled:opacity-30 disabled:cursor-not-allowed text-white/70 text-[10px] border border-white/10 transition-colors"
            title="Export discoveries as JSON"
          >
            ⬇ Export
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={discoveries.length === 0}
                className="px-2 py-0.5 rounded-md bg-rose-950/50 hover:bg-rose-900/60 disabled:opacity-30 disabled:cursor-not-allowed text-rose-300/80 text-[10px] border border-rose-400/20 transition-colors"
                title="Clear all discoveries"
              >
                🗑 Clear
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-stone-950 border-amber-400/40 text-amber-100">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-amber-300">Clear all discoveries?</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60">
                  This will permanently erase your discovery log from this device.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-stone-800 text-white/70 border-white/10 hover:bg-stone-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClear}
                  className="bg-rose-700 hover:bg-rose-600 text-white border-rose-500/50"
                >
                  Yes, clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported helpers (used by the Toolbar / game code)
// ---------------------------------------------------------------------------

/**
 * Toggle the Discovery Log panel open/closed from anywhere (e.g. Toolbar
 * button, keyboard shortcut). Safe to call on the server (no-op).
 */
export function toggleDiscoveryLogPanel() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TOGGLE_EVENT));
}

/**
 * Record a discovery. Other code (game engine, NPC interactions, zone
 * triggers) calls this when the player enters a notable place.
 *
 * The component listens for the resulting 'noor:discovery' event, dedupes
 * by id, and persists to localStorage.
 */
export function recordDiscovery(discovery: {
  id: string;
  name: string;
  type: 'building' | 'zone' | 'npc' | 'landmark';
  position: { x: number; y: number };
  note?: string;
}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(DISCOVERY_EVENT, {
      detail: { ...discovery, timestamp: Date.now() },
    }),
  );
}

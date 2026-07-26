'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUIStore } from './UIManager';
import { gameEvents } from '@/lib/game/eventBus';

/**
 * NPCRelationshipPanel - Tracks the player's interactions with each NPC in
 * the game, showing conversation depth, topics discussed, and a relationship
 * warmth indicator.
 *
 * Uses the shared useUIStore panel system (panel id: 'npcs').
 * Renders when `activePanel === 'npcs'`.
 *
 * Interaction tracking:
 *   - Listen to 'dialogue:start' events on gameEvents bus
 *   - When a dialogue starts with a speaker, increment their interaction count
 *     in localStorage 'noor-npc-interactions'
 *   - Track the dialogueId as a "topic" for that NPC
 *   - Dispatch 'noor:npc-interactions-updated' custom event with { npcId, count }
 *
 * Data sources:
 *   - NPC definitions from NPC_CONFIG below
 *   - Interaction tracking from localStorage 'noor-npc-interactions'
 *   - Cross-references 'noor-stats' (npcsTalkedTo) and 'noor-discovery-log'
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NPCConfigEntry {
  id: string;
  name: string;
  emoji: string;
  role: string;
  gradient: string;
  color: string;
  accent: string;
  thresholds: number[]; // heart-fill thresholds [0,1,2,3,5]
}

interface NPCInteraction {
  timesTalked: number;
  lastTalkedAt: number;
  topics: string[];
}

type NPCStatus = 'not-encountered' | 'acquainted' | 'familiar' | 'trusted';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'noor-npc-interactions';
const STATS_STORAGE_KEY = 'noor-stats';
const DISCOVERY_STORAGE_KEY = 'noor-discovery-log';

// Speaker-to-NPC-id mapping: DialogueBox uses speaker names, but our NPC
// system uses ids like 'mang-tenyo'. We bridge them here.
const SPEAKER_TO_NPC_ID: Record<string, string> = {
  'Mang Tenyo': 'mang-tenyo',
  'Aling Nena': 'aling-nena',
  'Mang Andres': 'mang-andres',
  'Crisóstomo Ibarra': 'ibarra',
  'Narrator': 'narrator',
};

// NPC configuration with the same gradient/color system as DialogueBox
const NPC_CONFIG: NPCConfigEntry[] = [
  {
    id: 'mang-tenyo',
    name: 'Mang Tenyo',
    emoji: '👴',
    role: 'Cart Driver',
    gradient: 'radial-gradient(circle at 35% 35%, #F4A460 0%, #D2691E 60%, #8B4513 100%)',
    color: '#D2691E',
    accent: '#F4A460',
    thresholds: [0, 1, 2, 3, 5],
  },
  {
    id: 'aling-nena',
    name: 'Aling Nena',
    emoji: '👩‍🍳',
    role: 'Kitchen Staff',
    gradient: 'radial-gradient(circle at 35% 35%, #FFD89B 0%, #CD853F 60%, #8B5A2B 100%)',
    color: '#CD853F',
    accent: '#FFD89B',
    thresholds: [0, 1, 2, 3, 5],
  },
  {
    id: 'mang-andres',
    name: 'Mang Andres',
    emoji: '🧑‍🍳',
    role: 'Kitchen Staff',
    gradient: 'radial-gradient(circle at 35% 35%, #E8B579 0%, #A0522D 60%, #5C3317 100%)',
    color: '#A0522D',
    accent: '#E8B579',
    thresholds: [0, 1, 2, 3, 5],
  },
  {
    id: 'ibarra',
    name: 'Crisóstomo Ibarra',
    emoji: '🎩',
    role: 'Ilustrado',
    gradient: 'radial-gradient(circle at 35% 35%, #FFFACD 0%, #FFD700 60%, #B8860B 100%)',
    color: '#FFD700',
    accent: '#FFFACD',
    thresholds: [0, 1, 2, 3, 5],
  },
  {
    id: 'narrator',
    name: 'Narrator',
    emoji: '📜',
    role: 'Storyteller',
    gradient: 'radial-gradient(circle at 35% 35%, #E5E7EB 0%, #9CA3AF 60%, #4B5563 100%)',
    color: '#9CA3AF',
    accent: '#E5E7EB',
    thresholds: [0, 1, 2, 3, 5],
  },
];

// ---------------------------------------------------------------------------
// localStorage helpers (SSR-safe)
// ---------------------------------------------------------------------------

function loadInteractions(): Record<string, NPCInteraction> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Basic shape validation
    const result: Record<string, NPCInteraction> = {};
    for (const [key, val] of Object.entries(parsed)) {
      const v = val as Record<string, unknown>;
      if (typeof v.timesTalked === 'number' && typeof v.lastTalkedAt === 'number' && Array.isArray(v.topics)) {
        result[key] = {
          timesTalked: v.timesTalked,
          lastTalkedAt: v.lastTalkedAt,
          topics: v.topics as string[],
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function saveInteractions(data: Record<string, NPCInteraction>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or blocked — silently ignore
  }
}

function loadNpcsTalkedTo(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    return Array.isArray(parsed.npcsTalkedTo) ? parsed.npcsTalkedTo : [];
  } catch {
    return [];
  }
}

function loadDiscoveryNPCs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISCOVERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d: Record<string, unknown>) => d.type === 'npc')
      .map((d: Record<string, unknown>) => d.id as string);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function formatRelativeTime(ts: number): string {
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

function getStatus(timesTalked: number, hasBeenDiscovered: boolean): NPCStatus {
  if (timesTalked === 0 && !hasBeenDiscovered) return 'not-encountered';
  if (timesTalked === 0) return 'acquainted'; // seen but not talked yet? Treat as acquaintance
  if (timesTalked === 1) return 'acquainted';
  if (timesTalked === 2) return 'familiar';
  return 'trusted'; // 3+ talks
}

function getStatusBadge(status: NPCStatus): { label: string; className: string } {
  switch (status) {
    case 'not-encountered':
      return { label: 'Not yet encountered', className: 'bg-stone-800/40 text-white/30' };
    case 'acquainted':
      return { label: 'Acquainted', className: 'bg-amber-950/50 text-amber-400/70' };
    case 'familiar':
      return { label: 'Familiar', className: 'bg-amber-900/50 text-amber-300' };
    case 'trusted':
      return { label: 'Trusted', className: 'bg-emerald-900/50 text-emerald-300' };
  }
}

function getFilledHearts(timesTalked: number, thresholds: number[]): number {
  // thresholds define the count needed to fill each heart: [0,1,2,3,5]
  // heart i is filled if timesTalked >= thresholds[i+1] (thresholds[0]=0 is always filled for >=0)
  // Actually: 5 hearts. Fill count based on thresholds.
  // Heart 0: always filled if timesTalked >= thresholds[0] (=0, so always if any interaction)
  // But 0 interactions = all empty hearts. Let's use thresholds[1..5] for hearts 1..5
  if (timesTalked === 0) return 0;
  let filled = 0;
  for (let i = 1; i < thresholds.length; i++) {
    if (timesTalked >= thresholds[i]) {
      filled = i;
    } else {
      break;
    }
  }
  return filled;
}

// Topic label formatter — converts dialogueId like "mang-tenyo-first" to a readable label
function formatTopicLabel(topicId: string): string {
  // Replace hyphens with spaces, capitalize first letter of each word
  const words = topicId.split('-');
  // Skip the NPC-id prefix if it matches the first word(s)
  // e.g. "mang-tenyo-first" → "First Conversation"
  // "market-gossip" → "Market Gossip"
  // "ibarra-sighting" → "Ibarra Sighting"
  // "mang-tenyo-after-gossip" → "After Gossip"
  // Remove known NPC prefixes
  const npcPrefixes = ['mang-tenyo', 'aling-nena', 'mang-andres', 'ibarra', 'narrator', 'kitchen-staff'];
  let remaining = topicId;
  for (const prefix of npcPrefixes) {
    if (remaining.startsWith(prefix + '-')) {
      remaining = remaining.slice(prefix.length + 1);
      break;
    } else if (remaining === prefix) {
      remaining = 'introduction';
      break;
    }
  }
  return remaining
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NPCRelationshipPanel() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'npcs';

  // Lazy initializer — reads once on first render
  const [interactions, setInteractions] = useState<Record<string, NPCInteraction>>(() => loadInteractions());
  const [npcsTalkedTo, setNpcsTalkedTo] = useState<string[]>(() => loadNpcsTalkedTo());
  const [discoveryNPCs, setDiscoveryNPCs] = useState<string[]>(() => loadDiscoveryNPCs());

  // Listen for 'dialogue:start' events on gameEvents bus to track NPC interactions
  useEffect(() => {
    const handler = (dialogueId: unknown, dialogueData: unknown) => {
      // dialogue:start event provides { dialogueId, speaker } or just the dialogueId string
      // The gameEvents.emit('dialogue:start', dialogueId, dialogueData) pattern varies.
      // Let's handle both patterns.
      let npcId: string | null = null;
      let topicId: string | null = null;

      if (typeof dialogueId === 'string') {
        topicId = dialogueId;
        // Try to derive npcId from dialogueId prefix
        // e.g. "mang-tenyo-first" → "mang-tenyo"
        const npcPrefixes = ['mang-tenyo', 'aling-nena', 'mang-andres', 'ibarra', 'narrator', 'kitchen-staff'];
        for (const prefix of npcPrefixes) {
          if (dialogueId.startsWith(prefix)) {
            npcId = prefix;
            break;
          }
        }
      }

      // Also try to get npcId from dialogueData if provided
      if (dialogueData && typeof dialogueData === 'object') {
        const data = dialogueData as Record<string, unknown>;
        if (typeof data.npcId === 'string' && !npcId) {
          npcId = data.npcId;
        }
        if (typeof data.speaker === 'string') {
          const mappedId = SPEAKER_TO_NPC_ID[data.speaker as string];
          if (mappedId && !npcId) {
            npcId = mappedId;
          }
        }
        if (typeof data.id === 'string' && !topicId) {
          topicId = data.id;
        }
      }

      // Map kitchen-staff to both Aling Nena and Mang Andres
      // (market-gossip involves both)
      const npcIdsToUpdate: string[] = [];
      if (npcId === 'kitchen-staff') {
        npcIdsToUpdate.push('aling-nena', 'mang-andres');
      } else if (npcId) {
        npcIdsToUpdate.push(npcId);
      }

      if (npcIdsToUpdate.length === 0) return;

      setInteractions(prev => {
        const next = { ...prev };
        for (const id of npcIdsToUpdate) {
          const existing = next[id] || { timesTalked: 0, lastTalkedAt: 0, topics: [] };
          const topics = [...existing.topics];
          if (topicId && !topics.includes(topicId)) {
            topics.push(topicId);
          }
          next[id] = {
            timesTalked: existing.timesTalked + 1,
            lastTalkedAt: Date.now(),
            topics,
          };
          // Dispatch event for external subscribers
          window.dispatchEvent(new CustomEvent('noor:npc-interactions-updated', {
            detail: { npcId: id, count: next[id].timesTalked },
          }));
        }
        saveInteractions(next);
        return next;
      });

      // Also update npcsTalkedTo in stats
      setNpcsTalkedTo(prev => {
        const next = [...prev];
        for (const id of npcIdsToUpdate) {
          if (!next.includes(id)) {
            next.push(id);
          }
        }
        // Also persist back to stats localStorage
        try {
          const raw = localStorage.getItem(STATS_STORAGE_KEY);
          if (raw) {
            const stats = JSON.parse(raw);
            stats.npcsTalkedTo = next;
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
          }
        } catch { /* ignore */ }
        return next;
      });
    };

    gameEvents.on('dialogue:start', handler);
    return () => gameEvents.off('dialogue:start', handler);
  }, []);

  // Listen for discovery events to track NPC discoveries
  useEffect(() => {
    const handler = () => {
      setDiscoveryNPCs(loadDiscoveryNPCs());
    };
    window.addEventListener('noor:discovery-updated', handler);
    // Also check on storage events for cross-tab sync
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('noor:discovery-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Listen for npc-interactions-updated from other sources (e.g. NPC interactions via game engine)
  useEffect(() => {
    const handler = () => {
      setInteractions(loadInteractions());
      setNpcsTalkedTo(loadNpcsTalkedTo());
    };
    window.addEventListener('noor:npc-interactions-updated', handler as EventListener);
    return () => window.removeEventListener('noor:npc-interactions-updated', handler as EventListener);
  }, []);

  // Compute summary stats
  const summary = useMemo(() => {
    let encountered = 0;
    let totalConversations = 0;
    let totalTopics = 0;
    for (const npc of NPC_CONFIG) {
      const interaction = interactions[npc.id];
      const hasTalked = npcsTalkedTo.includes(npc.id);
      const hasDiscovered = discoveryNPCs.some(d => d === npc.id || d.includes(npc.id));
      if (hasTalked || (interaction && interaction.timesTalked > 0) || hasDiscovered) {
        encountered++;
      }
      if (interaction) {
        totalConversations += interaction.timesTalked;
        totalTopics += interaction.topics.length;
      }
    }
    return { encountered, totalConversations, totalTopics };
  }, [interactions, npcsTalkedTo, discoveryNPCs]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-16 left-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] max-h-[80vh] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in flex flex-col overflow-hidden"
      role="dialog"
      aria-label="NPC Relationship Tracker"
    >
      {/* Sticky header */}
      <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/50 via-stone-950 to-stone-950 panel-ornamental-header shrink-0">
        <div>
          <h3
            className="text-amber-400 font-bold text-base flex items-center gap-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <span className="text-lg">👥</span> People of San Diego <span className="text-amber-400/80 text-sm">✦</span>
          </h3>
          <div className="text-white/50 text-xs mt-0.5">
            Your relationships with the townsfolk
          </div>
        </div>
        <button
          type="button"
          onClick={() => togglePanel('npcs')}
          className="close-btn-styled w-8 h-8 rounded-md bg-stone-800/40 text-white/60 flex items-center justify-center shrink-0"
          aria-label="Close NPC Relationship panel"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll-amber"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {NPC_CONFIG.map(npc => {
          const interaction = interactions[npc.id];
          const timesTalked = interaction?.timesTalked ?? 0;
          const lastTalkedAt = interaction?.lastTalkedAt ?? 0;
          const topics = interaction?.topics ?? [];
          const hasTalked = npcsTalkedTo.includes(npc.id);
          const hasDiscovered = discoveryNPCs.some(d => d === npc.id || d.includes(npc.id));
          const status = getStatus(timesTalked, hasDiscovered || hasTalked);
          const statusBadge = getStatusBadge(status);
          const filledHearts = getFilledHearts(timesTalked, npc.thresholds);

          return (
            <div
              key={npc.id}
              className="bg-stone-950/70 border border-amber-400/20 rounded-lg p-3 hover:border-amber-400/40 transition-colors"
            >
              {/* Top row: portrait + name + role + status */}
              <div className="flex items-start gap-3">
                {/* Portrait: circular gradient background with emoji overlay */}
                <div
                  className="relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-lg overflow-hidden"
                  style={{
                    background: npc.gradient,
                    borderColor: npc.accent,
                    boxShadow: `0 0 12px ${npc.color}40, 0 2px 6px rgba(0,0,0,0.4)`,
                  }}
                >
                  <span className="text-lg">{npc.emoji}</span>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full shadow-md text-white"
                      style={{ backgroundColor: npc.color }}
                    >
                      {npc.name}
                    </span>
                    {/* Status pill */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Role subtitle */}
                  <div
                    className="text-[10px] uppercase tracking-wider font-semibold mt-0.5"
                    style={{ color: npc.accent }}
                  >
                    {npc.role}
                  </div>
                </div>
              </div>

              {/* Warmth meter: 5 hearts */}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10px] text-white/40 mr-1.5 uppercase tracking-wider font-semibold">Warmth</span>
                {[0, 1, 2, 3, 4].map(i => {
                  const isFilled = i < filledHearts;
                  // Animate the newest filled heart
                  const isNewlyFilled = isFilled && i === filledHearts - 1;
                  return (
                    <span
                      key={i}
                      className={`text-sm inline-block ${isNewlyFilled ? 'animate-sparkle' : ''}`}
                      aria-label={isFilled ? 'Filled heart' : 'Empty heart'}
                    >
                      {isFilled ? '❤️' : '🤍'}
                    </span>
                  );
                })}
              </div>

              {/* Interaction stats */}
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/50">
                <span>Talked {timesTalked} times</span>
                {lastTalkedAt > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Last: {formatRelativeTime(lastTalkedAt)}</span>
                  </>
                )}
              </div>

              {/* Topics discussed */}
              {topics.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <span className="text-[10px] text-white/40 mr-0.5 uppercase tracking-wider font-semibold">Topics</span>
                  {topics.map(topic => (
                    <span
                      key={topic}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-950/40 border border-amber-400/20 text-amber-300/80 font-medium"
                    >
                      {formatTopicLabel(topic)}
                    </span>
                  ))}
                </div>
              )}

              {/* Not yet encountered message */}
              {status === 'not-encountered' && (
                <div className="mt-2 text-[11px] text-white/30 italic">
                  You haven&apos;t met this person yet. Explore San Diego to find them!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="px-4 py-2.5 border-t border-amber-400/15 bg-stone-900/40 shrink-0 text-[10px] text-white/50">
        <span className="text-amber-300/90 font-semibold">{summary.encountered}</span> NPCs encountered
        <span className="text-white/30 mx-1">·</span>
        <span className="text-amber-300/90 font-semibold">{summary.totalConversations}</span> total conversations
        <span className="text-white/30 mx-1">·</span>
        <span className="text-amber-300/90 font-semibold">{summary.totalTopics}</span> topics discovered
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported helpers (used by the Toolbar / game code)
// ---------------------------------------------------------------------------

/**
 * Toggle the NPC Relationship panel open/closed from anywhere (e.g. Toolbar
 * button, keyboard shortcut). Safe to call on the server (no-op).
 */
export function toggleNPCRelationshipPanel() {
  if (typeof window === 'undefined') return;
  const store = useUIStore.getState();
  store.togglePanel('npcs');
}

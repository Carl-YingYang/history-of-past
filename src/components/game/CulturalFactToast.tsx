'use client';

import { useState, useEffect, useCallback } from 'react';
import { gameEvents } from '@/lib/game/eventBus';
import { soundManager } from '@/lib/game/soundManager';
import { useGameStore } from '@/stores/gameStore';
import culturalFacts from '@/data/culturalFacts.json';

/**
 * CulturalFactToast - Filipino cultural fact notification system.
 *
 * Periodically shows interesting cultural/historical facts about
 * Philippine colonial life, Filipino language, and Noli Me Tangere.
 *
 * Facts are shown as small toast notifications that slide in from
 * the right side, display for 8 seconds, then fade out.
 *
 * Trigger mechanisms:
 *   - After completing an objective (via game event bus)
 *   - When entering a new zone/building area
 *   - Randomly every ~120 seconds during exploration
 *
 * Each fact is shown only once per session.
 */

interface FactNotification {
  id: string;
  text: string;
  timestamp: number;
  exiting: boolean;
}

export default function CulturalFactToast() {
  const [notifications, setNotifications] = useState<FactNotification[]>([]);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());

  // Pick a random fact that hasn't been shown yet
  const pickFact = useCallback((category?: string, zone?: string): typeof culturalFacts[0] | null => {
    let candidates = culturalFacts.filter(f => !shownIds.has(f.id));
    if (category) {
      const catMatches = candidates.filter(f => f.category === category);
      if (catMatches.length > 0) candidates = catMatches;
    }
    if (zone) {
      const zoneMatches = candidates.filter(f => f.triggerZone === zone);
      if (zoneMatches.length > 0) candidates = zoneMatches;
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [shownIds]);

  const showFact = useCallback((fact: typeof culturalFacts[0]) => {
    const notification: FactNotification = {
      id: fact.id,
      text: fact.text,
      timestamp: Date.now(),
      exiting: false,
    };
    setShownIds(prev => new Set([...prev, fact.id]));
    setNotifications(prev => [...prev, notification]);
    soundManager.play('codex-unlock');

    // Auto-remove after 8 seconds (with 0.5s exit animation)
    setTimeout(() => {
      setNotifications(prev =>
        prev.map(n => n.id === fact.id ? { ...n, exiting: true } : n)
      );
    }, 7500);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== fact.id));
    }, 8000);
  }, []);

  // Listen for objective completion events → show relevant fact
  useEffect(() => {
    const unsub = gameEvents.on('quest:objectiveComplete', () => {
      const fact = pickFact('history');
      if (fact) showFact(fact);
    });
    return unsub;
  }, [pickFact, showFact]);

  // Listen for zone enter events → show zone-specific fact
  useEffect(() => {
    const unsub = gameEvents.on('zone:enter', (data: unknown) => {
      const zoneData = data as { zoneId?: string; zoneType?: string };
      // Map zone types to trigger zone categories
      const zoneMap: Record<string, string> = {
        'church': 'church',
        'convent': 'church',
        'market': 'market',
        'plaza': 'plaza',
        'ibarra-house': 'ibarra-house',
        'tiago-house': 'tiago-house',
      };
      const zone = zoneMap[zoneData.zoneType || ''] || 'plaza';
      const fact = pickFact(undefined, zone);
      if (fact) showFact(fact);
    });
    return unsub;
  }, [pickFact, showFact]);

  // Periodic random facts during exploration (every ~120 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const fact = pickFact();
      if (fact) showFact(fact);
    }, 120000);
    return () => clearInterval(interval);
  }, [pickFact, showFact]);

  // Don't show during chapter completion or intro
  const { chapterComplete, introVisible } = useGameStore();

  if (chapterComplete || introVisible || notifications.length === 0) return null;

  return (
    <div className="absolute right-4 top-1/3 z-35 flex flex-col gap-2 pointer-events-none">
      {notifications.map((n, idx) => (
        <div
          key={n.id}
          className={`pointer-events-auto max-w-[320px] rounded-lg border backdrop-blur-md shadow-xl transition-all duration-500 ${
            n.exiting
              ? 'opacity-0 translate-x-8 scale-95'
              : 'opacity-100 translate-x-0 scale-100 animate-fact-slide-in'
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(28,25,23,0.95) 0%, rgba(60,40,20,0.90) 100%)',
            borderColor: 'rgba(251,191,36,0.35)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 8px rgba(251,191,36,0.15)',
            animationDelay: `${idx * 0.1}s`,
          }}
        >
          {/* Decorative top bar */}
          <div className="h-1 rounded-t-lg bg-gradient-to-r from-amber-600/60 via-amber-400/80 to-amber-600/60" />

          <div className="px-3 py-2.5">
            {/* "Cultural Fact" label */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[8px] uppercase tracking-widest font-bold text-amber-400/70">
                ✦ Cultural Fact ✦
              </span>
            </div>

            {/* Fact text */}
            <div className="text-white/85 text-xs leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
              {n.text}
            </div>

            {/* Small dismiss hint */}
            <div className="text-white/30 text-[9px] mt-1.5 text-right">
              Auto-hides in 8s
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}



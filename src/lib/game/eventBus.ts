// EventBus - Event-driven system for game-UI communication
// Game code emits events, UI layer listens - clean separation

type EventCallback = (...args: unknown[]) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Singleton instance used across the game
export const gameEvents = new EventBus();

// Event types for the game system
export type GameEventType =
  | 'codex:unlock'
  | 'journal:entry'
  | 'chapter:medal'
  | 'dialogue:line'
  | 'dialogue:start'
  | 'dialogue:end'
  | 'xp:gained'
  | 'quest:objectiveComplete'
  | 'quest:complete'
  | 'chapter:complete'
  | 'quiz:start'
  | 'quiz:complete'
  | 'game:intro'
  | 'game:ready'
  | 'npc:interact'
  | 'zone:enter'
  | 'time:transition'
  | 'ibarra:appear';

export default EventBus;

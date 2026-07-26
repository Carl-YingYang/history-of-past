'use client';

import { create } from 'zustand';
import { useEffect } from 'react';
import { gameEvents } from '@/lib/game/eventBus';

/**
 * UIManager - Centralized control for overlay panels (Codex, Journal, Settings, Minimap, Help).
 *
 * Why: The previous implementation let every panel manage its own open state, which caused:
 *   - Multiple panels open simultaneously (cluttered UI)
 *   - Z-index collisions with the DialogueBox (panels at z-30 same as dialogue)
 *   - No modal backdrop, making panels look "pasted on" rather than modal
 *
 * Solution:
 *   - Single source of truth: at most ONE overlay panel is open at a time.
 *   - A click on the modal backdrop closes the active panel.
 *   - Panels register their content via the `activePanel` state.
 *   - Keyboard shortcuts (C, J, M, S, H, Esc) drive panel switching.
 *   - Opening a panel emits a `panel:opened` event on the game event bus
 *     so other systems (e.g. achievement tracking) can react.
 *   - The backdrop sits at z-40, panel content at z-50, dialogue at z-30 —
 *     so opening any panel hides the dialogue click-catcher visually but
 *     does NOT pause the game (the engine keeps running).
 */

export type PanelId = 'codex' | 'journal' | 'settings' | 'minimap' | 'help' | 'glossary' | 'achievements' | 'storylog' | 'about' | 'quotes' | 'npcs' | 'roadmap' | null;

interface UIState {
  activePanel: PanelId;
  openPanel: (id: PanelId) => void;
  closePanel: () => void;
  togglePanel: (id: Exclude<PanelId, null>) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activePanel: null,
  openPanel: (id) => {
    set({ activePanel: id });
    // Emit a `panel:opened` event so other systems (achievement tracking,
    // analytics, etc.) can react. We only emit for non-null ids.
    if (id) {
      gameEvents.emit('panel:opened', id);
    }
    // Mirror state to a body data attribute so non-React systems
    // (TouchControls, InteractButton) can react via MutationObserver.
    if (typeof document !== 'undefined') {
      if (id) {
        document.body.setAttribute('data-noor-panel-active', 'true');
      } else {
        document.body.removeAttribute('data-noor-panel-active');
      }
    }
  },
  closePanel: () => {
    set({ activePanel: null });
    if (typeof document !== 'undefined') {
      document.body.removeAttribute('data-noor-panel-active');
    }
  },
  togglePanel: (id) => {
    const current = get().activePanel;
    if (current === id) {
      get().closePanel();
    } else {
      get().openPanel(id);
    }
  },
}));

/**
 * Global keyboard shortcuts handler for panel navigation.
 * Mounted once at the app root.
 */
export function GlobalKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const key = e.key.toLowerCase();
      const store = useUIStore.getState();

      // Escape always closes the active panel
      if (key === 'escape') {
        if (store.activePanel) {
          store.closePanel();
          e.preventDefault();
        }
        return;
      }

      // Letter shortcuts — only fire if not currently in a dialogue
      // (dialogue uses Space/Enter for advancing; we don't want to hijack)
      // We check via a simple attribute on document body set by DialogueBox.
      const inDialogue = document.body.getAttribute('data-noor-dialogue-active') === 'true';

      if (inDialogue) return;

      switch (key) {
        case 'c':
          store.togglePanel('codex');
          e.preventDefault();
          break;
        case 'j':
          store.togglePanel('journal');
          e.preventDefault();
          break;
        case 'm':
          store.togglePanel('minimap');
          e.preventDefault();
          break;
        case 's':
          store.togglePanel('settings');
          e.preventDefault();
          break;
        case 'g':
          store.togglePanel('glossary');
          e.preventDefault();
          break;
        case 'a':
          store.togglePanel('achievements');
          e.preventDefault();
          break;
        case 'l':
          store.togglePanel('storylog');
          e.preventDefault();
          break;
        case 'n':
          // Field Notes uses a separate toggle event (not part of single-panel system)
          window.dispatchEvent(new Event('noor:toggle-field-notes'));
          e.preventDefault();
          break;
        case 'd':
          // Discovery Log — separate toggle event (auto-recorded places)
          window.dispatchEvent(new Event('noor:toggle-discovery-log'));
          e.preventDefault();
          break;
        case 'b':
          // About Chapter — historical context
          store.togglePanel('about');
          e.preventDefault();
          break;
        case 'q':
          // Rizal Quote Library — browse quotes & favorites
          store.togglePanel('quotes');
          e.preventDefault();
          break;
        case 't':
          // NPCs / People — relationship tracker
          store.togglePanel('npcs');
          e.preventDefault();
          break;
        case 'r':
          // Chapter Roadmap — vertical timeline of all 11 chapters
          store.togglePanel('roadmap');
          e.preventDefault();
          break;
        case 'p':
          // Photo Mode — capture a screenshot of the game canvas.
          // Dispatch a custom event (handled by PhotoMode.tsx) to avoid a
          // circular import between UIManager and PhotoMode.
          window.dispatchEvent(new Event('noor:capture-photo'));
          e.preventDefault();
          break;
        case 'h':
        case '?':
          store.togglePanel('help');
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}

/**
 * Modal backdrop component - dims the game world when a panel is open.
 * Enhanced with stronger backdrop blur and smooth fade transition.
 * Clicking the backdrop closes the active panel.
 */
export function ModalBackdrop() {
  const { activePanel, closePanel } = useUIStore();

  if (!activePanel) return null;

  return (
    <div
      className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm transition-all duration-200"
      onClick={closePanel}
      aria-hidden="true"
    />
  );
}

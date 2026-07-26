'use client';

import { useState, useEffect } from 'react';
import { getEngineControls } from './GameCanvas';

/**
 * Interact button - touch-friendly circular button for triggering NPC dialogue.
 * Hidden while a dialogue is already active (player can't interact during dialogue)
 * and while a panel overlay is open.
 *
 * State sync: we mirror the dialogue/panel state to body data attributes
 * (set by DialogueBox and UIManager). We read once on mount via useState
 * initializer, then update only inside the MutationObserver callback
 * (an external-system subscription pattern, not a synchronous setState in effect).
 */
export default function InteractButton() {
  const [hidden, setHidden] = useState(() => {
    if (typeof document === 'undefined') return false;
    const inDialogue = document.body.getAttribute('data-noor-dialogue-active') === 'true';
    const inPanel = document.body.getAttribute('data-noor-panel-active') === 'true';
    return inDialogue || inPanel;
  });

  useEffect(() => {
    const update = () => {
      const inDialogue = document.body.getAttribute('data-noor-dialogue-active') === 'true';
      const inPanel = document.body.getAttribute('data-noor-panel-active') === 'true';
      setHidden(inDialogue || inPanel);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-noor-dialogue-active', 'data-noor-panel-active'] });
    return () => observer.disconnect();
  }, []);

  const handleInteract = () => {
    const controls = getEngineControls();
    if (controls) controls.triggerInteract();
  };

  return (
    <button
      className={`absolute bottom-4 right-4 z-20 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 border-2 border-amber-300/60 shadow-xl shadow-amber-900/40 flex flex-col items-center justify-center transition-all active:scale-95 touch-none hover:scale-105 ${
        hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        handleInteract();
      }}
      aria-label="Interact with NPC (Space)"
    >
      <span className="text-white text-xl leading-none">💬</span>
      <span className="text-white/90 text-[9px] font-bold tracking-wide mt-0.5">TALK</span>
      {/* Pulsing ring */}
      <span className="absolute inset-0 rounded-full ring-2 ring-amber-300/30 animate-ping" />
    </button>
  );
}

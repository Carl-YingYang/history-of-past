'use client';

import { getEngineControls } from './GameCanvas';

/**
 * Interact button - appears when player is near an NPC.
 * Provides a touch-friendly way to trigger NPC dialogue.
 */
export default function InteractButton() {
  const handleInteract = () => {
    const controls = getEngineControls();
    if (controls) controls.triggerInteract();
  };

  return (
    <button
      className="absolute bottom-4 right-4 z-20 w-16 h-16 rounded-full bg-amber-600/90 hover:bg-amber-500 border-2 border-amber-300/50 shadow-lg flex flex-col items-center justify-center transition-all active:scale-95 touch-none"
      onPointerDown={(e) => {
        e.preventDefault();
        handleInteract();
      }}
      aria-label="Interact with NPC"
    >
      <span className="text-white text-2xl">💬</span>
      <span className="text-white/80 text-[10px] font-bold tracking-wide">TALK</span>
    </button>
  );
}

// GameEngine - Core game loop, Canvas rendering, input handling, and scene management
// Pokémon-style top-down 2D RPG engine for Project Noor
// Enhanced rendering with atmospheric effects, detailed tiles, and visual polish

import { gameEvents } from './eventBus';
import { spriteLoader } from './spriteLoader';
import { saveManager } from './saveManager';
import mapData from '@/data/mapData.json';
import dialogueData from '@/data/dialogueData.json';
import characterData from '@/data/characters.json';

// Direction constants
const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'] as const;
type Direction = typeof DIRECTIONS[number];

interface Entity {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  characterKey: string;
  isMoving: boolean;
  animationFrame: number;
  animationTimer: number;
  speed: number;
  visible: boolean;
  isPlayer: boolean;
  dialogueTriggered: boolean;
  appearsAfterObjective?: string;
}

interface TriggerZone {
  id: string;
  type: string;
  npcId?: string;
  row: number;
  col: number;
  width: number;
  height: number;
  radius: number;
  requiresObjective?: string;
  triggersTimeTransition?: boolean;
  dialogueId?: string;
  triggered: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  color?: string;       // Optional color override (for celebration bursts)
  gravity?: number;     // Optional gravity (for celebration bursts)
}

interface Firefly {
  x: number;            // World coordinates
  y: number;
  baseX: number;        // Anchor point for sinusoidal drift
  baseY: number;
  phase: number;        // Phase offset for blinking
  blinkSpeed: number;   // How fast the firefly blinks
  driftPhase: number;   // Phase offset for drift motion
  brightness: number;   // Current 0..1 brightness
}

interface DriftLeaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface BurstParticle {
  x: number;       // world coordinates
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

// Map from objective ID → world position where it triggers
// Used by the waypoint arrow to point toward the next objective.
const OBJECTIVE_LOCATIONS: Record<string, { row: number; col: number; label: string }> = {
  'obj.ch1.follow_tenyo':    { row: 14, col: 8,  label: 'Mang Tenyo' },
  'obj.ch1.overhear_gossip': { row: 9,  col: 4,  label: 'Market' },
  'obj.ch1.see_ibarra':      { row: 7,  col: 9,  label: 'Plaza' },
};

// Tree decoration positions (row, col) for vegetation around the plaza
const TREE_POSITIONS: { row: number; col: number; variant: number }[] = [
  { row: 1, col: 1, variant: 0 },
  { row: 1, col: 8, variant: 1 },
  { row: 1, col: 18, variant: 2 },
  { row: 5, col: 0, variant: 1 },
  { row: 5, col: 12, variant: 0 },
  { row: 7, col: 0, variant: 2 },
  { row: 7, col: 12, variant: 1 },
  { row: 9, col: 0, variant: 0 },
  { row: 9, col: 12, variant: 2 },
  { row: 12, col: 0, variant: 1 },
  { row: 12, col: 12, variant: 0 },
  { row: 13, col: 8, variant: 2 },
  { row: 14, col: 0, variant: 1 },
  { row: 14, col: 18, variant: 0 },
  { row: 0, col: 5, variant: 2 },
  { row: 0, col: 14, variant: 1 },
  { row: 15, col: 5, variant: 0 },
  { row: 15, col: 14, variant: 2 },
];

// Deterministic hash for tile decoration patterns
function tileHash(row: number, col: number, seed: number = 0): number {
  let h = seed + row * 374761393 + col * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7FFFFFFF) / 0x7FFFFFFF; // Returns 0..1
}

class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private tileSize: number = 48;
  private cameraX: number = 0;
  private cameraY: number = 0;

  // Entities
  private entities: Map<string, Entity> = new Map();
  private player: Entity | null = null;

  // Input state
  private keys: Set<string> = new Set();

  // Game state
  private chapterPhase: string = 'intro';
  private introShown: boolean = false;
  private triggerZones: TriggerZone[] = [];
  private dialogueActive: boolean = false;
  private currentDialogueId: string | null = null;
  private currentDialogueLineIndex: number = 0;
  private pendingDialogue: string | null = null;
  private timeOfDay: 'afternoon' | 'morning' = 'afternoon';
  private ibarraAppeared: boolean = false;

  // Canvas dimensions
  private viewWidth: number = 960;
  private viewHeight: number = 768;

  // NPC interaction
  private interactCooldown: number = 0;

  // Exploration stats — tracks tiles visited and NPCs talked to.
  // Persisted to localStorage under 'noor-stats' so the QuestTracker can show
  // a small "exploration" stat footer.
  private visitedTiles: Set<string> = new Set();
  private npcsTalkedTo: Set<string> = new Set();
  private statsFlushTimer: number = 0;

  // Atmosphere: ambient particles (dust motes)
  private particles: Particle[] = [];
  private particleSpawnTimer: number = 0;
  private gameTime: number = 0; // Running game time for animations

  // Atmosphere: fireflies (evening/afternoon glowing insects) - persistent, no lifecycle
  private fireflies: Firefly[] = [];
  private fireflySpawnTimer: number = 0;

  // Atmosphere: drifting leaves (occasional foliage blowing across the scene)
  private driftLeaves: DriftLeaf[] = [];
  private leafSpawnTimer: number = 0;

  // Celebration burst particles (golden burst when an objective completes)
  private burstParticles: BurstParticle[] = [];

  // Pre-computed building groups for efficient rendering
  private buildingGroups: Map<number, { minRow: number; minCol: number; maxRow: number; maxCol: number }[]> = new Map();

  constructor() {
    // Initialize trigger zones from map data
    this.triggerZones = mapData.triggerZones.map(z => ({ ...z, triggered: false }));
    
    // Pre-compute building groups (contiguous regions of same tile type)
    this._computeBuildingGroups();
  }

  private _computeBuildingGroups(): void {
    // For each building tile type, find contiguous rectangular groups
    const buildingTypes = [5, 6]; // Church and Market building types
    for (const tileType of buildingTypes) {
      const visited: Set<string> = new Set();
      const groups: { minRow: number; minCol: number; maxRow: number; maxCol: number }[] = [];
      
      for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
          const key = `${row},${col}`;
          if (visited.has(key)) continue;
          if (mapData.layers.buildings[row]?.[col] !== tileType) continue;
          
          // Find bounding box of contiguous group
          let minRow = row, maxRow = row, minCol = col, maxCol = col;
          const toVisit: [number, number][] = [[row, col]];
          
          while (toVisit.length > 0) {
            const [r, c] = toVisit.pop()!;
            const k = `${r},${c}`;
            if (visited.has(k)) continue;
            if (mapData.layers.buildings[r]?.[c] !== tileType) continue;
            visited.add(k);
            minRow = Math.min(minRow, r);
            maxRow = Math.max(maxRow, r);
            minCol = Math.min(minCol, c);
            maxCol = Math.max(maxCol, c);
            toVisit.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
          }
          
          groups.push({ minRow, minCol, maxRow, maxCol });
        }
      }
      
      this.buildingGroups.set(tileType, groups);
    }
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Load all required sprites
    const charsToLoad = ['student', 'ibara', 'mang-tenyo', 'kitchen-staff-1', 'kitchen-staff-2'];
    for (const charId of charsToLoad) {
      await spriteLoader.loadCharacter(charId);
    }

    // Create player entity
    const spawn = mapData.playerSpawn;
    this.player = {
      id: 'player',
      x: spawn.col * this.tileSize + this.tileSize / 2,
      y: spawn.row * this.tileSize + this.tileSize / 2,
      direction: 'north',
      characterKey: 'student',
      isMoving: false,
      animationFrame: 0,
      animationTimer: 0,
      speed: 120,
      visible: true,
      isPlayer: true,
      dialogueTriggered: false,
    };
    this.entities.set('player', this.player);

    // Create NPC entities
    const npcPositions = mapData.npcPositions as Record<string, { row: number; col: number; direction: string; appearsAfter?: string }>;
    for (const [npcId, pos] of Object.entries(npcPositions)) {
      const entity: Entity = {
        id: npcId,
        x: pos.col * this.tileSize + this.tileSize / 2,
        y: pos.row * this.tileSize + this.tileSize / 2,
        direction: pos.direction as Direction,
        characterKey: npcId,
        isMoving: false,
        animationFrame: 0,
        animationTimer: 0,
        speed: 0,
        visible: !pos.appearsAfter || saveManager.isObjectiveCompleted(pos.appearsAfter),
        isPlayer: false,
        dialogueTriggered: false,
        appearsAfterObjective: pos.appearsAfter,
      };
      this.entities.set(npcId, entity);
    }

    // Load saved progress
    await saveManager.loadProgress();
    const gameState = saveManager.getGameState();
    this.chapterPhase = gameState.chapterPhase;
    this.timeOfDay = gameState.timeOfDay;
    
    if (this.chapterPhase !== 'intro') {
      this.introShown = true;
    }

    // Update entity visibility based on completed objectives
    this._updateEntityVisibility();

    // Mark already-triggered zones
    this.triggerZones.forEach(zone => {
      if (zone.requiresObjective && saveManager.isObjectiveCompleted(zone.requiresObjective)) {
        // The prerequisite is done, but this zone itself may not have been triggered yet
        // Only mark as triggered if the objective THIS zone completes is also done
      }
    });

    // Bind input handlers
    this._bindInput();

    // Listen for objective completion events to spawn celebration bursts
    gameEvents.on('quest:objectiveComplete', (objectiveId: unknown) => {
      const id = objectiveId as string;
      const loc = OBJECTIVE_LOCATIONS[id];
      if (loc) {
        // Spawn burst at the objective's location in world coords
        this._spawnCelebrationBurst(
          loc.col * this.tileSize + this.tileSize / 2,
          loc.row * this.tileSize + this.tileSize / 2
        );
      }
    });

    // Start auto-save
    saveManager.startAutoSave();

    // Emit game ready
    gameEvents.emit('game:ready');

    // Initialize some particles
    this._initParticles();

    // Initialize fireflies (persistent ambient atmosphere)
    this._initFireflies();

    // Start game loop
    this.lastTimestamp = performance.now();
    this._gameLoop(this.lastTimestamp);
  }

  /**
   * Spawn a golden celebration burst at the given world position.
   * Used when an objective is completed.
   */
  private _spawnCelebrationBurst(worldX: number, worldY: number): void {
    const colors = ['#FFD700', '#FFA500', '#FFEC8B', '#FFEE00', '#FFC125'];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 60 + Math.random() * 80;
      this.burstParticles.push({
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // Slight upward bias
        life: 0,
        maxLife: 1.0 + Math.random() * 0.6,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
        gravity: 80,
      });
    }
  }

  private _updateBurstParticles(dt: number): void {
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i];
      p.life += dt;
      p.vy += p.gravity * dt;     // gravity pulls down
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Air resistance
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life >= p.maxLife) {
        this.burstParticles.splice(i, 1);
      }
    }
  }

  private _renderBurstParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.burstParticles) {
      const screenX = p.x - this.cameraX;
      const screenY = p.y - this.cameraY;
      if (screenX < -20 || screenX > this.viewWidth + 20 || screenY < -20 || screenY > this.viewHeight + 20) continue;
      const lifeRatio = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - lifeRatio);
      // Glow
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    if (container) {
      this.viewWidth = container.clientWidth;
      this.viewHeight = container.clientHeight;
    }
    this.canvas.width = this.viewWidth;
    this.canvas.height = this.viewHeight;
  }

  private _bindInput(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      // Space/Enter for NPC interaction
      if (e.key === ' ' || e.key === 'Enter') {
        this._handleInteract();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  // Public methods for touch/mobile controls
  setMoveDirection(direction: 'up' | 'down' | 'left' | 'right' | null): void {
    if (direction === null) {
      this.keys.delete('w');
      this.keys.delete('s');
      this.keys.delete('a');
      this.keys.delete('d');
      this.keys.delete('arrowup');
      this.keys.delete('arrowdown');
      this.keys.delete('arrowleft');
      this.keys.delete('arrowright');
    } else {
      switch (direction) {
        case 'up': this.keys.add('w'); this.keys.delete('s'); this.keys.delete('a'); this.keys.delete('d'); break;
        case 'down': this.keys.add('s'); this.keys.delete('w'); this.keys.delete('a'); this.keys.delete('d'); break;
        case 'left': this.keys.add('a'); this.keys.delete('d'); this.keys.delete('w'); this.keys.delete('s'); break;
        case 'right': this.keys.add('d'); this.keys.delete('a'); this.keys.delete('w'); this.keys.delete('s'); break;
      }
    }
  }

  triggerInteract(): void {
    this._handleInteract();
  }

  private _handleInteract(): void {
    if (this.dialogueActive) return;
    if (this.interactCooldown > 0) return;
    
    // Check if player is near an NPC they can talk to
    if (!this.player) return;

    for (const [npcId, npc] of this.entities) {
      if (npc.isPlayer || !npc.visible) continue;
      
      const dist = this._distanceBetween(this.player, npc);
      if (dist < this.tileSize * 2) {
        this.interactCooldown = 500;
        // Track NPC interaction for exploration stats
        this.npcsTalkedTo.add(npcId);
        
        // Determine which dialogue to trigger
        if (npcId === 'mang-tenyo' && !saveManager.isObjectiveCompleted('obj.ch1.follow_tenyo')) {
          this._startDialogue('mang-tenyo-first');
          return;
        }
        // Mang Tenyo can be talked to again — different dialogue based on progress
        if (npcId === 'mang-tenyo' && saveManager.isObjectiveCompleted('obj.ch1.follow_tenyo')) {
          // If gossip objective completed, give more insightful dialogue
          if (saveManager.isObjectiveCompleted('obj.ch1.overhear_gossip')) {
            this._startDialogue('mang-tenyo-after-gossip');
          } else {
            this._startDialogue('mang-tenyo-repeat');
          }
          return;
        }
      }
    }
  }

  private _distanceBetween(a: Entity, b: Entity): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private _startDialogue(dialogueId: string): void {
    const dialogue = dialogueData.dialogues[dialogueId as keyof typeof dialogueData.dialogues];
    if (!dialogue) {
      console.warn(`Dialogue not found: ${dialogueId}`);
      return;
    }

    this.dialogueActive = true;
    this.currentDialogueId = dialogueId;
    this.currentDialogueLineIndex = 0;

    gameEvents.emit('dialogue:start', {
      dialogueId,
      line: dialogue.lines[0],
      lineIndex: 0,
      totalLines: dialogue.lines.length,
    });
  }

  advanceDialogue(): void {
    if (!this.currentDialogueId) return;
    
    const dialogue = dialogueData.dialogues[this.currentDialogueId as keyof typeof dialogueData.dialogues];
    if (!dialogue) return;

    this.currentDialogueLineIndex++;

    if (this.currentDialogueLineIndex >= dialogue.lines.length) {
      // Dialogue complete
      this._endDialogue(dialogue);
      return;
    }

    const line = dialogue.lines[this.currentDialogueLineIndex];
    
    // Check for time transition
    if (line.isTimeTransition) {
      this.timeOfDay = 'morning';
      this.chapterPhase = 'ibarra-sighting';
      saveManager.updateGameState({ timeOfDay: 'morning', chapterPhase: 'ibarra-sighting' });
      gameEvents.emit('time:transition', 'morning');
    }

    // Check for Ibarra sighting
    if (line.isIbarraSighting) {
      this.ibarraAppeared = true;
      // Show Ibarra NPC
      const ibaraEntity = this.entities.get('ibara');
      if (ibaraEntity) {
        ibaraEntity.visible = true;
      }
    }

    gameEvents.emit('dialogue:line', {
      dialogueId: this.currentDialogueId,
      line,
      lineIndex: this.currentDialogueLineIndex,
      totalLines: dialogue.lines.length,
    });
  }

  private _endDialogue(dialogue: { unlocksObjective?: string | null; id: string }): void {
    this.dialogueActive = false;
    this.currentDialogueId = null;
    this.currentDialogueLineIndex = 0;

    // Update chapter phase based on dialogue completion
    if (dialogue.id === 'intro-text') {
      this.chapterPhase = 'explore';
      saveManager.updateGameState({ chapterPhase: 'explore' });
    }

    // Complete objective if dialogue unlocks one
    if (dialogue.unlocksObjective) {
      saveManager.completeObjective(dialogue.unlocksObjective);
      
      // Update entity visibility after objectives
      this._updateEntityVisibility();

      // Update chapter phase based on quest progress
      if (dialogue.id === 'mang-tenyo-first') {
        this.chapterPhase = 'explore';
        saveManager.updateGameState({ chapterPhase: 'explore' });
      }
      if (dialogue.id === 'market-gossip') {
        this.chapterPhase = 'gossip';
        saveManager.updateGameState({ chapterPhase: 'gossip' });
      }
    }

    // ===== Progressive Codex unlocks =====
    // Codex entries unlock as the player meets characters and overhears gossip,
    // so the Codex fills up DURING the chapter (not all at once at the end).
    // This gives the player a sense of progression and discovery.
    if (dialogue.id === 'mang-tenyo-first') {
      // After meeting Mang Tenyo: unlock himself + he mentions Ibarra
      saveManager.unlockCodexEntry('char.mang-tenyo');
      saveManager.unlockCodexEntry('char.ibarra');
      saveManager.addJournalEntry(
        'I arrived in San Diego. A cart driver named Mang Tenyo warned me not to mention the name "Ibarra" too loudly — something happened at last night\'s reception.',
        'ch1'
      );
    } else if (dialogue.id === 'market-gossip') {
      // After overhearing gossip: unlock the people mentioned
      saveManager.unlockCodexEntry('char.tiago');
      saveManager.unlockCodexEntry('char.damaso');
      saveManager.unlockCodexEntry('place.san-diego');
      saveManager.addJournalEntry(
        'At the market, Aling Nena and Mang Andres gossiped about Ibarra\'s homecoming reception. Padre Dámaso publicly insulted Ibarra — and he was once a close friend of Ibarra\'s late father. Capitán Tiago hosted the disastrous dinner.',
        'ch1'
      );
    } else if (dialogue.id === 'ibarra-sighting') {
      // After seeing Ibarra: unlock the broader historical context
      saveManager.unlockCodexEntry('historical.ilustrados');
      saveManager.unlockCodexEntry('historical.rizal');
      saveManager.unlockCodexEntry('historical.noli');
      saveManager.addJournalEntry(
        'I saw Crisóstomo Ibarra himself crossing the plaza at dawn. After seven years in Europe, he carries himself with an ease that the friars clearly fear. The gossip was right — his return has stirred up old tensions.',
        'ch1'
      );
    }

    gameEvents.emit('dialogue:end', dialogue.id);

    // Check if this was the gossip dialogue - enable Ibarra sighting zone
    if (dialogue.id === 'market-gossip') {
      // The market gossip zone should now be triggered
      this.triggerZones.forEach(z => {
        if (z.id === 'market-gossip') z.triggered = true;
      });
    }

    // Check if chapter is complete after Ibarra sighting dialogue
    if (dialogue.id === 'ibarra-sighting') {
      this._triggerChapterComplete();
    }
  }

  private _updateEntityVisibility(): void {
    for (const [npcId, entity] of this.entities) {
      if (entity.appearsAfterObjective) {
        entity.visible = saveManager.isObjectiveCompleted(entity.appearsAfterObjective);
      }
    }
    
    // Special: Ibarra appears after gossip objective AND time transition
    const ibara = this.entities.get('ibara');
    if (ibara && this.timeOfDay === 'morning' && saveManager.isObjectiveCompleted('obj.ch1.overhear_gossip')) {
      ibara.visible = true;
    }
  }

  private _triggerChapterComplete(): void {
    // Run the end-of-chapter loop (Section 8)
    // 1. Quiz is triggered via event
    gameEvents.emit('quiz:start', 'ch1');
    // The quiz component handles the rest (XP, codex, journal, medal, save)
  }

  completeChapterLoop(): void {
    // Called after quiz is completed
    // 2. Award XP
    saveManager.awardXp(60);
    // 3. Unlock codex entries
    saveManager.unlockCodexEntry('char.ibarra');
    saveManager.unlockCodexEntry('char.tiago');
    saveManager.unlockCodexEntry('char.damaso');
    // 4. Journal entry
    saveManager.addJournalEntry(
      "Mang Tenyo warned me not to mention the Ibarra name loudly. Something happened at last night's reception. I overheard the kitchen staff talking about Padre Dámaso's rudeness to Ibarra. Then I saw Ibarra himself crossing the plaza — a young man carrying ideas from Europe that the friars fear.",
      'ch1'
    );
    // 5. Chapter medal
    saveManager.awardChapterMedal('ch1', 'Listener');
    // 6. Complete quest
    saveManager.completeQuest('mq.ch1.arrival');
    saveManager.completeChapter('ch1');
    // 7. Save progress
    saveManager.saveProgress();
    
    this.chapterPhase = 'complete';
    gameEvents.emit('chapter:complete', 'ch1');
  }

  private _gameLoop(timestamp: number): void {
    const deltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    this.gameTime += deltaTime;

    this._update(deltaTime);
    this._render();

    this.animationFrameId = requestAnimationFrame(this._gameLoop.bind(this));
  }

  private _update(dt: number): void {
    if (!this.player) return;
    
    // Update interact cooldown
    if (this.interactCooldown > 0) {
      this.interactCooldown -= dt * 1000;
    }

    // Don't allow movement during dialogue
    if (this.dialogueActive) return;

    // Handle intro state
    if (this.chapterPhase === 'intro' && !this.introShown) {
      this.introShown = true;
      this._startDialogue('intro-text');
      return;
    }

    // Player movement
    let moveX = 0;
    let moveY = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) moveY = -1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) moveY = 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) moveX = -1;
    if (this.keys.has('d') || this.keys.has('arrowright')) moveX = 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
    }

    this.player.isMoving = moveX !== 0 || moveY !== 0;

    if (this.player.isMoving) {
      // Determine direction from movement vector
      this.player.direction = this._vectorToDirection(moveX, moveY);
      
      const newX = this.player.x + moveX * this.player.speed * dt;
      const newY = this.player.y + moveY * this.player.speed * dt;

      // Collision check
      if (!this._isBlocked(newX, newY)) {
        this.player.x = newX;
        this.player.y = newY;
      }

      // Update animation
      this.player.animationTimer += dt;
      const animConfig = characterData.characters.student.animations.Walk;
      if (this.player.animationTimer >= 1 / animConfig.frameRate) {
        this.player.animationTimer = 0;
        this.player.animationFrame = (this.player.animationFrame + 1) % animConfig.frames;
      }
    } else {
      // Idle animation
      this.player.animationTimer += dt;
      const animConfig = characterData.characters.student.animations.Breathing_Idle;
      if (this.player.animationTimer >= 1 / animConfig.frameRate) {
        this.player.animationTimer = 0;
        this.player.animationFrame = (this.player.animationFrame + 1) % animConfig.frames;
      }
    }

    // Update camera to follow player
    this.cameraX = this.player.x - this.viewWidth / 2;
    this.cameraY = this.player.y - this.viewHeight / 2;

    // Clamp camera to map bounds
    const mapPixelWidth = mapData.width * this.tileSize;
    const mapPixelHeight = mapData.height * this.tileSize;
    this.cameraX = Math.max(0, Math.min(this.cameraX, mapPixelWidth - this.viewWidth));
    this.cameraY = Math.max(0, Math.min(this.cameraY, mapPixelHeight - this.viewHeight));

    // NPC idle animations
    for (const [npcId, npc] of this.entities) {
      if (npc.isPlayer || !npc.visible) continue;
      npc.animationTimer += dt;
      const animConfig = characterData.characters[npc.characterKey as keyof typeof characterData.characters]?.animations?.Breathing_Idle;
      if (animConfig) {
        if (npc.animationTimer >= 1 / animConfig.frameRate) {
          npc.animationTimer = 0;
          npc.animationFrame = (npc.animationFrame + 1) % animConfig.frames;
        }
      }
    }

    // Check trigger zones
    this._checkTriggerZones();

    // Update particles
    this._updateParticles(dt);

    // Update fireflies (ambient glowing insects)
    this._updateFireflies(dt);

    // Update drifting leaves (occasional foliage)
    this._updateDriftLeaves(dt);

    // Update burst particles (celebration effect)
    this._updateBurstParticles(dt);

    // Update game state in SaveManager
    saveManager.updateGameState({
      playerPosition: {
        row: Math.floor(this.player.y / this.tileSize),
        col: Math.floor(this.player.x / this.tileSize),
      },
      playerDirection: this.player.direction,
      currentDialogue: this.currentDialogueId,
      timeOfDay: this.timeOfDay,
      chapterPhase: this.chapterPhase,
    });

    // Track exploration stats — count unique tiles visited
    const tileRow = Math.floor(this.player.y / this.tileSize);
    const tileCol = Math.floor(this.player.x / this.tileSize);
    const tileKey = `${tileRow},${tileCol}`;
    this.visitedTiles.add(tileKey);

    // Flush stats to localStorage every ~2s (debounced)
    this.statsFlushTimer += dt;
    if (this.statsFlushTimer > 2.0) {
      this.statsFlushTimer = 0;
      try {
        localStorage.setItem('noor-stats', JSON.stringify({
          tilesExplored: this.visitedTiles.size,
          npcsTalkedTo: this.npcsTalkedTo.size,
        }));
      } catch {
        // localStorage may be unavailable; ignore
      }
    }
  }

  private _vectorToDirection(x: number, y: number): Direction {
    // Map movement vector to 8-direction name
    const angle = Math.atan2(y, x) * (180 / Math.PI);
    
    if (angle >= -22.5 && angle < 22.5) return 'east';
    if (angle >= 22.5 && angle < 67.5) return 'south-east';
    if (angle >= 67.5 && angle < 112.5) return 'south';
    if (angle >= 112.5 && angle < 157.5) return 'south-west';
    if (angle >= 157.5 || angle < -157.5) return 'west';
    if (angle >= -157.5 && angle < -112.5) return 'north-west';
    if (angle >= -112.5 && angle < -67.5) return 'north';
    if (angle >= -67.5 && angle < -22.5) return 'north-east';
    return 'south';
  }

  private _isBlocked(x: number, y: number): boolean {
    // Check collision map
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    
    if (row < 0 || row >= mapData.height || col < 0 || col >= mapData.width) return true;
    
    // Check player sprite footprint (check a small area around center)
    const checks = [
      { x: x - 16, y: y - 16 },
      { x: x + 16, y: y - 16 },
      { x: x - 16, y: y + 16 },
      { x: x + 16, y: y + 16 },
    ];
    
    for (const check of checks) {
      const cCol = Math.floor(check.x / this.tileSize);
      const cRow = Math.floor(check.y / this.tileSize);
      if (cRow < 0 || cRow >= mapData.height || cCol < 0 || cCol >= mapData.width) return true;
      if (mapData.layers.collision[cRow][cCol] === 1) return true;
    }
    
    return false;
  }

  private _checkTriggerZones(): void {
    if (!this.player || this.dialogueActive) return;
    
    const playerRow = Math.floor(this.player.y / this.tileSize);
    const playerCol = Math.floor(this.player.x / this.tileSize);

    for (const zone of this.triggerZones) {
      if (zone.triggered) continue;

      // Check prerequisite objective
      if (zone.requiresObjective && !saveManager.isObjectiveCompleted(zone.requiresObjective)) continue;

      // Check if player is in the zone
      const inZone = playerCol >= zone.col && playerCol < zone.col + zone.width &&
                     playerRow >= zone.row && playerRow < zone.row + zone.height;

      // Or within radius of NPC
      let nearNpc = false;
      if (zone.radius > 0 && zone.npcId) {
        const npc = this.entities.get(zone.npcId);
        if (npc && npc.visible) {
          nearNpc = this._distanceBetween(this.player, npc) < this.tileSize * zone.radius;
        }
      }

      if (inZone || nearNpc) {
        zone.triggered = true;

        switch (zone.type) {
          case 'npc-interact':
            // NPC interaction zones just highlight the NPC, actual dialogue starts on interact
            break;
          case 'auto-trigger':
            // Generic auto-trigger: if zone has a dialogueId, start that dialogue
            if (zone.dialogueId) {
              // Special handling for Ibarra sighting (time transition)
              if (zone.id === 'ibarra-sighting') {
                this.timeOfDay = 'morning';
                this.chapterPhase = 'ibarra-sighting';
                saveManager.updateGameState({ timeOfDay: 'morning', chapterPhase: 'ibarra-sighting' });
                this._updateEntityVisibility();
              }
              this._startDialogue(zone.dialogueId);
            } else {
              // Legacy hardcoded triggers as fallback
              if (zone.id === 'market-gossip') {
                this._startDialogue('market-gossip');
              } else if (zone.id === 'ibarra-sighting') {
                this.timeOfDay = 'morning';
                this.chapterPhase = 'ibarra-sighting';
                saveManager.updateGameState({ timeOfDay: 'morning', chapterPhase: 'ibarra-sighting' });
                this._updateEntityVisibility();
                this._startDialogue('ibarra-sighting');
              }
            }
            break;
        }
      }
    }
  }

  // ==================== PARTICLE SYSTEM ====================

  private _initParticles(): void {
    // Seed some initial particles
    for (let i = 0; i < 15; i++) {
      this._spawnParticle();
    }
  }

  private _spawnParticle(): void {
    if (!this.player) return;
    // Spawn particle near the camera view area
    const cx = this.cameraX + this.viewWidth / 2;
    const cy = this.cameraY + this.viewHeight / 2;
    this.particles.push({
      x: cx + (Math.random() - 0.5) * this.viewWidth * 0.8,
      y: cy + (Math.random() - 0.5) * this.viewHeight * 0.8,
      vx: (Math.random() - 0.5) * 8, // Slow drift
      vy: -Math.random() * 4 - 1, // Slight upward drift
      alpha: 0,
      size: Math.random() * 2.5 + 1,
      life: 0,
      maxLife: Math.random() * 6 + 4, // 4-10 seconds
    });
  }

  private _updateParticles(dt: number): void {
    // Spawn new particles periodically
    this.particleSpawnTimer += dt;
    if (this.particleSpawnTimer > 0.3 && this.particles.length < 25) {
      this.particleSpawnTimer = 0;
      this._spawnParticle();
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Gentle oscillation
      p.x += Math.sin(this.gameTime * 0.5 + i) * 0.3;

      // Fade in then fade out
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < 0.2) {
        p.alpha = lifeRatio / 0.2 * 0.4; // Fade in
      } else if (lifeRatio > 0.7) {
        p.alpha = (1 - lifeRatio) / 0.3 * 0.4; // Fade out
      } else {
        p.alpha = 0.4; // Visible
      }

      // Remove dead particles
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  // ==================== FIREFLIES ====================

  private _initFireflies(): void {
    // Pre-spawn fireflies scattered around the map (persistent)
    if (!this.player) return;
    const MAP_W = mapData.width * this.tileSize;
    const MAP_H = mapData.height * this.tileSize;
    for (let i = 0; i < 18; i++) {
      const fx = Math.random() * MAP_W;
      const fy = Math.random() * MAP_H;
      this.fireflies.push({
        x: fx,
        y: fy,
        baseX: fx,
        baseY: fy,
        phase: Math.random() * Math.PI * 2,
        blinkSpeed: 0.8 + Math.random() * 1.6, // 0.8-2.4 rad/s
        driftPhase: Math.random() * Math.PI * 2,
        brightness: 0,
      });
    }
  }

  private _updateFireflies(dt: number): void {
    // Note: gameTime is already updated in the main _update() loop

    // Occasionally relocate fireflies that are too far from the player's view
    // so we always have some nearby fireflies
    this.fireflySpawnTimer += dt;
    if (this.fireflySpawnTimer > 1.5 && this.player) {
      this.fireflySpawnTimer = 0;
      // Despawn fireflies that wandered too far
      this.fireflies = this.fireflies.filter(f => {
        const dx = f.x - this.player!.x;
        const dy = f.y - this.player!.y;
        return Math.sqrt(dx * dx + dy * dy) < this.viewWidth * 1.2;
      });
      // Spawn a few new ones near the player's view
      while (this.fireflies.length < 18 && this.player) {
        const angle = Math.random() * Math.PI * 2;
        const radius = this.viewWidth * 0.4 + Math.random() * this.viewWidth * 0.3;
        const fx = this.player.x + Math.cos(angle) * radius;
        const fy = this.player.y + Math.sin(angle) * radius;
        this.fireflies.push({
          x: fx,
          y: fy,
          baseX: fx,
          baseY: fy,
          phase: Math.random() * Math.PI * 2,
          blinkSpeed: 0.8 + Math.random() * 1.6,
          driftPhase: Math.random() * Math.PI * 2,
          brightness: 0,
        });
      }
    }

    // Update firefly positions and brightness
    for (const f of this.fireflies) {
      // Sinusoidal drift around the anchor point
      const driftRadius = 18;
      f.x = f.baseX + Math.cos(this.gameTime * 0.6 + f.driftPhase) * driftRadius;
      f.y = f.baseY + Math.sin(this.gameTime * 0.4 + f.driftPhase * 1.3) * driftRadius * 0.7;

      // Slowly migrate the anchor point (gentle wandering)
      f.baseX += Math.sin(this.gameTime * 0.15 + f.driftPhase) * 0.15;
      f.baseY += Math.cos(this.gameTime * 0.18 + f.phase) * 0.1;

      // Blink brightness using a smooth wave (0..1)
      // Use sin^4 for sharper on/off transitions
      const raw = Math.sin(this.gameTime * f.blinkSpeed + f.phase);
      const norm = (raw + 1) / 2; // 0..1
      f.brightness = Math.pow(norm, 3); // Sharp blink curve
    }
  }

  private _renderFireflies(ctx: CanvasRenderingContext2D): void {
    // Fireflies only show during afternoon (golden hour) — they evoke a warm evening feel
    if (this.timeOfDay !== 'afternoon') return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Additive blending for glow

    for (const f of this.fireflies) {
      const screenX = f.x - this.cameraX;
      const screenY = f.y - this.cameraY;

      // Skip off-screen fireflies
      if (screenX < -30 || screenX > this.viewWidth + 30 || screenY < -30 || screenY > this.viewHeight + 30) continue;

      const b = f.brightness;
      if (b < 0.02) continue;

      // Outer glow halo (large soft circle)
      const glowRadius = 12;
      const glowGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
      glowGrad.addColorStop(0, `rgba(255, 240, 160, ${0.5 * b})`);
      glowGrad.addColorStop(0.3, `rgba(255, 220, 100, ${0.25 * b})`);
      glowGrad.addColorStop(1, 'rgba(255, 200, 80, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core bright dot
      ctx.fillStyle = `rgba(255, 255, 220, ${0.95 * b})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ==================== DRIFTING LEAVES ====================

  private _updateDriftLeaves(dt: number): void {
    // Occasionally spawn a new leaf
    this.leafSpawnTimer += dt;
    if (this.leafSpawnTimer > 2.5 + Math.random() * 3 && this.player && this.driftLeaves.length < 8) {
      this.leafSpawnTimer = 0;
      // Spawn from the right side (wind blowing from east to west)
      const spawnX = this.player.x + this.viewWidth * 0.6 + Math.random() * 100;
      const spawnY = this.player.y - this.viewHeight * 0.3 + Math.random() * this.viewHeight * 0.6;
      const colors = ['#8B5A2B', '#A0522D', '#6B4423', '#C17840', '#9C6B3F'];
      this.driftLeaves.push({
        x: spawnX,
        y: spawnY,
        vx: -25 - Math.random() * 20, // Wind blows leftward
        vy: 8 + Math.random() * 8,    // Gentle downward drift
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 3,
        size: 5 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0,
        life: 0,
        maxLife: 8 + Math.random() * 4,
      });
    }

    // Update leaves
    for (let i = this.driftLeaves.length - 1; i >= 0; i--) {
      const leaf = this.driftLeaves[i];
      leaf.life += dt;

      // Leaf motion: drifts left and downward, with sinusoidal sway
      leaf.x += leaf.vx * dt + Math.sin(this.gameTime * 1.5 + i) * 0.5;
      leaf.y += leaf.vy * dt + Math.cos(this.gameTime * 1.2 + i * 0.7) * 0.3;
      leaf.rotation += leaf.rotationSpeed * dt;

      // Fade in/out
      const lifeRatio = leaf.life / leaf.maxLife;
      if (lifeRatio < 0.15) {
        leaf.alpha = lifeRatio / 0.15 * 0.85;
      } else if (lifeRatio > 0.7) {
        leaf.alpha = (1 - lifeRatio) / 0.3 * 0.85;
      } else {
        leaf.alpha = 0.85;
      }

      // Remove dead leaves
      if (leaf.life >= leaf.maxLife) {
        this.driftLeaves.splice(i, 1);
      }
    }
  }

  private _renderDriftLeaves(ctx: CanvasRenderingContext2D): void {
    for (const leaf of this.driftLeaves) {
      const screenX = leaf.x - this.cameraX;
      const screenY = leaf.y - this.cameraY;
      if (screenX < -20 || screenX > this.viewWidth + 20 || screenY < -20 || screenY > this.viewHeight + 20) continue;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(leaf.rotation);
      ctx.globalAlpha = leaf.alpha;

      // Draw a simple leaf shape (almond/oval)
      ctx.fillStyle = leaf.color;
      ctx.beginPath();
      // Ellipse-ish leaf shape
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Leaf vein (thin darker line)
      ctx.strokeStyle = 'rgba(40, 25, 10, 0.4)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-leaf.size, 0);
      ctx.lineTo(leaf.size, 0);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ==================== RENDERING ====================

  private _render(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;

    // Clear canvas
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    // Draw sky gradient based on time of day
    this._renderSkyGradient(ctx);

    // Render map layers
    this._renderMap(ctx);

    // Render fountain/well feature in plaza center
    this._renderFountain(ctx);

    // Render tree/vegetation decorations
    this._renderTrees(ctx);

    // Render map decorations (benches, cart, flagpole, flower boxes)
    this._renderMapDecorations(ctx);

    // Render building details (walls, roofs, windows, doors)
    this._renderBuildingDetails(ctx);

    // Render building labels (signage panels)
    this._renderBuildingLabels(ctx);

    // Render entities (sorted by Y for depth)
    const sortedEntities = [...this.entities.values()]
      .filter(e => e.visible)
      .sort((a, b) => a.y - b.y);

    for (const entity of sortedEntities) {
      this._renderEntity(ctx, entity);
    }

    // Render NPC interaction indicators
    this._renderInteractionIndicators(ctx);

    // Render trigger zone hints (subtle visual cues)
    this._renderTriggerHints(ctx);

    // Render ambient particles (dust motes)
    this._renderParticles(ctx);

    // Render fireflies (glowing evening insects)
    this._renderFireflies(ctx);

    // Render drifting leaves
    this._renderDriftLeaves(ctx);

    // Render atmospheric effects (mist, birds)
    this._renderMist(ctx);
    this._renderBirds(ctx);

    // Render burst particles (celebration effect when objective completes)
    this._renderBurstParticles(ctx);

    // Render waypoint arrow pointing to next objective
    this._renderWaypointArrow(ctx);

    // Render time-of-day lighting overlay
    this._renderTimeOfDayOverlay(ctx);

    // Render vignette effect (dark edges)
    this._renderVignette(ctx);
  }

  // ==================== WAYPOINT ARROW ====================

  /**
   * Render a golden arrow at the screen edge pointing toward the next incomplete objective.
   * Only shown when no dialogue is active and the player isn't standing in the objective zone.
   */
  private _renderWaypointArrow(ctx: CanvasRenderingContext2D): void {
    if (!this.player || this.dialogueActive) return;
    if (this.chapterPhase === 'intro' || this.chapterPhase === 'complete') return;

    // Find the next incomplete objective
    const objectivesOrder = ['obj.ch1.follow_tenyo', 'obj.ch1.overhear_gossip', 'obj.ch1.see_ibarra'];
    const nextObjId = objectivesOrder.find(id => !saveManager.isObjectiveCompleted(id));
    if (!nextObjId) return;

    const loc = OBJECTIVE_LOCATIONS[nextObjId];
    if (!loc) return;

    const targetX = loc.col * this.tileSize + this.tileSize / 2;
    const targetY = loc.row * this.tileSize + this.tileSize / 2;

    // Vector from player to target
    const dx = targetX - this.player.x;
    const dy = targetY - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Don't show arrow if very close
    if (dist < this.tileSize * 2.5) return;

    // Compute target position on screen (may be off-screen)
    const screenTargetX = targetX - this.cameraX;
    const screenTargetY = targetY - this.cameraY;

    const cx = this.viewWidth / 2;
    const cy = this.viewHeight / 2;

    // If the target is on screen, don't show the edge arrow (the indicator is enough)
    const onScreen = screenTargetX > 40 && screenTargetX < this.viewWidth - 40 &&
                     screenTargetY > 80 && screenTargetY < this.viewHeight - 80;
    if (onScreen) return;

    // Direction from center of screen to target
    const angle = Math.atan2(dy, dx);

    // Place arrow at a fixed radius from screen center, clamped to a margin inside the screen
    const margin = 80;
    const maxRadiusX = this.viewWidth / 2 - margin;
    const maxRadiusY = this.viewHeight / 2 - margin;
    // Project the direction onto the screen-edge ellipse
    // Solve for t such that (t*cos(angle), t*sin(angle)) lies on the ellipse (maxRX, maxRY)
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const t = 1 / Math.sqrt((cosA * cosA) / (maxRadiusX * maxRadiusX) + (sinA * sinA) / (maxRadiusY * maxRadiusY));
    const arrowX = cx + cosA * t;
    const arrowY = cy + sinA * t;

    // Pulsing effect
    const pulse = Math.sin(this.gameTime * 4) * 0.15 + 0.85;

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);

    // Outer glow
    ctx.fillStyle = `rgba(255,215,0,${0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    // Arrow shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();

    // Arrow body
    ctx.fillStyle = `rgba(255,215,0,${pulse})`;
    ctx.strokeStyle = 'rgba(180,120,0,1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Distance label below arrow
    const distTiles = Math.round(dist / this.tileSize);
    ctx.font = 'bold 10px "Geist", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(arrowX - 22, arrowY + 14, 44, 14);
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText(`${distTiles}m →`, arrowX, arrowY + 24);
  }

  // ==================== SKY / BACKGROUND ====================

  private _renderSkyGradient(ctx: CanvasRenderingContext2D): void {
    // Create a gradient for the sky/background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
    
    if (this.timeOfDay === 'afternoon') {
      // Warm golden afternoon: deep sky blue at top, warm golden at bottom
      gradient.addColorStop(0, '#6BB3D9');    // Deep afternoon sky
      gradient.addColorStop(0.4, '#8FC8E8');  // Mid sky
      gradient.addColorStop(0.7, '#C4E0E8');  // Lighter
      gradient.addColorStop(1, '#E8D4A0');    // Warm golden horizon
    } else {
      // Cool blue-white morning: pale sky, slightly warm at horizon
      gradient.addColorStop(0, '#B8D4E8');    // Cool morning sky
      gradient.addColorStop(0.4, '#D0E4F0');  // Pale mid sky
      gradient.addColorStop(0.7, '#E4E8EC');  // Very pale
      gradient.addColorStop(1, '#F0E8D8');    // Slightly warm horizon
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
  }

  // ==================== MAP TILE RENDERING ====================

  private _renderMap(ctx: CanvasRenderingContext2D): void {
    // Only render visible tiles (camera culling)
    const startCol = Math.floor(this.cameraX / this.tileSize);
    const startRow = Math.floor(this.cameraY / this.tileSize);
    const endCol = Math.min(mapData.width, startCol + Math.ceil(this.viewWidth / this.tileSize) + 1);
    const endRow = Math.min(mapData.height, startRow + Math.ceil(this.viewHeight / this.tileSize) + 1);

    // Draw ground layer with detailed patterns
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        if (row < 0 || col < 0) continue;
        const tileType = mapData.layers.ground[row]?.[col];
        if (tileType && tileType !== 0) {
          const x = col * this.tileSize - this.cameraX;
          const y = row * this.tileSize - this.cameraY;
          
          switch (tileType) {
            case 1: // Dirt/stone (ochre/tan) - building interior floor
              this._renderDirtFloor(ctx, x, y, row, col);
              break;
            case 2: // Grass (green) - outskirts/wild areas
              this._renderGrass(ctx, x, y, row, col);
              break;
            case 3: // Plaza (tan/dirt) - walkable area
              this._renderPlazaCobblestone(ctx, x, y, row, col);
              break;
            case 4: // Market stalls (brown)
              this._renderMarketStalls(ctx, x, y, row, col);
              break;
            default:
              const color = mapData.tileColors[String(tileType) as keyof typeof mapData.tileColors];
              ctx.fillStyle = color;
              ctx.fillRect(x, y, this.tileSize, this.tileSize);
          }
        }
      }
    }

    // Draw buildings layer (flat base color - details rendered separately)
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        if (row < 0 || col < 0) continue;
        const tileType = mapData.layers.buildings[row]?.[col];
        if (tileType && tileType !== 0) {
          const x = col * this.tileSize - this.cameraX;
          const y = row * this.tileSize - this.cameraY;

          // Base building fill
          const color = mapData.tileColors[String(tileType) as keyof typeof mapData.tileColors];
          ctx.fillStyle = color;
          ctx.fillRect(x, y, this.tileSize, this.tileSize);
        }
      }
    }
  }

  // ==================== DETAILED TILE RENDERERS ====================

  private _renderGrass(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, col: number): void {
    const ts = this.tileSize;
    const h = tileHash(row, col, 42);
    
    // Base grass color with slight variation per tile
    const baseGreen = h < 0.5 ? '#7BAF6E' : '#6B9E5E';
    ctx.fillStyle = baseGreen;
    ctx.fillRect(x, y, ts, ts);
    
    // Second shade patches for depth variation
    const h2 = tileHash(row, col, 99);
    ctx.fillStyle = h2 < 0.3 ? '#5C8B4E' : h2 < 0.6 ? '#8BC47B' : '#6B9E5E';
    // Random patch placement
    const patchX = x + tileHash(row, col, 7) * (ts - 16);
    const patchY = y + tileHash(row, col, 13) * (ts - 16);
    ctx.fillRect(patchX, patchY, 16, 16);
    
    // Grass blade clusters (multiple small blades)
    ctx.fillStyle = '#8FD47F';
    const bladeCount = 3 + Math.floor(tileHash(row, col, 23) * 4);
    for (let i = 0; i < bladeCount; i++) {
      const bx = x + tileHash(row, col, i * 7 + 1) * (ts - 6);
      const by = y + tileHash(row, col, i * 11 + 3) * (ts - 10);
      const bladeH = 5 + tileHash(row, col, i * 3 + 5) * 7;
      ctx.fillRect(bx, by - bladeH, 1.5, bladeH);
      // Second blade slightly offset
      ctx.fillRect(bx + 2, by - bladeH * 0.7, 1, bladeH * 0.7);
    }
    
    // Darker grass blades for depth
    ctx.fillStyle = '#4E7A3E';
    for (let i = 0; i < 2; i++) {
      const bx = x + tileHash(row, col, i * 17 + 50) * (ts - 6);
      const by = y + tileHash(row, col, i * 19 + 60) * (ts - 8);
      ctx.fillRect(bx, by - 5, 1.5, 5);
    }
    
    // Occasional flowers (small colored dots)
    const flowerChance = tileHash(row, col, 77);
    if (flowerChance < 0.15) {
      // Small wildflower
      const flowerX = x + tileHash(row, col, 88) * (ts - 8) + 4;
      const flowerY = y + tileHash(row, col, 91) * (ts - 8) + 4;
      const flowerColors = ['#FFE066', '#FF9999', '#CC99FF', '#FFCC99'];
      ctx.fillStyle = flowerColors[Math.floor(tileHash(row, col, 95) * flowerColors.length)];
      ctx.beginPath();
      ctx.arc(flowerX, flowerY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Flower center
      ctx.fillStyle = '#FFE066';
      ctx.beginPath();
      ctx.arc(flowerX, flowerY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Very subtle, near-invisible grid line (for alignment only)
    ctx.strokeStyle = 'rgba(0,0,0,0.02)';
    ctx.lineWidth = 0.25;
    ctx.strokeRect(x, y, ts, ts);
  }

  private _renderPlazaCobblestone(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, col: number): void {
    const ts = this.tileSize;
    
    // Base tan/dirt color
    ctx.fillStyle = '#C4A76C';
    ctx.fillRect(x, y, ts, ts);
    
    // Warm dirt undertone
    ctx.fillStyle = '#B89858';
    const patchH = tileHash(row, col, 33);
    if (patchH < 0.4) {
      ctx.fillRect(x + 8, y + 8, ts - 16, ts - 16);
    }
    
    // Cobblestone pattern - individual stones
    const stoneW = 14;
    const stoneH = 10;
    const gap = 2;
    
    for (let sy = 0; sy < ts; sy += stoneH + gap) {
      const offset = ((sy / (stoneH + gap)) % 2 === 0) ? 0 : stoneW / 2; // Brick-like offset
      for (let sx = offset; sx < ts; sx += stoneW + gap) {
        const sh = tileHash(row, col, sy * 100 + sx);
        // Stone color variations
        const stoneColors = ['#D2B48C', '#C4A76C', '#B89560', '#A88950', '#C9AE7A'];
        ctx.fillStyle = stoneColors[Math.floor(sh * stoneColors.length)];
        
        // Draw rounded stone
        const sw = Math.min(stoneW, ts - sx);
        const sht = Math.min(stoneH, ts - sy);
        if (sw > 0 && sht > 0) {
          ctx.beginPath();
          const r = 2;
          ctx.roundRect(x + sx, y + sy, sw, sht, r);
          ctx.fill();
          
          // Subtle stone edge shadow
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(x + sx, y + sy + sht - 1.5, sw, 1.5);
          
          // Stone highlight on top
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(x + sx, y + sy, sw, 2);
        }
      }
    }
    
    // Dirt/gravel fill between stones
    ctx.fillStyle = '#A88950';
    for (let i = 0; i < 3; i++) {
      const gx = x + tileHash(row, col, i * 29 + 100) * ts;
      const gy = y + tileHash(row, col, i * 31 + 110) * ts;
      ctx.fillRect(gx, gy, 2, 2);
    }
    
    // Very subtle grid line
    ctx.strokeStyle = 'rgba(0,0,0,0.02)';
    ctx.lineWidth = 0.25;
    ctx.strokeRect(x, y, ts, ts);
  }

  private _renderDirtFloor(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, col: number): void {
    const ts = this.tileSize;
    
    // Base interior floor
    ctx.fillStyle = '#C4A76C';
    ctx.fillRect(x, y, ts, ts);
    
    // Floor tile pattern (checkerboard-like with subtle variation)
    const h = tileHash(row, col, 55);
    ctx.fillStyle = h < 0.5 ? '#BFA068' : '#C9AE76';
    ctx.fillRect(x, y, ts, ts);
    
    // Subtle floor line pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 0.5;
    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(x, y + ts / 2);
    ctx.lineTo(x + ts, y + ts / 2);
    ctx.stroke();
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(x + ts / 2, y);
    ctx.lineTo(x + ts / 2, y + ts);
    ctx.stroke();
    
    // Occasional crack/wear mark
    const crackChance = tileHash(row, col, 200);
    if (crackChance < 0.2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const cx1 = x + tileHash(row, col, 210) * ts;
      const cy1 = y + tileHash(row, col, 220) * ts;
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx1 + 8, cy1 + 4);
      ctx.stroke();
    }
  }

  private _renderMarketStalls(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, col: number): void {
    const ts = this.tileSize;
    
    // Base market stall ground
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x, y, ts, ts);
    
    // Stall wood planks pattern
    ctx.fillStyle = '#8B4513';
    for (let py = 0; py < ts; py += 8) {
      const plankOffset = tileHash(row, col, py) * 4;
      ctx.fillRect(x + plankOffset, y + py, ts, 6);
      // Plank edge
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x + plankOffset, y + py + 5, ts, 1);
      ctx.fillStyle = '#8B4513';
    }
    
    // Wood grain lines
    ctx.strokeStyle = 'rgba(139,69,19,0.3)';
    ctx.lineWidth = 0.3;
    for (let i = 0; i < 3; i++) {
      const gx = x + tileHash(row, col, i * 40 + 300) * ts;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + 2, y + ts);
      ctx.stroke();
    }
  }

  // ==================== BUILDING DETAIL RENDERING ====================

  private _renderBuildingDetails(ctx: CanvasRenderingContext2D): void {
    // For each building group, render walls, roof, windows, and doors
    const groups5 = this.buildingGroups.get(5) || []; // Church
    const groups6 = this.buildingGroups.get(6) || []; // Market
    
    for (const group of groups5) {
      this._renderChurchBuilding(ctx, group);
    }
    for (const group of groups6) {
      this._renderMarketBuilding(ctx, group);
    }
  }

  private _renderChurchBuilding(ctx: CanvasRenderingContext2D, group: { minRow: number; minCol: number; maxRow: number; maxCol: number }): void {
    const ts = this.tileSize;
    const bx = group.minCol * ts - this.cameraX;
    const by = group.minRow * ts - this.cameraY;
    const bw = (group.maxCol - group.minCol + 1) * ts;
    const bh = (group.maxRow - group.minRow + 1) * ts;
    
    // Building shadow on the ground (to the south and east)
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(bx + 6, by + bh, bw, 12);
    ctx.fillRect(bx + bw, by + 6, 12, bh + 6);
    
    // Wall texture - stone blocks
    ctx.fillStyle = '#696969';
    ctx.fillRect(bx, by, bw, bh);
    
    // Wall block pattern
    const blockH = 12;
    const blockW = 18;
    for (let wy = 0; wy < bh; wy += blockH) {
      const offset = ((wy / blockH) % 2 === 0) ? 0 : blockW / 2;
      for (let wx = offset; wx < bw; wx += blockW) {
        const sh = tileHash(group.minRow + Math.floor(wy / ts), group.minCol + Math.floor(wx / ts), 500);
        const grays = ['#7A7A7A', '#6E6E6E', '#626262', '#757575'];
        ctx.fillStyle = grays[Math.floor(sh * grays.length)];
        const sw = Math.min(blockW, bw - wx);
        const sht = Math.min(blockH, bh - wy);
        if (sw > 0 && sht > 0) {
          ctx.fillRect(bx + wx, by + wy, sw, sht);
          // Block mortar line
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(bx + wx, by + wy, sw, sht);
        }
      }
    }
    
    // Roof line at the top
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(bx - 4, by - 6, bw + 8, 8);
    // Roof edge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(bx - 4, by + 2, bw + 8, 4);
    // Roof cap
    ctx.fillStyle = '#555555';
    ctx.fillRect(bx - 2, by - 10, bw + 4, 6);
    
    // Windows - evenly spaced
    const windowCount = Math.max(1, Math.floor(bw / (ts * 1.2)));
    const windowSpacing = bw / (windowCount + 1);
    for (let i = 1; i <= windowCount; i++) {
      const wx = bx + i * windowSpacing;
      const wy = by + bh * 0.35;
      
      // Window frame
      ctx.fillStyle = '#8B7355';
      ctx.fillRect(wx - 8, wy - 6, 16, 12);
      
      // Window glass
      ctx.fillStyle = this.timeOfDay === 'afternoon' ? '#E8D4A0' : '#D0E4F0';
      ctx.fillRect(wx - 6, wy - 4, 12, 8);
      
      // Window cross bars
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, wy - 4);
      ctx.lineTo(wx, wy + 4);
      ctx.moveTo(wx - 6, wy);
      ctx.lineTo(wx + 6, wy);
      ctx.stroke();
      
      // Window light glow (subtle)
      if (this.timeOfDay === 'afternoon') {
        ctx.fillStyle = 'rgba(232,212,160,0.15)';
        ctx.fillRect(wx - 10, wy - 8, 20, 16);
      }
    }
    
    // Church cross on top
    const centerX = bx + bw / 2;
    ctx.fillStyle = '#D4D4D4';
    ctx.fillRect(centerX - 2, by - 22, 4, 14);
    ctx.fillRect(centerX - 6, by - 18, 12, 4);
    
    // Door at bottom center
    const doorX = bx + bw / 2 - 8;
    const doorY = by + bh - 16;
    ctx.fillStyle = '#5C3A1E';
    ctx.fillRect(doorX, doorY, 16, 16);
    // Door frame
    ctx.strokeStyle = '#4A2A10';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(doorX, doorY, 16, 16);
    // Door arch
    ctx.fillStyle = '#6E6E6E';
    ctx.beginPath();
    ctx.arc(doorX + 8, doorY, 8, Math.PI, 0);
    ctx.fill();
  }

  private _renderMarketBuilding(ctx: CanvasRenderingContext2D, group: { minRow: number; minCol: number; maxRow: number; maxCol: number }): void {
    const ts = this.tileSize;
    const bx = group.minCol * ts - this.cameraX;
    const by = group.minRow * ts - this.cameraY;
    const bw = (group.maxCol - group.minCol + 1) * ts;
    const bh = (group.maxRow - group.minRow + 1) * ts;
    
    // Building shadow on the ground (south and east)
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(bx + 4, by + bh, bw, 10);
    ctx.fillRect(bx + bw, by + 4, 10, bh + 4);
    
    // Wall base - wood planks
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(bx, by, bw, bh);
    
    // Wood plank texture
    const plankH = 10;
    for (let py = 0; py < bh; py += plankH) {
      const sh = tileHash(group.minRow + Math.floor(py / ts), group.minCol, 600);
      const woodColors = ['#9B5523', '#8B4513', '#7B3513', '#8A4010'];
      ctx.fillStyle = woodColors[Math.floor(sh * woodColors.length)];
      ctx.fillRect(bx, by + py, bw, plankH - 1);
      // Plank gap line
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(bx, by + py + plankH - 1, bw, 1);
    }
    
    // Wood grain vertical lines
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 0.3;
    for (let vx = 0; vx < bw; vx += 14) {
      ctx.beginPath();
      ctx.moveTo(bx + vx, by);
      ctx.lineTo(bx + vx + 1, by + bh);
      ctx.stroke();
    }
    
    // Awning/canopy over the market stalls (colorful fabric)
    const awningY = by - 8;
    ctx.fillStyle = '#CC4444';
    ctx.fillRect(bx - 6, awningY, bw + 12, 10);
    // Awning stripe pattern
    ctx.fillStyle = '#EECCCC';
    for (let sx = 0; sx < bw + 12; sx += 16) {
      ctx.fillRect(bx - 6 + sx, awningY, 8, 10);
    }
    // Awning shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(bx - 6, awningY + 10, bw + 12, 3);
    // Awning support poles
    ctx.fillStyle = '#5C3A1E';
    ctx.fillRect(bx - 4, awningY + 10, 3, 6);
    ctx.fillRect(bx + bw + 2, awningY + 10, 3, 6);
    
    // Stall counter/table at the front
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(bx + 2, by + bh - 8, bw - 4, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx + 2, by + bh - 8, bw - 4, 8);
    
    // Stall openings (where vendors stand)
    const stallCount = Math.floor(bw / ts);
    for (let i = 0; i < stallCount; i++) {
      const sx = bx + i * ts + ts / 2;
      // Hanging goods/produce indicator
      ctx.fillStyle = '#DAA520';
      ctx.fillRect(sx - 4, by + bh - 14, 8, 6);
    }
  }

  // ==================== TREE / VEGETATION RENDERING ====================

  private _renderTrees(ctx: CanvasRenderingContext2D): void {
    for (const tree of TREE_POSITIONS) {
      // Only render if within camera view
      const tx = tree.col * this.tileSize - this.cameraX;
      const ty = tree.row * this.tileSize - this.cameraY;
      
      if (tx < -80 || tx > this.viewWidth + 80 || ty < -80 || ty > this.viewHeight + 80) continue;
      
      this._renderSingleTree(ctx, tx + this.tileSize / 2, ty + this.tileSize / 2, tree.variant);
    }
  }

  private _renderSingleTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, variant: number): void {
    const ts = this.tileSize;
    
    // Tree shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + 6, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tree trunk
    const trunkColors = ['#5C3A1E', '#4A2A10', '#6B4422'];
    ctx.fillStyle = trunkColors[variant % trunkColors.length];
    ctx.fillRect(cx - 3, cy - 10, 6, 18);
    
    // Tree canopy (layered circles for natural look)
    const canopyColors = ['#4E7A3E', '#5C8B4E', '#3D6B2E'];
    const lightCanopyColors = ['#6B9E5E', '#7BAF6E', '#5C8B4E'];
    
    // Bottom layer (larger, darker)
    ctx.fillStyle = canopyColors[variant % canopyColors.length];
    ctx.beginPath();
    ctx.ellipse(cx, cy - 16, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Middle layer
    ctx.fillStyle = lightCanopyColors[variant % lightCanopyColors.length];
    ctx.beginPath();
    ctx.ellipse(cx - 3, cy - 20, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Top highlight
    ctx.fillStyle = '#8FD47F';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 24, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Subtle sway animation based on game time
    const sway = Math.sin(this.gameTime * 0.8 + variant * 2) * 1.5;
    // Draw a few animated leaf particles
    ctx.fillStyle = 'rgba(100,180,80,0.3)';
    ctx.beginPath();
    ctx.arc(cx + sway * 3, cy - 22, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ==================== FOUNTAIN / WELL ====================

  private _renderFountain(ctx: CanvasRenderingContext2D): void {
    // Fountain positioned at plaza center (rows 6-7, cols 8-10)
    const ts = this.tileSize;
    const centerX = (9 * ts + ts / 2) - this.cameraX;
    const centerY = (7 * ts + ts / 2) - this.cameraY;

    // Fountain shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(centerX + 4, centerY + 12, 36, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer stone basin (large oval)
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#A89B82';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 34, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner stone rim
    ctx.strokeStyle = '#6E5E44';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#4A8BA8';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 26, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Water surface — animated shimmer
    const shimmerPhase = this.gameTime * 2;
    ctx.fillStyle = '#3D7B99';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animated water ripple rings
    for (let ring = 0; ring < 3; ring++) {
      const ringPhase = shimmerPhase + ring * 1.5;
      const ringRadius = 6 + ring * 7 + Math.sin(ringPhase) * 3;
      const ringAlpha = 0.12 + Math.sin(ringPhase * 0.7) * 0.06;
      ctx.strokeStyle = `rgba(140,200,240,${ringAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + Math.sin(ringPhase) * 1.5, ringRadius, ringRadius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Water sparkle highlights (animated)
    for (let i = 0; i < 5; i++) {
      const sparkleAngle = shimmerPhase * 0.8 + i * 1.2;
      const sparkleDist = 10 + Math.sin(sparkleAngle) * 8;
      const sparkleX = centerX + Math.cos(sparkleAngle) * sparkleDist;
      const sparkleY = centerY + Math.sin(sparkleAngle) * sparkleDist * 0.6;
      const sparkleAlpha = 0.3 + Math.sin(shimmerPhase * 3 + i) * 0.2;
      ctx.fillStyle = `rgba(200,240,255,${sparkleAlpha})`;
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central pillar/column
    ctx.fillStyle = '#9E8E72';
    ctx.fillRect(centerX - 4, centerY - 30, 8, 28);
    // Pillar cap
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(centerX - 7, centerY - 32, 14, 5);

    // Water spout from pillar — animated dripping
    const spoutPhase = Math.sin(this.gameTime * 4);
    const spoutY = centerY - 28 + Math.abs(spoutPhase) * 6;
    ctx.fillStyle = `rgba(100,180,220,${0.4 + spoutPhase * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(centerX, spoutY, 5 + Math.sin(this.gameTime * 3) * 1.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Splash particles at water surface
    if (spoutPhase > 0.7) {
      for (let s = 0; s < 3; s++) {
        const splashX = centerX + Math.cos(this.gameTime * 5 + s * 2) * 8;
        const splashY = centerY + Math.sin(this.gameTime * 5 + s * 2) * 4;
        ctx.fillStyle = 'rgba(180,220,240,0.3)';
        ctx.beginPath();
        ctx.arc(splashX, splashY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Basin stone detail — small blocks around rim
    ctx.fillStyle = '#8B7355';
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      const bx = centerX + Math.cos(angle) * 34;
      const by = centerY + Math.sin(angle) * 22;
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ==================== MAP DECORATIONS ====================

  // Decoration positions for various props around the map
  private static DECORATIONS: { type: string; row: number; col: number; variant?: number }[] = [
    // Wooden benches near fountain (rows 8-9, near center)
    { type: 'bench', row: 8, col: 5, variant: 0 },
    { type: 'bench', row: 8, col: 12, variant: 1 },
    { type: 'bench', row: 5, col: 9, variant: 0 },
    // Cart near market
    { type: 'cart', row: 10, col: 2, variant: 0 },
    // Flagpole near church
    { type: 'flagpole', row: 3, col: 5, variant: 0 },
    // Flower boxes near building entrances
    { type: 'flowers', row: 4, col: 4, variant: 0 },
    { type: 'flowers', row: 4, col: 14, variant: 1 },
    // Barrel cluster near market
    { type: 'barrels', row: 12, col: 5, variant: 0 },
    // Lamp post in plaza
    { type: 'lamp', row: 7, col: 5, variant: 0 },
    { type: 'lamp', row: 7, col: 12, variant: 1 },
    // Well cover near church
    { type: 'wellcover', row: 3, col: 7, variant: 0 },
  ];

  private _renderMapDecorations(ctx: CanvasRenderingContext2D): void {
    const ts = this.tileSize;
    for (const deco of GameEngine.DECORATIONS) {
      const dx = deco.col * ts - this.cameraX + ts / 2;
      const dy = deco.row * ts - this.cameraY + ts / 2;

      // Only render if on screen
      if (dx < -60 || dx > this.viewWidth + 60 || dy < -60 || dy > this.viewHeight + 60) continue;

      switch (deco.type) {
        case 'bench': this._renderBench(ctx, dx, dy, deco.variant || 0); break;
        case 'cart': this._renderCart(ctx, dx, dy); break;
        case 'flagpole': this._renderFlagpole(ctx, dx, dy); break;
        case 'flowers': this._renderFlowerBox(ctx, dx, dy, deco.variant || 0); break;
        case 'barrels': this._renderBarrels(ctx, dx, dy); break;
        case 'lamp': this._renderLamp(ctx, dx, dy, deco.variant || 0); break;
        case 'wellcover': this._renderWellCover(ctx, dx, dy); break;
      }
    }
  }

  private _renderBench(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 8, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bench seat (wood plank)
    const woodColor = variant === 0 ? '#8B6914' : '#9B7923';
    ctx.fillStyle = woodColor;
    ctx.fillRect(x - 18, y - 4, 36, 6);
    // Seat highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x - 18, y - 4, 36, 2);

    // Bench legs (iron/wood supports)
    ctx.fillStyle = '#5C3A1E';
    ctx.fillRect(x - 16, y + 2, 4, 10);
    ctx.fillRect(x + 12, y + 2, 4, 10);
    // Cross beam between legs
    ctx.fillRect(x - 16, y + 6, 32, 2);
  }

  private _renderCart(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 10, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cart body (wood box)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 16, y - 10, 32, 16);
    // Cart rim
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 16, y - 10, 32, 16);
    // Cart interior visible produce
    ctx.fillStyle = '#DAA520';
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#CD853F';
    ctx.beginPath();
    ctx.arc(x + 6, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(x - 8, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Wheel (on the right side)
    ctx.strokeStyle = '#4A2A10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 18, y + 4, 8, 0, Math.PI * 2);
    ctx.stroke();
    // Wheel spokes
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + this.gameTime * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 4);
      ctx.lineTo(x + 18 + Math.cos(angle) * 7, y + 4 + Math.sin(angle) * 7);
      ctx.stroke();
    }
    // Wheel hub
    ctx.fillStyle = '#5C3A1E';
    ctx.beginPath();
    ctx.arc(x + 18, y + 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderFlagpole(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Pole shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pole shaft
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(x - 2, y - 40, 4, 44);

    // Pole base
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x - 6, y, 12, 4);

    // Flag at top — animated waving
    const waveOffset = Math.sin(this.gameTime * 3) * 3;
    ctx.fillStyle = '#CE1126'; // Philippine flag red
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 40);
    ctx.lineTo(x + 2 + 18 + waveOffset, y - 38 + waveOffset);
    ctx.lineTo(x + 2 + 16 + waveOffset * 0.7, y - 30 + waveOffset * 0.5);
    ctx.lineTo(x + 2, y - 32);
    ctx.closePath();
    ctx.fill();

    // Flag blue stripe
    ctx.fillStyle = '#0038A8';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 32);
    ctx.lineTo(x + 2 + 16 + waveOffset * 0.7, y - 30 + waveOffset * 0.5);
    ctx.lineTo(x + 2 + 14 + waveOffset * 0.5, y - 24 + waveOffset * 0.3);
    ctx.lineTo(x + 2, y - 24);
    ctx.closePath();
    ctx.fill();

    // Sun emblem on flag
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x + 10 + waveOffset * 0.5, y - 33, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderFlowerBox(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x - 10 + 2, y + 2, 20, 6);

    // Wooden box
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - 10, y - 4, 20, 8);
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 10, y - 4, 20, 8);

    // Flowers growing from box
    const flowerColors = variant === 0
      ? ['#FF6B6B', '#FFE066', '#FF6B6B', '#CC99FF', '#FF6B6B']
      : ['#FF9999', '#FFB347', '#FF9999', '#77DD77', '#FF9999'];
    for (let i = 0; i < 5; i++) {
      const fx = x - 8 + i * 4;
      const fy = y - 6 - (3 + Math.sin(this.gameTime * 2 + i) * 1);
      ctx.fillStyle = flowerColors[i];
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Stem
      ctx.strokeStyle = '#228B22';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(fx, fy + 2);
      ctx.lineTo(fx, y - 4);
      ctx.stroke();
    }
  }

  private _renderBarrels(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 6, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Barrel 1
    ctx.fillStyle = '#A0522D';
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 2, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6B4422';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 2, 8, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Barrel bands
    ctx.strokeStyle = '#8B8682';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 8, 7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - 4, y + 4, 7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Barrel 2 (smaller, slightly behind)
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 2, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 2, 6, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private _renderLamp(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
    // Lamp shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lamp pole
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(x - 2, y - 28, 4, 30);

    // Lamp base plate
    ctx.fillStyle = '#6E5E44';
    ctx.fillRect(x - 5, y + 2, 10, 2);

    // Lamp housing (top)
    ctx.fillStyle = '#5C5C5C';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 24);
    ctx.lineTo(x + 6, y - 24);
    ctx.lineTo(x + 4, y - 20);
    ctx.lineTo(x - 4, y - 20);
    ctx.closePath();
    ctx.fill();

    // Lamp light (warm glow)
    const glowPulse = 0.6 + Math.sin(this.gameTime * 2 + variant) * 0.15;
    if (this.timeOfDay === 'afternoon') {
      // Afternoon: dim warm light
      ctx.fillStyle = `rgba(255,200,100,${glowPulse * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Morning: brighter light needed
      ctx.fillStyle = `rgba(255,220,140,${glowPulse * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Light cone down
      ctx.fillStyle = `rgba(255,220,140,${glowPulse * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 20);
      ctx.lineTo(x + 8, y - 20);
      ctx.lineTo(x + 16, y + 4);
      ctx.lineTo(x - 16, y + 4);
      ctx.closePath();
      ctx.fill();
    }

    // Lamp flame
    ctx.fillStyle = '#FFE4B5';
    ctx.beginPath();
    ctx.arc(x, y - 22, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderWellCover(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Well rim (circular stone)
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#A89B82';
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Well wooden cover (half-cover)
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 4, 0, Math.PI, 0);
    ctx.fill();

    // Rope hanging from cover
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 2);
    ctx.lineTo(x + 4, y - 8);
    ctx.stroke();
  }

  // ==================== ATMOSPHERIC EFFECTS ====================

  private _renderMist(ctx: CanvasRenderingContext2D): void {
    // Subtle mist patches that drift slowly across the map
    const mistCount = 3;
    for (let i = 0; i < mistCount; i++) {
      // Mist position cycles slowly across the map
      const baseX = (this.gameTime * 15 + i * 400) % (this.viewWidth + 200) - 100;
      const baseY = 150 + i * 100 + Math.sin(this.gameTime * 0.3 + i) * 30;
      const mistWidth = 120 + Math.sin(this.gameTime * 0.5 + i * 2) * 30;
      const mistHeight = 40 + Math.sin(this.gameTime * 0.4 + i) * 10;
      const mistAlpha = 0.03 + Math.sin(this.gameTime * 0.6 + i) * 0.02;

      ctx.fillStyle = `rgba(200,220,240,${mistAlpha})`;
      ctx.beginPath();
      ctx.ellipse(baseX, baseY, mistWidth, mistHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      // Second layer for depth
      ctx.fillStyle = `rgba(180,200,220,${mistAlpha * 0.6})`;
      ctx.beginPath();
      ctx.ellipse(baseX + 20, baseY + 8, mistWidth * 0.7, mistHeight * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private _renderBirds(ctx: CanvasRenderingContext2D): void {
    // Occasional bird silhouettes that fly across the sky
    const birdCount = 2;
    for (let i = 0; i < birdCount; i++) {
      // Birds cycle from left to right across the screen
      const cycleTime = 25 + i * 10;
      const birdX = ((this.gameTime + i * 12) % cycleTime) / cycleTime * this.viewWidth;
      const birdY = 40 + i * 30 + Math.sin(this.gameTime * 1.5 + i * 5) * 20;
      
      // Wing animation
      const wingPhase = Math.sin(this.gameTime * 8 + i * 3);
      const wingSpread = 6 + wingPhase * 4;

      // Bird body
      ctx.fillStyle = 'rgba(40,40,40,0.5)';
      ctx.beginPath();
      ctx.arc(birdX, birdY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Wings (animated flapping)
      ctx.strokeStyle = 'rgba(40,40,40,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Left wing
      ctx.moveTo(birdX - 1, birdY);
      ctx.quadraticCurveTo(birdX - wingSpread, birdY - wingSpread * 0.5, birdX - wingSpread - 2, birdY + wingPhase * 2);
      // Right wing
      ctx.moveTo(birdX + 1, birdY);
      ctx.quadraticCurveTo(birdX + wingSpread, birdY - wingSpread * 0.5, birdX + wingSpread + 2, birdY + wingPhase * 2);
      ctx.stroke();
    }
  }

  // ==================== BUILDING LABELS ====================

  private _renderBuildingLabels(ctx: CanvasRenderingContext2D): void {
    if (!this.player) return;

    for (const label of mapData.buildingLabels) {
      const centerX = (label.col + label.width / 2) * this.tileSize - this.cameraX;
      // Position labels well above the building (room for roof + cross + awning)
      const topY = label.row * this.tileSize - this.cameraY - 46;

      // Compute distance from player to building center (in tile units)
      const buildingCenterX = (label.col + label.width / 2) * this.tileSize + this.tileSize / 2;
      const buildingCenterY = (label.row + label.height / 2) * this.tileSize + this.tileSize / 2;
      const dx = this.player.x - buildingCenterX;
      const dy = this.player.y - buildingCenterY;
      const distTiles = Math.sqrt(dx * dx + dy * dy) / this.tileSize;

      // Fade out the label as the player approaches the building
      // (so it doesn't overlap with NPC name tags rendered by NPCLabelOverlay)
      // Full opacity at distTiles >= 7, fully hidden at distTiles <= 4
      const FADE_NEAR = 4;
      const FADE_FAR = 7;
      let labelAlpha = 1;
      if (distTiles <= FADE_NEAR) {
        labelAlpha = 0;
      } else if (distTiles < FADE_FAR) {
        labelAlpha = (distTiles - FADE_NEAR) / (FADE_FAR - FADE_NEAR);
        // Smooth ease-in-out
        labelAlpha = labelAlpha * labelAlpha * (3 - 2 * labelAlpha);
      }

      if (labelAlpha < 0.02) continue; // Skip rendering if essentially invisible

      ctx.save();
      ctx.globalAlpha = labelAlpha;

      // Measure text dimensions for panel sizing
      ctx.font = 'bold 13px "Geist", sans-serif';
      const mainTextWidth = ctx.measureText(label.label).width;
      ctx.font = '10px "Geist", sans-serif';
      const subTextWidth = label.sublabel ? ctx.measureText(label.sublabel).width : 0;
      const maxWidth = Math.max(mainTextWidth, subTextWidth);

      // Signage panel background
      const panelW = maxWidth + 24;
      const panelH = label.sublabel ? 36 : 22;
      const panelX = centerX - panelW / 2;
      const panelY = topY - 2;

      // Connecting line from panel to building roof (dashed)
      ctx.strokeStyle = 'rgba(139,115,85,0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(centerX, panelY + panelH);
      ctx.lineTo(centerX, label.row * this.tileSize - this.cameraY - 4);
      ctx.stroke();
      ctx.setLineDash([]);

      // Panel shadow — soft, low-opacity, only 1px offset for a subtle drop
      // (was 0.35 at +2,+2 — too prominent, looked like a black rectangle)
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(panelX + 1, panelY + 1, panelW, panelH);

      // Panel background (warm parchment color)
      ctx.fillStyle = '#F5E6C8';
      ctx.fillRect(panelX, panelY, panelW, panelH);

      // Panel border
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      // Panel inner border (decorative double border)
      ctx.strokeStyle = 'rgba(139,115,85,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(panelX + 3, panelY + 3, panelW - 6, panelH - 6);

      // Soft golden glow halo (radial, more elegant than flat rect)
      const glowGrad = ctx.createRadialGradient(
        centerX, topY + panelH / 2, 0,
        centerX, topY + panelH / 2, panelW * 0.9
      );
      glowGrad.addColorStop(0, 'rgba(255,215,0,0.18)');
      glowGrad.addColorStop(0.5, 'rgba(255,215,0,0.05)');
      glowGrad.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(panelX - 8, panelY - 8, panelW + 16, panelH + 16);

      // Main label text
      ctx.font = 'bold 13px "Geist", sans-serif';
      ctx.fillStyle = '#3A2A1A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (label.sublabel) {
        ctx.fillText(label.label, centerX, topY + 8);
        ctx.font = '10px "Geist", sans-serif';
        ctx.fillStyle = '#6B5A4A';
        ctx.fillText(label.sublabel, centerX, topY + 22);
      } else {
        ctx.fillText(label.label, centerX, topY + 9);
      }
      ctx.textBaseline = 'alphabetic';

      // Small decorative corner marks
      ctx.fillStyle = '#8B7355';
      const cornerSize = 4;
      // Top-left corner
      ctx.fillRect(panelX + 1, panelY + 1, cornerSize, 1);
      ctx.fillRect(panelX + 1, panelY + 1, 1, cornerSize);
      // Top-right corner
      ctx.fillRect(panelX + panelW - cornerSize - 1, panelY + 1, cornerSize, 1);
      ctx.fillRect(panelX + panelW - 2, panelY + 1, 1, cornerSize);
      // Bottom-left corner
      ctx.fillRect(panelX + 1, panelY + panelH - 2, cornerSize, 1);
      ctx.fillRect(panelX + 1, panelY + panelH - cornerSize - 1, 1, cornerSize);
      // Bottom-right corner
      ctx.fillRect(panelX + panelW - cornerSize - 1, panelY + panelH - 2, cornerSize, 1);
      ctx.fillRect(panelX + panelW - 2, panelY + panelH - cornerSize - 1, 1, cornerSize);

      ctx.restore();
    }
  }

  // ==================== ENTITY RENDERING ====================

  private _renderEntity(ctx: CanvasRenderingContext2D, entity: Entity): void {
    const screenX = entity.x - this.cameraX;
    const screenY = entity.y - this.cameraY;

    // Don't render if off screen
    if (screenX < -150 || screenX > this.viewWidth + 150 || 
        screenY < -150 || screenY > this.viewHeight + 150) return;

    const anim = entity.isMoving ? 'Walk' : 'Breathing_Idle';
    const dir = entity.direction;
    const frame = entity.animationFrame;

    const sprite = spriteLoader.getFrame(entity.characterKey, anim, dir, frame);
    
    if (sprite) {
      // Center the sprite on the entity position
      const spriteW = sprite.width || characterData.characters[entity.characterKey as keyof typeof characterData.characters]?.size?.width || 72;
      const spriteH = sprite.height || characterData.characters[entity.characterKey as keyof typeof characterData.characters]?.size?.height || 72;
      
      // Scale sprites up for visibility (3x scale for better visibility)
      const scale = 3;
      const drawW = spriteW * scale;
      const drawH = spriteH * scale;
      
      // Entity shadow (semi-transparent dark oval on the ground)
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + drawH * 0.25, drawW * 0.35, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Player character subtle highlight/outline
      if (entity.isPlayer) {
        // Soft glow around player
        ctx.fillStyle = 'rgba(255,220,100,0.08)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, drawW * 0.6, drawH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Subtle outline stroke
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        // Draw sprite with a slight offset outline for border effect
        ctx.strokeStyle = 'rgba(255,200,80,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY - drawH * 0.15, drawW * 0.4, drawH * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      
      // Draw the sprite
      ctx.drawImage(sprite, screenX - drawW / 2, screenY - drawH / 2, drawW, drawH);
    }

    // Entity name label (not for player)
    if (!entity.isPlayer) {
      const displayName = characterData.characters[entity.characterKey as keyof typeof characterData.characters]?.displayName || entity.characterKey;
      
      // Calculate name Y position, avoiding overlap with building labels
      let nameY = screenY - 75;
      
      // Check if this entity is inside/near a building label area — if so, push name further up
      for (const bl of mapData.buildingLabels) {
        const blWorldX = (bl.col + bl.width / 2) * this.tileSize;
        const blWorldY = bl.row * this.tileSize - 46;
        const blScreenX = blWorldX - this.cameraX;
        const blScreenY = blWorldY - this.cameraY;
        const blPanelH = bl.sublabel ? 36 : 22;
        // If the entity name position overlaps with the building label panel
        const nameOverlapX = Math.abs(screenX - blScreenX) < 100;
        const nameOverlapY = nameY >= blScreenY - 2 && nameY <= blScreenY + blPanelH + 20;
        if (nameOverlapX && nameOverlapY) {
          // Push name label further above the building label
          nameY = blScreenY - 24;
        }
      }
      
      // Name background panel with rounded corners
      ctx.font = '11px "Geist", sans-serif';
      const nameWidth = ctx.measureText(displayName).width;
      const nameX = screenX;
      
      // Rounded rect background panel
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(nameX - nameWidth / 2 - 8, nameY - 12, nameWidth + 16, 18, 4);
      ctx.fill();
      
      // Subtle accent line at top
      ctx.fillStyle = entity.isPlayer ? 'rgba(255,200,80,0.5)' : 'rgba(180,180,180,0.3)';
      ctx.fillRect(nameX - nameWidth / 2 - 8, nameY - 12, nameWidth + 16, 1.5);
      
      // Name text
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayName, nameX, nameY - 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ==================== INTERACTION INDICATORS ====================

  private _renderInteractionIndicators(ctx: CanvasRenderingContext2D): void {
    if (!this.player) return;
    
    for (const [npcId, npc] of this.entities) {
      if (npc.isPlayer || !npc.visible) continue;
      
      const dist = this._distanceBetween(this.player, npc);
      if (dist < this.tileSize * 2 && !this.dialogueActive) {
        const screenX = npc.x - this.cameraX;
        const screenY = npc.y - this.cameraY;
        
        // Pulsing glow effect
        const pulse = Math.sin(this.gameTime * 4) * 0.3 + 0.7;
        const glowSize = 18 + Math.sin(this.gameTime * 3) * 4;
        
        // Outer glow ring
        ctx.fillStyle = `rgba(255,215,0,${0.15 * pulse})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY - 65, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner glow
        ctx.fillStyle = `rgba(255,230,100,${0.25 * pulse})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY - 65, glowSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // "!" indicator with bounce
        const bounceY = Math.sin(this.gameTime * 3) * 5;
        ctx.font = 'bold 22px "Geist", sans-serif';
        ctx.fillStyle = `rgba(255,215,0,${pulse})`;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2.5;
        ctx.textAlign = 'center';
        ctx.strokeText('!', screenX, screenY - 65 + bounceY);
        ctx.fillText('!', screenX, screenY - 65 + bounceY);
        
        // "Press Space" hint panel with rounded corners
        ctx.font = '9px "Geist", sans-serif';
        const hintText = '[Space]';
        const hintWidth = ctx.measureText(hintText).width;
        const hintY = screenY - 50 + bounceY;
        
        // Rounded hint panel background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(screenX - hintWidth / 2 - 6, hintY - 9, hintWidth + 12, 16, 3);
        ctx.fill();
        
        // Accent line at bottom
        ctx.fillStyle = `rgba(255,215,0,${pulse * 0.4})`;
        ctx.fillRect(screenX - hintWidth / 2 - 6, hintY + 5, hintWidth + 12, 1);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hintText, screenX, hintY - 1);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  // ==================== TRIGGER HINTS ====================

  private _renderTriggerHints(ctx: CanvasRenderingContext2D): void {
    // Subtle visual hint for the gossip area — golden shimmer with sparkle particles.
    // NOTE: No rectangular border drawn — it can visually overlap with the
    // Market building label and NPC name tags, making the area feel cluttered.
    // Instead we use floating sparkle particles + a soft radial glow.
    const gossipZone = this.triggerZones.find(z => z.id === 'market-gossip');
    if (gossipZone && !gossipZone.triggered && saveManager.isObjectiveCompleted(gossipZone.requiresObjective || '')) {
      const x = gossipZone.col * this.tileSize - this.cameraX;
      const y = gossipZone.row * this.tileSize - this.cameraY;
      const w = gossipZone.width * this.tileSize;
      const h = gossipZone.height * this.tileSize;
      const centerX = x + w / 2;
      const centerY = y + h / 2;

      // Soft radial golden glow centered on the zone (very subtle)
      const glowRadius = Math.max(w, h) * 0.75;
      const glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
      const pulse = Math.sin(this.gameTime * 2) * 0.04 + 0.08;
      glowGrad.addColorStop(0, `rgba(255,215,0,${pulse})`);
      glowGrad.addColorStop(0.5, `rgba(255,215,0,${pulse * 0.4})`);
      glowGrad.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x - 24, y - 24, w + 48, h + 48);

      // Floating sparkle particles within the zone
      for (let i = 0; i < 8; i++) {
        const sparkX = x + tileHash(gossipZone.row, gossipZone.col, i * 40 + 500) * w;
        const sparkY = y + tileHash(gossipZone.row, gossipZone.col, i * 40 + 600) * h;
        const sparkPhase = Math.sin(this.gameTime * 3 + i * 1.5);
        const sparkAlpha = Math.max(0, sparkPhase * 0.4);
        if (sparkAlpha > 0) {
          // Glow halo
          ctx.fillStyle = `rgba(255,215,0,${sparkAlpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, 4 + sparkPhase * 1.5, 0, Math.PI * 2);
          ctx.fill();
          // Bright core
          ctx.fillStyle = `rgba(255,240,180,${sparkAlpha})`;
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, 1.5 + sparkPhase * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    // Subtle hint for Ibarra sighting zone
    const ibarraZone = this.triggerZones.find(z => z.id === 'ibarra-sighting');
    if (ibarraZone && !ibarraZone.triggered && saveManager.isObjectiveCompleted(ibarraZone.requiresObjective || '')) {
      const x = ibarraZone.col * this.tileSize - this.cameraX;
      const y = ibarraZone.row * this.tileSize - this.cameraY;
      const w = ibarraZone.width * this.tileSize;
      const h = ibarraZone.height * this.tileSize;
      
      // Silvery moonlight shimmer (since this happens at morning/dawn)
      const shimmer = Math.sin(this.gameTime * 2) * 0.04 + 0.06;
      ctx.fillStyle = `rgba(180,200,240,${shimmer})`;
      ctx.fillRect(x, y, w, h);
    }
  }

  // ==================== ATMOSPHERE EFFECTS ====================

  private _renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const screenX = p.x - this.cameraX;
      const screenY = p.y - this.cameraY;
      
      // Skip if off screen
      if (screenX < -10 || screenX > this.viewWidth + 10 || screenY < -10 || screenY > this.viewHeight + 10) continue;
      
      // Dust mote - small warm-colored circle
      const warmAlpha = this.timeOfDay === 'afternoon' ? p.alpha : p.alpha * 0.6;
      ctx.fillStyle = this.timeOfDay === 'afternoon' 
        ? `rgba(255,220,180,${warmAlpha})`
        : `rgba(200,220,255,${warmAlpha})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private _renderTimeOfDayOverlay(ctx: CanvasRenderingContext2D): void {
    // Subtle but distinct color overlay based on time of day
    // Afternoon = warm golden hour with soft amber glow
    // Morning = cool blue dawn with misty atmosphere
    if (this.timeOfDay === 'afternoon') {
      // Warm golden tint across the whole scene
      ctx.fillStyle = 'rgba(255,180,80,0.10)';
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      
      // Stronger warm glow at the top-right (sun position)
      const sunGrad = ctx.createRadialGradient(
        this.viewWidth * 0.85, this.viewHeight * 0.15, 0,
        this.viewWidth * 0.85, this.viewHeight * 0.15, this.viewWidth * 0.6
      );
      sunGrad.addColorStop(0, 'rgba(255,220,150,0.18)');
      sunGrad.addColorStop(0.4, 'rgba(255,200,100,0.08)');
      sunGrad.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    } else {
      // Cool blue morning tint
      ctx.fillStyle = 'rgba(180,210,250,0.12)';
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      
      // Soft misty gradient at the bottom (atmospheric depth)
      const mistGrad = ctx.createLinearGradient(0, this.viewHeight * 0.6, 0, this.viewHeight);
      mistGrad.addColorStop(0, 'rgba(220,230,240,0)');
      mistGrad.addColorStop(0.6, 'rgba(220,230,240,0.08)');
      mistGrad.addColorStop(1, 'rgba(200,220,240,0.18)');
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      
      // Soft dawn glow on the left (sunrise)
      const dawnGrad = ctx.createRadialGradient(
        this.viewWidth * 0.15, this.viewHeight * 0.2, 0,
        this.viewWidth * 0.15, this.viewHeight * 0.2, this.viewWidth * 0.5
      );
      dawnGrad.addColorStop(0, 'rgba(255,220,200,0.12)');
      dawnGrad.addColorStop(0.5, 'rgba(200,220,250,0.05)');
      dawnGrad.addColorStop(1, 'rgba(180,210,250,0)');
      ctx.fillStyle = dawnGrad;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }
  }

  private _renderVignette(ctx: CanvasRenderingContext2D): void {
    // Radial gradient vignette - dark edges, clear center
    const gradient = ctx.createRadialGradient(
      this.viewWidth / 2, this.viewHeight / 2, this.viewHeight * 0.35,
      this.viewWidth / 2, this.viewHeight / 2, this.viewHeight * 0.85
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.05)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.25)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    saveManager.stopAutoSave();
    window.removeEventListener('keydown', this._bindInput);
    window.removeEventListener('keyup', this._bindInput);
  }

  // Public getters for UI
  getPlayer(): Entity | null { return this.player; }
  getEntities(): Map<string, Entity> { return this.entities; }
  getChapterPhase(): string { return this.chapterPhase; }
  getTimeOfDay(): string { return this.timeOfDay; }
  isDialogueActive(): boolean { return this.dialogueActive; }
  getCurrentDialogueId(): string | null { return this.currentDialogueId; }
}

export const gameEngine = new GameEngine();
export default GameEngine;
export type { Entity, Direction };

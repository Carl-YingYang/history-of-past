// GameEngine - Core game loop, Canvas rendering, input handling, and scene management
// Pokémon Gen 3 (GBA) style 2D top-down pixel art RPG engine for Project Noor
// Rewritten with tile-based rendering, grid movement, sprite sheets, and Y-sorting

import { gameEvents } from './eventBus';
import { spriteLoader } from './spriteLoader';
import { assetManager } from './assetManager';
import { saveManager } from './saveManager';
import { soundManager } from './soundManager';
import mapData from '@/data/mapData.json';
import dialogueData from '@/data/dialogueData.json';
import characterData from '@/data/characters.json';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const INTERNAL_WIDTH = 480;
const INTERNAL_HEIGHT = 320;
const TILE_SIZE = 24;            // Internal pixels per tile (48/2 for 2× scale)
const DISPLAY_TILE_SIZE = 48;    // Display pixels per tile
const SLIDE_DURATION = 150;      // ms to slide between tiles
const SLIDE_PAUSE = 50;          // ms pause between consecutive tiles when key held
const IDLE_ANIM_RATE = 300;      // ms between idle animation frames
const WALK_ANIM_RATE = 100;      // ms between walk animation frames
const CAMERA_LERP = 0.12;        // Camera smoothing factor (0 = no follow, 1 = instant)
const NPC_INTERACT_DIST = 1.5;   // Tile distance to interact with NPC
const CHAR_RENDER_SIZE = 32;     // Character render size in internal pixels

// 4-direction movement
type Direction4 = 'north' | 'south' | 'east' | 'west';

const DIR_OFFSET: Record<Direction4, { dr: number; dc: number }> = {
  north: { dr: -1, dc: 0 },
  south: { dr: 1, dc: 0 },
  east:  { dr: 0, dc: 1 },
  west:  { dr: 0, dc: -1 },
};

// Direction to facing string for sprite lookup
const DIR_TO_FACING: Record<Direction4, string> = {
  north: 'north',
  south: 'south',
  east: 'east',
  west: 'west',
};

// Key to direction mapping
const KEY_TO_DIR: Record<string, Direction4> = {
  'w': 'north', 'arrowup': 'north',
  's': 'south', 'arrowdown': 'south',
  'd': 'east',  'arrowright': 'east',
  'a': 'west',  'arrowleft': 'west',
};

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

interface PlayerState {
  row: number;           // Current tile row
  col: number;           // Current tile col
  facing: Direction4;    // Current facing direction
  isSliding: boolean;    // Whether currently sliding between tiles
  slideStart: number;    // Timestamp when slide started
  slideFromRow: number;  // Row we're sliding from
  slideFromCol: number;  // Col we're sliding from
  slideToRow: number;    // Row we're sliding to
  slideToCol: number;    // Col we're sliding to
  pixelX: number;        // Current render pixel X (internal coords)
  pixelY: number;        // Current render pixel Y (internal coords)
  animFrame: number;     // Current animation frame index
  animTimer: number;     // Time accumulator for animation
  bufferedDir: Direction4 | null;  // Buffered next direction during slide
  lastMoveTime: number;  // Timestamp of last completed move
}

interface NPCState {
  id: string;
  characterKey: string;
  row: number;
  col: number;
  facing: Direction4;
  visible: boolean;
  appearsAfterObjective?: string;
  spriteSheet?: string;
  animFrame: number;
  animTimer: number;
  displayName: string;
  // Pixel position for rendering (computed from tile position)
  pixelX: number;
  pixelY: number;
}

interface PropState {
  key: string;
  row: number;
  col: number;
  width: number;
  height: number;
  spriteWidth: number;
  spriteHeight: number;
  solid: boolean;
}

interface BuildingState {
  key: string;
  row: number;
  col: number;
  width: number;
  height: number;
  spriteWidth: number;
  spriteHeight: number;
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

interface CameraState {
  x: number;   // Top-left corner X in internal pixels
  y: number;   // Top-left corner Y in internal pixels
  targetX: number;
  targetY: number;
}

interface DialogueState {
  active: boolean;
  dialogueId: string | null;
  lines: DialogueLine[];
  currentLineIndex: number;
  npcId: string | null;
  triggered: boolean;
}

interface DialogueLine {
  speaker: string;
  text: string;
  translation?: string;
  isTimeTransition?: boolean;
  isIbarraSighting?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// GAME ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════

class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private running: boolean = false;
  private initialized: boolean = false;

  // Offscreen buffer for internal resolution rendering
  private offscreen: HTMLCanvasElement | null = null;
  private offCtx: CanvasRenderingContext2D | null = null;

  // Game state
  private player: PlayerState;
  private npcs: NPCState[] = [];
  private props: PropState[] = [];
  private buildings: BuildingState[] = [];
  private triggerZones: TriggerZone[] = [];
  private camera: CameraState;
  private dialogue: DialogueState;

  // Input state
  private keysDown: Set<string> = new Set();
  private interactPressed: boolean = false;
  private touchDir: Direction4 | null = null;

  // Map data references
  private groundLayer: number[][] = [];
  private buildingsLayer: number[][] = [];
  private collisionLayer: number[][] = [];
  private overlayLayer: number[][] = [];
  private mapWidth: number = 40;
  private mapHeight: number = 30;

  // Footstep sound throttle
  private lastFootstepTime: number = 0;
  private readonly FOOTSTEP_INTERVAL = 400;

  // Market ambient proximity tracking
  private wasNearMarket: boolean = false;

  // NPC interaction tracking for relationship depth
  private npcInteractionCounts: Record<string, number> = {};

  constructor() {
    this.player = this._createDefaultPlayer();
    this.camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.dialogue = {
      active: false,
      dialogueId: null,
      lines: [],
      currentLineIndex: 0,
      npcId: null,
      triggered: false,
    };
  }

  private _createDefaultPlayer(): PlayerState {
    const spawn = mapData.playerSpawn as { row: number; col: number };
    return {
      row: spawn.row,
      col: spawn.col,
      facing: 'north',
      isSliding: false,
      slideStart: 0,
      slideFromRow: spawn.row,
      slideFromCol: spawn.col,
      slideToRow: spawn.row,
      slideToCol: spawn.col,
      pixelX: spawn.col * TILE_SIZE,
      pixelY: spawn.row * TILE_SIZE,
      animFrame: 0,
      animTimer: 0,
      bufferedDir: null,
      lastMoveTime: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    // Set canvas to internal resolution
    canvas.width = INTERNAL_WIDTH;
    canvas.height = INTERNAL_HEIGHT;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    // Create offscreen buffer (same internal resolution)
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = INTERNAL_WIDTH;
    this.offscreen.height = INTERNAL_HEIGHT;
    this.offCtx = this.offscreen.getContext('2d')!;
    this.offCtx.imageSmoothingEnabled = false;

    // Load all assets via assetManager
    await assetManager.loadAll();

    // Load character sprites via spriteLoader
    await spriteLoader.loadCharacter('student');
    await spriteLoader.loadCharacter('ibara');

    // Load save data
    await saveManager.loadProgress();
    saveManager.startAutoSave();

    // Parse map data
    this._parseMapData();

    // Parse NPC positions from mapData
    this._parseNPCData();

    // Parse buildings and props
    this._parseBuildingsAndProps();

    // Parse trigger zones
    this._parseTriggerZones();

    // Load NPC interaction counts from localStorage
    this._loadNpcInteractions();

    // Initialize player position from save data if available
    this._initPlayerFromSave();

    // Set up input listeners
    this._setupInputListeners();

    // Initialize camera to center on player
    this._snapCameraToPlayer();

    // Start game loop
    this.running = true;
    this.lastTime = performance.now();
    this._gameLoop(this.lastTime);

    this.initialized = true;
    gameEvents.emit('game:ready');

    // Start ambient sounds
    soundManager.initOnUserGesture();
  }

  destroy(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this._removeInputListeners();
    saveManager.stopAutoSave();
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAP DATA PARSING
  // ═══════════════════════════════════════════════════════════════════

  private _parseMapData(): void {
    const layers = mapData.layers as any;
    this.groundLayer = layers.ground;
    this.buildingsLayer = layers.buildings;
    this.collisionLayer = layers.collision;
    this.overlayLayer = layers.overlay || Array.from({ length: mapData.height }, () => Array(mapData.width).fill(0));
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;
  }

  private _parseNPCData(): void {
    this.npcs = [];
    const npcPositions = mapData.npcPositions as Record<string, any>;
    for (const [id, pos] of Object.entries(npcPositions)) {
      const charKey = id;
      const charConfig = (characterData.characters as any)[charKey] || (characterData.characters as any)[id];
      const displayName = charConfig?.displayName || id;

      // Check visibility condition
      let visible = true;
      if (pos.appearsAfter) {
        visible = saveManager.isObjectiveCompleted(pos.appearsAfter);
      }

      const row = pos.row as number;
      const col = pos.col as number;

      this.npcs.push({
        id,
        characterKey: charKey,
        row,
        col,
        facing: this._toDirection4(pos.direction as string),
        visible,
        appearsAfterObjective: pos.appearsAfter,
        spriteSheet: pos.spriteSheet || charConfig?.spriteSheet,
        animFrame: 0,
        animTimer: 0,
        displayName,
        pixelX: col * TILE_SIZE,
        pixelY: row * TILE_SIZE,
      });
    }
  }

  private _parseBuildingsAndProps(): void {
    // Parse buildings from mapData
    this.buildings = [];
    const buildingsData = mapData.buildings as any[];
    if (buildingsData) {
      for (const b of buildingsData) {
        this.buildings.push({
          key: b.key,
          row: b.row,
          col: b.col,
          width: b.width,
          height: b.height,
          spriteWidth: b.spriteWidth || b.width * DISPLAY_TILE_SIZE,
          spriteHeight: b.spriteHeight || b.height * DISPLAY_TILE_SIZE,
        });
      }
    }

    // Parse props from mapData
    this.props = [];
    const propsData = mapData.props as any[];
    if (propsData) {
      for (const p of propsData) {
        this.props.push({
          key: p.key,
          row: p.row,
          col: p.col,
          width: p.width,
          height: p.height,
          spriteWidth: p.spriteWidth || p.width * DISPLAY_TILE_SIZE,
          spriteHeight: p.spriteHeight || p.height * DISPLAY_TILE_SIZE,
          solid: p.solid !== undefined ? p.solid : true,
        });
      }
    }
  }

  private _parseTriggerZones(): void {
    this.triggerZones = [];
    const zones = mapData.triggerZones as any[];
    if (zones) {
      for (const z of zones) {
        this.triggerZones.push({
          id: z.id,
          type: z.type,
          npcId: z.npcId,
          row: z.row,
          col: z.col,
          width: z.width,
          height: z.height,
          radius: z.radius,
          requiresObjective: z.requiresObjective,
          triggersTimeTransition: z.triggersTimeTransition,
          dialogueId: z.dialogueId,
          triggered: false,
        });
      }
    }
  }

  private _initPlayerFromSave(): void {
    const saveData = saveManager.getSaveData();
    if (saveData.gameState.playerPosition) {
      const pos = saveData.gameState.playerPosition;
      // Validate position is within map and walkable
      if (pos.row >= 0 && pos.row < this.mapHeight &&
          pos.col >= 0 && pos.col < this.mapWidth &&
          !this._isCollision(pos.row, pos.col)) {
        this.player.row = pos.row;
        this.player.col = pos.col;
      }
    }
    // Recalculate pixel position
    this.player.pixelX = this.player.col * TILE_SIZE;
    this.player.pixelY = this.player.row * TILE_SIZE;
    this.player.slideFromRow = this.player.row;
    this.player.slideFromCol = this.player.col;
    this.player.slideToRow = this.player.row;
    this.player.slideToCol = this.player.col;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════════

  private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  private _setupInputListeners(): void {
    this._keydownHandler = (e: KeyboardEvent) => this._onKeyDown(e);
    this._keyupHandler = (e: KeyboardEvent) => this._onKeyUp(e);
    window.addEventListener('keydown', this._keydownHandler);
    window.addEventListener('keyup', this._keyupHandler);
  }

  private _removeInputListeners(): void {
    if (this._keydownHandler) window.removeEventListener('keydown', this._keydownHandler);
    if (this._keyupHandler) window.removeEventListener('keyup', this._keyupHandler);
  }

  private _onKeyDown(e: KeyboardEvent): void {
    // Ignore input when focus is in text fields
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    const key = e.key.toLowerCase();

    // Prevent default for game keys (stop page scrolling)
    if (KEY_TO_DIR[key] || key === ' ' || key === 'enter') {
      e.preventDefault();
    }

    this.keysDown.add(key);

    // Interaction key (Space/Enter)
    if (key === ' ' || key === 'enter') {
      if (!this.interactPressed) {
        this.interactPressed = true;
        this._handleInteract();
      }
    }
  }

  private _onKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.keysDown.delete(key);

    if (key === ' ' || key === 'enter') {
      this.interactPressed = false;
    }
  }

  // Touch / external controls
  setMoveDirection(dir: 'up' | 'down' | 'left' | 'right' | null): void {
    if (!dir) {
      this.touchDir = null;
      return;
    }
    const mapping: Record<string, Direction4> = {
      up: 'north', down: 'south', left: 'west', right: 'east'
    };
    this.touchDir = mapping[dir] || null;
  }

  triggerInteract(): void {
    this._handleInteract();
  }

  // ═══════════════════════════════════════════════════════════════════
  // MOVEMENT SYSTEM (Pokémon Grid Movement)
  // ═══════════════════════════════════════════════════════════════════

  private _getDesiredDirection(): Direction4 | null {
    // Check keyboard keys
    for (const key of this.keysDown) {
      const dir = KEY_TO_DIR[key];
      if (dir) return dir;
    }
    // Check touch direction
    return this.touchDir;
  }

  private _tryMove(dir: Direction4, now: number): void {
    // Update facing direction immediately
    this.player.facing = dir;

    if (this.player.isSliding) {
      // Buffer the direction for when slide completes
      this.player.bufferedDir = dir;
      return;
    }

    // Check pause between moves
    if (now - this.player.lastMoveTime < SLIDE_PAUSE) return;

    // Calculate target tile
    const offset = DIR_OFFSET[dir];
    const targetRow = this.player.row + offset.dr;
    const targetCol = this.player.col + offset.dc;

    // Check bounds
    if (targetRow < 0 || targetRow >= this.mapHeight || targetCol < 0 || targetCol >= this.mapWidth) return;

    // Check collision
    if (this._isCollision(targetRow, targetCol)) return;

    // Check if NPC occupies target tile
    if (this._isNpcAtTile(targetRow, targetCol)) return;

    // Check if prop occupies target tile
    if (this._isPropAtTile(targetRow, targetCol)) return;

    // Start sliding
    this.player.isSliding = true;
    this.player.slideStart = now;
    this.player.slideFromRow = this.player.row;
    this.player.slideFromCol = this.player.col;
    this.player.slideToRow = targetRow;
    this.player.slideToCol = targetCol;
    this.player.bufferedDir = null;

    // Play footstep sound
    if (now - this.lastFootstepTime > this.FOOTSTEP_INTERVAL) {
      soundManager.playFootstep();
      this.lastFootstepTime = now;
    }
  }

  private _updateMovement(now: number, dt: number): void {
    if (this.dialogue.active) return; // No movement during dialogue

    // Process desired direction
    const desired = this._getDesiredDirection();
    if (desired) {
      this._tryMove(desired, now);
    }

    // Update slide interpolation
    if (this.player.isSliding) {
      const elapsed = now - this.player.slideStart;
      const t = Math.min(1, elapsed / SLIDE_DURATION);

      // Interpolate pixel position
      const fromX = this.player.slideFromCol * TILE_SIZE;
      const fromY = this.player.slideFromRow * TILE_SIZE;
      const toX = this.player.slideToCol * TILE_SIZE;
      const toY = this.player.slideToRow * TILE_SIZE;

      this.player.pixelX = fromX + (toX - fromX) * t;
      this.player.pixelY = fromY + (toY - fromY) * t;

      // Update walk animation
      this.player.animTimer += dt;
      if (this.player.animTimer >= WALK_ANIM_RATE) {
        this.player.animTimer -= WALK_ANIM_RATE;
        this.player.animFrame++;
      }

      // Check if slide is complete
      if (t >= 1) {
        this.player.isSliding = false;
        this.player.row = this.player.slideToRow;
        this.player.col = this.player.slideToCol;
        this.player.pixelX = this.player.col * TILE_SIZE;
        this.player.pixelY = this.player.row * TILE_SIZE;
        this.player.lastMoveTime = now;

        // Emit player:move event
        gameEvents.emit('player:move', { row: this.player.row, col: this.player.col });

        // Update save state
        saveManager.updateGameState({
          playerPosition: { row: this.player.row, col: this.player.col },
          playerDirection: this.player.facing,
        });

        // Check trigger zones
        this._checkTriggerZones(now);

        // Process buffered direction
        if (this.player.bufferedDir) {
          const bufDir = this.player.bufferedDir;
          this.player.bufferedDir = null;
          this._tryMove(bufDir, now);
        } else {
          // Switch to idle
          this.player.animFrame = 0;
          this.player.animTimer = 0;
        }
      }
    } else {
      // Idle animation
      this.player.animTimer += dt;
      if (this.player.animTimer >= IDLE_ANIM_RATE) {
        this.player.animTimer -= IDLE_ANIM_RATE;
        this.player.animFrame++;
      }

      // Snap pixel position to tile (safety)
      this.player.pixelX = this.player.col * TILE_SIZE;
      this.player.pixelY = this.player.row * TILE_SIZE;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // COLLISION SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  private _isCollision(row: number, col: number): boolean {
    if (row < 0 || row >= this.mapHeight || col < 0 || col >= this.mapWidth) return true;
    return this.collisionLayer[row]?.[col] === 1;
  }

  private _isNpcAtTile(row: number, col: number): boolean {
    return this.npcs.some(npc => npc.visible && npc.row === row && npc.col === col);
  }

  private _isPropAtTile(row: number, col: number): boolean {
    for (const prop of this.props) {
      if (!prop.solid) continue; // Skip non-solid (decorative) props
      if (row >= prop.row && row < prop.row + prop.height &&
          col >= prop.col && col < prop.col + prop.width) {
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CAMERA SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  private _updateCamera(): void {
    // Camera target: center on player
    const playerCenterX = this.player.pixelX + TILE_SIZE / 2;
    const playerCenterY = this.player.pixelY + TILE_SIZE / 2;

    this.camera.targetX = playerCenterX - INTERNAL_WIDTH / 2;
    this.camera.targetY = playerCenterY - INTERNAL_HEIGHT / 2;

    // Clamp to map edges
    const maxCamX = this.mapWidth * TILE_SIZE - INTERNAL_WIDTH;
    const maxCamY = this.mapHeight * TILE_SIZE - INTERNAL_HEIGHT;
    this.camera.targetX = Math.max(0, Math.min(maxCamX, this.camera.targetX));
    this.camera.targetY = Math.max(0, Math.min(maxCamY, this.camera.targetY));

    // Smooth lerp
    this.camera.x += (this.camera.targetX - this.camera.x) * CAMERA_LERP;
    this.camera.y += (this.camera.targetY - this.camera.y) * CAMERA_LERP;

    // Clamp again (for precision)
    this.camera.x = Math.max(0, Math.min(maxCamX, this.camera.x));
    this.camera.y = Math.max(0, Math.min(maxCamY, this.camera.y));
  }

  private _snapCameraToPlayer(): void {
    const playerCenterX = this.player.pixelX + TILE_SIZE / 2;
    const playerCenterY = this.player.pixelY + TILE_SIZE / 2;
    this.camera.x = playerCenterX - INTERNAL_WIDTH / 2;
    this.camera.y = playerCenterY - INTERNAL_HEIGHT / 2;
    const maxCamX = this.mapWidth * TILE_SIZE - INTERNAL_WIDTH;
    const maxCamY = this.mapHeight * TILE_SIZE - INTERNAL_HEIGHT;
    this.camera.x = Math.max(0, Math.min(maxCamX, this.camera.x));
    this.camera.y = Math.max(0, Math.min(maxCamY, this.camera.y));
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;
  }

  // ═══════════════════════════════════════════════════════════════════
  // NPC UPDATES
  // ═══════════════════════════════════════════════════════════════════

  private _updateNPCs(dt: number): void {
    for (const npc of this.npcs) {
      // Check appearance condition
      if (npc.appearsAfterObjective) {
        const wasVisible = npc.visible;
        npc.visible = saveManager.isObjectiveCompleted(npc.appearsAfterObjective);
        if (npc.visible && !wasVisible) {
          gameEvents.emit('ibarra:appear');
        }
      }

      // Update idle animation
      npc.animTimer += dt;
      if (npc.animTimer >= IDLE_ANIM_RATE) {
        npc.animTimer -= IDLE_ANIM_RATE;
        npc.animFrame++;
      }

      // Update pixel position (NPCs don't move, but snap to tile)
      npc.pixelX = npc.col * TILE_SIZE;
      npc.pixelY = npc.row * TILE_SIZE;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTION & TRIGGER SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  private _handleInteract(): void {
    if (this.dialogue.active) {
      // Advance dialogue
      this.advanceDialogue();
      return;
    }

    // Try to talk to an adjacent NPC
    const facing = this.player.facing;
    const offset = DIR_OFFSET[facing];
    const targetRow = this.player.row + offset.dr;
    const targetCol = this.player.col + offset.dc;

    // Check NPCs at target tile or current tile
    let closestNpc: NPCState | null = null;
    let closestDist = Infinity;

    for (const npc of this.npcs) {
      if (!npc.visible) continue;
      const dist = Math.abs(npc.row - targetRow) + Math.abs(npc.col - targetCol);
      if (dist === 0 && dist < closestDist) {
        closestNpc = npc;
        closestDist = dist;
      }
    }

    // Also check NPCs on player's tile (standing on top of them)
    if (!closestNpc) {
      for (const npc of this.npcs) {
        if (!npc.visible) continue;
        const dist = Math.abs(npc.row - this.player.row) + Math.abs(npc.col - this.player.col);
        if (dist <= 1 && dist < closestDist) {
          closestNpc = npc;
          closestDist = dist;
        }
      }
    }

    if (closestNpc) {
      // Face NPC toward player
      closestNpc.facing = this._oppositeDirection(this.player.facing);
      this._startNpcDialogue(closestNpc);
    }
  }

  private _startNpcDialogue(npc: NPCState): void {
    // Increment interaction count
    this.npcInteractionCounts[npc.id] = (this.npcInteractionCounts[npc.id] || 0) + 1;
    this._saveNpcInteractions();

    // Determine which dialogue to use
    let dialogueId: string | null = null;
    const npcId = npc.id;

    // Check for first-time dialogues based on NPC ID
    if (npcId === 'mang-tenyo') {
      if (!saveManager.isObjectiveCompleted('obj.ch1.follow_tenyo')) {
        dialogueId = 'mang-tenyo-first';
      } else if (!saveManager.isObjectiveCompleted('obj.ch1.overhear_gossip')) {
        dialogueId = 'mang-tenyo-repeat';
      } else {
        dialogueId = 'mang-tenyo-after-gossip';
      }
    } else if (npcId === 'vendor-1' || npcId === 'vendor-2' || npcId === 'kitchen-staff-1' || npcId === 'kitchen-staff-2') {
      // Vendors share market-gossip dialogue
      if (saveManager.isObjectiveCompleted('obj.ch1.follow_tenyo') && !saveManager.isObjectiveCompleted('obj.ch1.overhear_gossip')) {
        dialogueId = 'market-gossip';
      } else {
        // Generic vendor repeat
        dialogueId = 'mang-tenyo-repeat'; // Fallback
      }
    } else if (npcId === 'ibara') {
      // Ibarra sighting
      dialogueId = 'ibarra-sighting';
    }

    if (dialogueId && (dialogueData.dialogues as any)[dialogueId]) {
      this._startDialogue(dialogueId, npcId);
    }
  }

  private _startDialogue(dialogueId: string, npcId: string | null): void {
    const dialogueObj = (dialogueData.dialogues as any)[dialogueId];
    if (!dialogueObj) return;

    const lines: DialogueLine[] = dialogueObj.lines.map((l: any) => ({
      speaker: l.speaker,
      text: l.text,
      translation: l.translation,
      isTimeTransition: l.isTimeTransition,
      isIbarraSighting: l.isIbarraSighting,
    }));

    this.dialogue = {
      active: true,
      dialogueId,
      lines,
      currentLineIndex: 0,
      npcId,
      triggered: true,
    };

    // Emit dialogue:start event
    const firstLine = lines[0];
    gameEvents.emit('dialogue:start', {
      dialogueId,
      line: firstLine,
      lineIndex: 0,
      totalLines: lines.length,
    });

    // Complete any objectives this dialogue unlocks
    if (dialogueObj.unlocksObjective) {
      saveManager.completeObjective(dialogueObj.unlocksObjective);
      saveManager.saveProgress();
    }
  }

  advanceDialogue(): void {
    if (!this.dialogue.active) return;

    const nextIndex = this.dialogue.currentLineIndex + 1;

    if (nextIndex >= this.dialogue.lines.length) {
      // End dialogue
      const wasTimeTransition = this.dialogue.lines.some(l => l.isTimeTransition);

      this.dialogue = {
        active: false,
        dialogueId: null,
        lines: [],
        currentLineIndex: 0,
        npcId: null,
        triggered: false,
      };

      gameEvents.emit('dialogue:end');

      // Handle time transition
      if (wasTimeTransition) {
        gameEvents.emit('time:transition', 'morning');
        saveManager.updateGameState({ timeOfDay: 'morning', chapterPhase: 'ibarra-sighting' });
        soundManager.play('time-transition');
      }

      return;
    }

    // Advance to next line
    this.dialogue.currentLineIndex = nextIndex;
    const line = this.dialogue.lines[nextIndex];

    gameEvents.emit('dialogue:line', {
      dialogueId: this.dialogue.dialogueId,
      line,
      lineIndex: nextIndex,
      totalLines: this.dialogue.lines.length,
    });

    // Handle time transition in dialogue line
    if (line.isTimeTransition) {
      gameEvents.emit('time:transition', 'morning');
      saveManager.updateGameState({ timeOfDay: 'morning' });
    }
  }

  private _checkTriggerZones(now: number): void {
    for (const zone of this.triggerZones) {
      if (zone.triggered) continue;

      // Check objective requirement
      if (zone.requiresObjective && !saveManager.isObjectiveCompleted(zone.requiresObjective)) continue;

      // Check if player is in the zone
      const inZone = this.player.row >= zone.row && this.player.row < zone.row + zone.height &&
                     this.player.col >= zone.col && this.player.col < zone.col + zone.width;

      // Or within radius
      const centerRow = zone.row + (zone.height - 1) / 2;
      const centerCol = zone.col + (zone.width - 1) / 2;
      const dist = Math.sqrt(
        Math.pow(this.player.row - centerRow, 2) +
        Math.pow(this.player.col - centerCol, 2)
      );
      const inRadius = zone.radius > 0 && dist <= zone.radius;

      if (inZone || inRadius) {
        zone.triggered = true;

        if (zone.dialogueId) {
          this._startDialogue(zone.dialogueId, zone.npcId || null);
        }

        gameEvents.emit('interaction:trigger', { zoneId: zone.id, type: zone.type });

        // If this triggers a time transition, handle it
        if (zone.triggersTimeTransition) {
          // Time transition will be handled by the dialogue lines
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // AMBIENT SOUND TRACKING
  // ═══════════════════════════════════════════════════════════════════

  private _updateAmbient(): void {
    // Check if player is near market area (rows 17-22, cols 3-22)
    const nearMarket = this.player.row >= 16 && this.player.row <= 23 &&
                       this.player.col >= 2 && this.player.col <= 23;

    if (nearMarket && !this.wasNearMarket) {
      soundManager.startMarketAmbient();
      this.wasNearMarket = true;
    } else if (!nearMarket && this.wasNearMarket) {
      soundManager.stopMarketAmbient();
      this.wasNearMarket = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDERING PIPELINE
  // ═══════════════════════════════════════════════════════════════════

  private _render(): void {
    if (!this.offCtx || !this.ctx) return;

    const ctx = this.offCtx;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    const camX = Math.round(this.camera.x);
    const camY = Math.round(this.camera.y);

    // Calculate visible tile range
    const startCol = Math.floor(camX / TILE_SIZE);
    const startRow = Math.floor(camY / TILE_SIZE);
    const endCol = Math.ceil((camX + INTERNAL_WIDTH) / TILE_SIZE);
    const endRow = Math.ceil((camY + INTERNAL_HEIGHT) / TILE_SIZE);

    // ── LAYER 1: Ground tiles ──
    this._renderGroundTiles(ctx, camX, camY, startRow, endRow, endCol);

    // ── LAYER 2: Building sprites ──
    this._renderBuildings(ctx, camX, camY);

    // ── LAYER 3: Props (below characters) ──
    this._renderProps(ctx, camX, camY);

    // ── LAYER 4: Y-sorted characters (NPCs + Player) ──
    this._renderCharacters(ctx, camX, camY);

    // ── LAYER 5: Overlay (shadows) ──
    this._renderOverlay(ctx, camX, camY, startRow, endRow, endCol);

    // ── Copy to display canvas ──
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.offscreen!, 0, 0);
  }

  private _renderGroundTiles(
    ctx: CanvasRenderingContext2D, camX: number, camY: number,
    startRow: number, endRow: number, endCol: number
  ): void {
    // Tile types that are buildings (rendered as sprites, not tiles)
    const BUILDING_TILE_TYPES = new Set([5, 6]);

    // Fallback colors for tile types without images
    const fallbackColors: Record<number, string> = {
      1: '#C4A76C', 2: '#8FBC8F', 3: '#D2B48C', 4: '#A0522D',
      5: '#696969', 6: '#8B4513', 7: '#6B8E6B', 8: '#555555',
      9: '#B8A070', 10: '#4A90A4', 11: '#7CB342', 12: '#00000033',
    };

    for (let row = startRow; row <= endRow && row < this.mapHeight; row++) {
      if (row < 0) continue;
      for (let col = 0; col <= endCol && col < this.mapWidth; col++) {
        if (col < 0) continue;

        const tileType = this.groundLayer[row]?.[col] || 0;
        if (tileType === 0) continue; // Empty tile — should not exist but safety check

        // Skip building tile types (church=5, mansion=6) — they are rendered as sprites
        if (BUILDING_TILE_TYPES.has(tileType)) continue;

        const screenX = col * TILE_SIZE - camX;
        const screenY = row * TILE_SIZE - camY;

        // Render tile image from assetManager
        // Tile canvas is pre-rendered at DISPLAY_TILE_SIZE (48×48)
        // We draw it scaled down to TILE_SIZE (24×24) in internal coords
        // Use bilinear for clean 2:1 downscale
        const tileAsset = assetManager.getTile(tileType);
        if (tileAsset) {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(tileAsset.canvas, 0, 0, DISPLAY_TILE_SIZE, DISPLAY_TILE_SIZE, screenX, screenY, TILE_SIZE, TILE_SIZE);
          ctx.imageSmoothingEnabled = false;
        } else {
          // Fallback: colored rectangle for tiles without images
          ctx.fillStyle = fallbackColors[tileType] || '#FF00FF';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  private _renderBuildings(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const building of this.buildings) {
      const buildingAsset = assetManager.getBuilding(building.key);
      if (!buildingAsset) continue;

      // Building position in internal pixels
      const bx = building.col * TILE_SIZE - camX;
      const by = building.row * TILE_SIZE - camY;

      // Use pre-rendered canvas (already at display size)
      // Scale from display size down to internal size with bilinear for clean result
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        buildingAsset.canvas,
        0, 0, buildingAsset.displayWidth, buildingAsset.displayHeight,
        bx, by, buildingAsset.internalWidth, buildingAsset.internalHeight
      );
      ctx.imageSmoothingEnabled = false;
    }
  }

  private _renderProps(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const prop of this.props) {
      const propAsset = assetManager.getProp(prop.key);
      if (!propAsset) continue;

      const px = prop.col * TILE_SIZE - camX;
      const py = prop.row * TILE_SIZE - camY;

      // Use pre-rendered canvas (already at display size)
      // Scale from display size down to internal size with bilinear for clean result
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        propAsset.canvas,
        0, 0, propAsset.displayWidth, propAsset.displayHeight,
        px, py, propAsset.internalWidth, propAsset.internalHeight
      );
      ctx.imageSmoothingEnabled = false;
    }
  }

  private _renderCharacters(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    // Collect all renderable characters with their Y position for sorting
    interface Renderable {
      type: 'player' | 'npc';
      y: number;
      data: any;
    }

    const renderables: Renderable[] = [];

    // Add player
    renderables.push({
      type: 'player',
      y: this.player.pixelY + TILE_SIZE, // Bottom of sprite for Y-sorting
      data: this.player,
    });

    // Add visible NPCs
    for (const npc of this.npcs) {
      if (!npc.visible) continue;
      renderables.push({
        type: 'npc',
        y: npc.pixelY + TILE_SIZE,
        data: npc,
      });
    }

    // Sort by Y position (top to bottom)
    renderables.sort((a, b) => a.y - b.y);

    // Render in sorted order
    for (const r of renderables) {
      if (r.type === 'player') {
        this._renderPlayer(ctx, camX, camY);
      } else {
        this._renderNPC(ctx, r.data as NPCState, camX, camY);
      }
    }
  }

  private _renderPlayer(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const screenX = this.player.pixelX - camX;
    const screenY = this.player.pixelY - camY;

    // Try to get player sprite from spriteLoader
    const facing = DIR_TO_FACING[this.player.facing];
    const isMoving = this.player.isSliding;
    const animName = isMoving ? 'Walk' : 'Breathing_Idle';

    const frameCount = spriteLoader.getAnimationFrameCount('student', animName);
    const frameIndex = frameCount > 0 ? this.player.animFrame % frameCount : 0;

    const frame = spriteLoader.getFrame('student', animName, facing, frameIndex);

    if (frame) {
      // Draw the sprite frame scaled to CHAR_RENDER_SIZE
      // Use bilinear for smooth character downscaling, then nearest-neighbor for display
      const drawSize = CHAR_RENDER_SIZE;
      const offsetX = (TILE_SIZE - drawSize) / 2;
      const offsetY = TILE_SIZE - drawSize; // Character bottom aligns with tile bottom

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        frame,
        0, 0, frame.width, frame.height,
        screenX + offsetX, screenY + offsetY, drawSize, drawSize
      );
      ctx.imageSmoothingEnabled = false;
    } else {
      // Fallback: draw a colored character
      this._drawPlaceholderCharacter(ctx, screenX, screenY, '#4A90D9', 'P');
    }
  }

  private _renderNPC(ctx: CanvasRenderingContext2D, npc: NPCState, camX: number, camY: number): void {
    const screenX = npc.pixelX - camX;
    const screenY = npc.pixelY - camY;

    // Try to render using sprite sheet from assetManager
    if (npc.spriteSheet) {
      const spriteSet = assetManager.getNpcSheet(npc.spriteSheet);
      if (spriteSet) {
        const facing = DIR_TO_FACING[npc.facing];
        const frames = spriteSet.idle; // NPCs use idle animation
        const dirFrames = frames[facing] || frames['south'];

        if (dirFrames && dirFrames.length > 0) {
          const frameIndex = npc.animFrame % dirFrames.length;
          const frame = dirFrames[frameIndex];

          // Scale NPC sprite to fit character render area
          const drawWidth = CHAR_RENDER_SIZE;
          const drawHeight = CHAR_RENDER_SIZE + 8; // NPCs can be slightly taller
          const offsetX = (TILE_SIZE - drawWidth) / 2;
          const offsetY = TILE_SIZE - drawHeight;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            frame.canvas,
            0, 0, frame.width, frame.height,
            screenX + offsetX, screenY + offsetY, drawWidth, drawHeight
          );
          ctx.imageSmoothingEnabled = false;
          return;
        }
      }
    }

    // Try spriteLoader as fallback (for ibara)
    const charKey = npc.characterKey;
    const facing = DIR_TO_FACING[npc.facing];
    const frame = spriteLoader.getFrame(charKey, 'Breathing_Idle', facing, npc.animFrame % 4);

    if (frame) {
      const drawSize = CHAR_RENDER_SIZE;
      const offsetX = (TILE_SIZE - drawSize) / 2;
      const offsetY = TILE_SIZE - drawSize;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        frame,
        0, 0, frame.width, frame.height,
        screenX + offsetX, screenY + offsetY, drawSize, drawSize
      );
      ctx.imageSmoothingEnabled = false;
    } else {
      // Final fallback: colored placeholder
      const npcColors: Record<string, string> = {
        'mang-tenyo': '#8B4513',
        'vendor-1': '#D2691E',
        'vendor-2': '#CD853F',
        'ibara': '#1E3A5F',
        'kitchen-staff-1': '#D2691E',
        'kitchen-staff-2': '#CD853F',
      };
      const color = npcColors[npc.id] || '#FF6B6B';
      this._drawPlaceholderCharacter(ctx, screenX, screenY, color, npc.displayName.substring(0, 2));
    }
  }

  private _drawPlaceholderCharacter(
    ctx: CanvasRenderingContext2D, x: number, y: number,
    color: string, label: string
  ): void {
    // Simple pixel-art style character placeholder
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(cx - 5, cy - 8, 10, 16);

    // Head
    ctx.fillStyle = color;
    ctx.fillRect(cx - 4, cy - 14, 8, 8);

    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(cx - 2, cy - 12, 1, 1);
    ctx.fillRect(cx + 1, cy - 12, 1, 1);

    // Label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, y + TILE_SIZE + 4);
  }

  private _renderOverlay(
    ctx: CanvasRenderingContext2D, camX: number, camY: number,
    startRow: number, endRow: number, endCol: number
  ): void {
    for (let row = startRow; row <= endRow && row < this.mapHeight; row++) {
      if (row < 0) continue;
      for (let col = 0; col <= endCol && col < this.mapWidth; col++) {
        if (col < 0) continue;

        const overlayType = this.overlayLayer[row]?.[col] || 0;
        if (overlayType === 0) continue;

        const screenX = col * TILE_SIZE - camX;
        const screenY = row * TILE_SIZE - camY;

        const tileAsset = assetManager.getTile(overlayType);
        if (tileAsset) {
          ctx.globalAlpha = 0.5;
          ctx.drawImage(tileAsset.canvas, 0, 0, DISPLAY_TILE_SIZE, DISPLAY_TILE_SIZE, screenX, screenY, TILE_SIZE, TILE_SIZE);
          ctx.globalAlpha = 1.0;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════════════════

  private _gameLoop = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min(now - this.lastTime, 50); // Cap delta to avoid huge jumps
    this.lastTime = now;

    // Update systems
    this._updateMovement(now, dt);
    this._updateNPCs(dt);
    this._updateCamera();
    this._updateAmbient();

    // Render
    this._render();

    // Schedule next frame
    this.animFrameId = requestAnimationFrame(this._gameLoop);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════

  private _toDirection4(dir: string): Direction4 {
    const map8to4: Record<string, Direction4> = {
      'south': 'south', 'south-east': 'south', 'south-west': 'south',
      'north': 'north', 'north-east': 'north', 'north-west': 'north',
      'east': 'east', 'west': 'west',
    };
    return map8to4[dir] || 'south';
  }

  private _oppositeDirection(dir: Direction4): Direction4 {
    const opposites: Record<Direction4, Direction4> = {
      north: 'south', south: 'north', east: 'west', west: 'east',
    };
    return opposites[dir];
  }

  private _loadNpcInteractions(): void {
    try {
      const raw = localStorage.getItem('noor-npc-interactions');
      if (raw) {
        this.npcInteractionCounts = JSON.parse(raw);
      }
    } catch {
      this.npcInteractionCounts = {};
    }
  }

  private _saveNpcInteractions(): void {
    try {
      // Also save in the format expected by gameStore warmth system
      const data: Record<string, { timesTalked: number }> = {};
      for (const [id, count] of Object.entries(this.npcInteractionCounts)) {
        data[id] = { timesTalked: count };
      }
      localStorage.setItem('noor-npc-interactions', JSON.stringify(data));
    } catch {
      // Ignore
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API (used by GameCanvas and external controls)
  // ═══════════════════════════════════════════════════════════════════

  getPlayerPosition(): { row: number; col: number } {
    return { row: this.player.row, col: this.player.col };
  }

  getPlayerFacing(): Direction4 {
    return this.player.facing;
  }

  isDialogueActive(): boolean {
    return this.dialogue.active;
  }

  getMapDimensions(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }

  getCollisionMap(): number[][] {
    return this.collisionLayer;
  }

  getNpcStates(): NPCState[] {
    return this.npcs;
  }
}

export default GameEngine;

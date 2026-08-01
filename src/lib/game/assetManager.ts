// AssetManager - Loads and pre-processes ALL game assets (tiles, buildings, props, NPC sheets)
// Pre-renders assets to offscreen canvases at proper display sizes
// Uses bilinear smoothing for downscaling (clean), then nearest-neighbor for display (pixelated)
// Parses NPC sprite sheets into frame arrays organized by direction and animation state

// ── Tile type constants ──
export const TILE_TYPES = {
  EMPTY: 0,
  DIRT: 1,
  GRASS: 2,
  COBBLESTONE: 3,
  MARKET_FLOOR: 4,
  CHURCH: 5,
  MANSION: 6,
  GARDEN_FLOWERBED: 7,
  STONE_WALL: 8,
  DIRT_GRASS_EDGE: 9,
  FOUNTAIN: 10,
  RICE_PADDY_EDGE: 11,
  SHADOW_OVERLAY: 12,
} as const;

// Tile ID → image path mapping
const TILE_IMAGE_PATHS: Record<number, string> = {
  [TILE_TYPES.DIRT]: '/sprites/tiles/dirt.png',
  [TILE_TYPES.GRASS]: '/sprites/tiles/grass.png',
  [TILE_TYPES.COBBLESTONE]: '/sprites/tiles/cobblestone.png',
  [TILE_TYPES.MARKET_FLOOR]: '/sprites/tiles/market_floor.png',
  [TILE_TYPES.GARDEN_FLOWERBED]: '/sprites/tiles/garden_flowerbed.png',
  [TILE_TYPES.STONE_WALL]: '/sprites/tiles/stone_wall.png',
  [TILE_TYPES.DIRT_GRASS_EDGE]: '/sprites/tiles/dirt_grass_edge.png',
  [TILE_TYPES.FOUNTAIN]: '/sprites/tiles/fountain_base.png',
  [TILE_TYPES.RICE_PADDY_EDGE]: '/sprites/tiles/rice_paddy_edge.png',
  [TILE_TYPES.SHADOW_OVERLAY]: '/sprites/tiles/shadow_overhang.png',
};

// ── Building image paths + display sizes (in tiles) ──
interface BuildingConfig {
  path: string;
  tileWidth: number;  // How many tiles wide the building spans
  tileHeight: number; // How many tiles tall
}

const BUILDING_CONFIGS: Record<string, BuildingConfig> = {
  church: { path: '/sprites/buildings/church_convent.png', tileWidth: 5, tileHeight: 5 },
  mansion: { path: '/sprites/buildings/ibarra_mansion.png', tileWidth: 4, tileHeight: 3 },
};

// ── Prop image paths + display sizes (in tiles) ──
interface PropConfig {
  path: string;
  tileWidth: number;
  tileHeight: number;
}

const PROP_CONFIGS: Record<string, PropConfig> = {
  market_stalls: { path: '/sprites/props/market_stalls.png', tileWidth: 6, tileHeight: 2 },
  cart:          { path: '/sprites/props/cart.png', tileWidth: 2, tileHeight: 2 },
  carabao:       { path: '/sprites/props/carabao.png', tileWidth: 2, tileHeight: 2 },
  produce_table: { path: '/sprites/props/produce_table.png', tileWidth: 2, tileHeight: 1 },
  rice_crates:   { path: '/sprites/props/rice_crates.png', tileWidth: 1, tileHeight: 1 },
  clay_jar:      { path: '/sprites/props/clay_jar.png', tileWidth: 1, tileHeight: 1 },
  bench:         { path: '/sprites/props/bench.png', tileWidth: 1, tileHeight: 1 },
  street_lamp:   { path: '/sprites/props/street_lamp.png', tileWidth: 1, tileHeight: 1 },
  woven_basket:  { path: '/sprites/props/woven_basket.png', tileWidth: 1, tileHeight: 1 },
};

// ── NPC sheet paths ──
const NPC_SHEET_PATHS: Record<string, string> = {
  mang_tenyo_sheet: '/sprites/npcs/mang_tenyo_sheet.png',
  vendor1_sheet: '/sprites/npcs/vendor1_sheet.png',
  vendor2_sheet: '/sprites/npcs/vendor2_sheet.png',
};

// ── Sprite sheet layout definitions ──
// All NPC sheets are 2048×2048 pixels
interface SpriteSheetLayout {
  cols: number;
  rows: number;
  frameWidth: number;   // Width of each frame in the source image
  frameHeight: number;  // Height of each frame in the source image
  idleCols: number;     // Number of columns for idle animation
  walkCols: number;     // Number of columns for walk animation
  idleOnly?: boolean;   // If true, use idle frames for walk too
  directionsInRows?: boolean; // If true, each row = a direction; if false, each col = a direction
}

// Actual layouts based on VLM analysis of 2048×2048 sprite sheets:
// mang_tenyo_sheet: 8 cols × 9 rows, ~256×227 per frame, 4 idle + 4 walk per row, directions in rows
// vendor1_sheet: 9 cols × 4 rows, ~227×512 per frame, all idle (no walk), directions in COLUMNS
// vendor2_sheet: 4 cols × 9 rows, ~512×227 per frame, 1 idle + 3 walk per row, directions in rows
const NPC_SHEET_LAYOUTS: Record<string, SpriteSheetLayout> = {
  mang_tenyo_sheet: {
    cols: 8, rows: 8,
    frameWidth: 256, frameHeight: 256,
    idleCols: 4, walkCols: 4,
    directionsInRows: true,
  },
  vendor1_sheet: {
    cols: 9, rows: 4,
    frameWidth: 227, frameHeight: 512,
    idleCols: 4, walkCols: 0,
    idleOnly: true,
    directionsInRows: false, // directions are in columns for vendor1
  },
  vendor2_sheet: {
    cols: 4, rows: 8,
    frameWidth: 512, frameHeight: 256,
    idleCols: 1, walkCols: 3,
    directionsInRows: true,
  },
};

// Direction order in sprite sheet rows (matching the 8 directions)
const SHEET_DIRECTION_ORDER = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'] as const;

// 4-direction mapping: map 8-dir sheet rows to the 4 cardinal directions
const EIGHT_TO_FOUR_DIR: Record<string, string> = {
  'south': 'south',
  'south-east': 'south',
  'east': 'east',
  'north-east': 'north',
  'north': 'north',
  'north-west': 'north',
  'west': 'west',
  'south-west': 'south',
};

// ── Constants ──
const DISPLAY_TILE_SIZE = 48;  // Display pixels per tile
const INTERNAL_TILE_SIZE = 24; // Internal pixels per tile

// ── Exported types ──
export interface TileCanvas {
  canvas: HTMLCanvasElement;
  tileType: number;
}

export interface BuildingAsset {
  canvas: HTMLCanvasElement;  // Pre-rendered at display size
  key: string;
  displayWidth: number;   // Width in display pixels
  displayHeight: number;  // Height in display pixels
  internalWidth: number;  // Width in internal pixels
  internalHeight: number; // Height in internal pixels
}

export interface PropAsset {
  canvas: HTMLCanvasElement;  // Pre-rendered at display size
  key: string;
  displayWidth: number;
  displayHeight: number;
  internalWidth: number;
  internalHeight: number;
}

export interface NpcFrame {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface NpcSpriteSet {
  idle: Record<string, NpcFrame[]>;   // direction → frames
  walk: Record<string, NpcFrame[]>;   // direction → frames
  frameWidth: number;
  frameHeight: number;
}

export interface AssetManagerAssets {
  tiles: Map<number, TileCanvas>;
  buildings: Map<string, BuildingAsset>;
  props: Map<string, PropAsset>;
  npcSheets: Map<string, NpcSpriteSet>;
  loaded: boolean;
}

// ── Helper: High-quality downscale for pixel art ──
// Uses bilinear smoothing for the downscale to avoid aliasing, then the result
// is displayed with nearest-neighbor in the game loop for crisp pixel art look
function preRenderAsset(
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = targetWidth;
  result.height = targetHeight;
  const ctx = result.getContext('2d')!;

  // Use high-quality bilinear downscale for clean results
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

  return result;
}

// ── AssetManager class ──
class AssetManager {
  private assets: AssetManagerAssets = {
    tiles: new Map(),
    buildings: new Map(),
    props: new Map(),
    npcSheets: new Map(),
    loaded: false,
  };

  /** Load all assets. Call once during game init. */
  async loadAll(): Promise<void> {
    if (this.assets.loaded) return;

    // 1. Load and pre-render tiles (816×816 source → 48×48 display canvas)
    //    Since 816/48 = 17 (integer), nearest-neighbor works perfectly for pixel art
    const tilePromises = Object.entries(TILE_IMAGE_PATHS).map(async ([typeStr, path]) => {
      const type = Number(typeStr);
      const img = await this._loadImage(path);
      // Use step-wise downscale for clean pixel art
      const canvas = preRenderAsset(img, DISPLAY_TILE_SIZE, DISPLAY_TILE_SIZE);
      this.assets.tiles.set(type, { canvas, tileType: type });
    });

    // 2. Load and pre-render buildings at their display pixel sizes
    const buildingPromises = Object.entries(BUILDING_CONFIGS).map(async ([key, config]) => {
      const image = await this._loadImage(config.path);
      const displayWidth = config.tileWidth * DISPLAY_TILE_SIZE;
      const displayHeight = config.tileHeight * DISPLAY_TILE_SIZE;
      const internalWidth = config.tileWidth * INTERNAL_TILE_SIZE;
      const internalHeight = config.tileHeight * INTERNAL_TILE_SIZE;
      // Pre-render at display size using step-wise downscale
      const canvas = preRenderAsset(image, displayWidth, displayHeight);
      this.assets.buildings.set(key, {
        canvas,
        key,
        displayWidth,
        displayHeight,
        internalWidth,
        internalHeight,
      });
    });

    // 3. Load and pre-render props at their display pixel sizes
    const propPromises = Object.entries(PROP_CONFIGS).map(async ([key, config]) => {
      const image = await this._loadImage(config.path);
      const displayWidth = config.tileWidth * DISPLAY_TILE_SIZE;
      const displayHeight = config.tileHeight * DISPLAY_TILE_SIZE;
      const internalWidth = config.tileWidth * INTERNAL_TILE_SIZE;
      const internalHeight = config.tileHeight * INTERNAL_TILE_SIZE;
      // Pre-render at display size using step-wise downscale
      const canvas = preRenderAsset(image, displayWidth, displayHeight);
      this.assets.props.set(key, {
        canvas,
        key,
        displayWidth,
        displayHeight,
        internalWidth,
        internalHeight,
      });
    });

    // 4. Parse NPC sprite sheets
    const npcPromises = Object.entries(NPC_SHEET_PATHS).map(async ([key, path]) => {
      const layout = NPC_SHEET_LAYOUTS[key];
      if (!layout) {
        console.warn(`No layout defined for NPC sheet: ${key}`);
        return;
      }
      const image = await this._loadImage(path);
      const spriteSet = this._parseSpriteSheet(image, layout);
      this.assets.npcSheets.set(key, spriteSet);
    });

    await Promise.all([
      ...tilePromises,
      ...buildingPromises,
      ...propPromises,
      ...npcPromises,
    ]);

    console.log(`[AssetManager] Loaded: ${this.assets.tiles.size} tiles, ${this.assets.buildings.size} buildings, ${this.assets.props.size} props, ${this.assets.npcSheets.size} NPC sheets`);
    this.assets.loaded = true;
  }

  /** Parse a sprite sheet image into idle/walk frames by direction */
  private _parseSpriteSheet(image: HTMLImageElement, layout: SpriteSheetLayout): NpcSpriteSet {
    const result: NpcSpriteSet = {
      idle: {},
      walk: {},
      frameWidth: layout.frameWidth,
      frameHeight: layout.frameHeight,
    };

    if (layout.directionsInRows) {
      // Standard layout: rows = directions, cols = animation frames
      for (let row = 0; row < layout.rows && row < SHEET_DIRECTION_ORDER.length; row++) {
        const dir8 = SHEET_DIRECTION_ORDER[row];
        const dir4 = EIGHT_TO_FOUR_DIR[dir8] || 'south';

        // Parse idle frames (first idleCols columns)
        const idleFrames: NpcFrame[] = [];
        for (let col = 0; col < layout.idleCols; col++) {
          const frame = this._extractFrame(image, col, row, layout);
          idleFrames.push(frame);
        }

        // Parse walk frames (next walkCols columns)
        const walkFrames: NpcFrame[] = [];
        if (!layout.idleOnly) {
          for (let col = layout.idleCols; col < layout.idleCols + layout.walkCols; col++) {
            const frame = this._extractFrame(image, col, row, layout);
            walkFrames.push(frame);
          }
        }

        // Store frames mapped to 4-direction name
        if (!result.idle[dir4]) {
          result.idle[dir4] = idleFrames;
        }
        if (!result.walk[dir4]) {
          result.walk[dir4] = layout.idleOnly ? idleFrames : walkFrames;
        }
      }
    } else {
      // Vendor1 layout: columns = directions, rows = animation frames
      for (let col = 0; col < layout.cols && col < SHEET_DIRECTION_ORDER.length; col++) {
        const dir8 = SHEET_DIRECTION_ORDER[col];
        const dir4 = EIGHT_TO_FOUR_DIR[dir8] || 'south';

        // Parse idle frames (each row is an idle frame for this direction)
        const idleFrames: NpcFrame[] = [];
        for (let row = 0; row < layout.rows; row++) {
          const frame = this._extractFrame(image, col, row, layout);
          idleFrames.push(frame);
        }

        if (!result.idle[dir4]) {
          result.idle[dir4] = idleFrames;
        }
        if (!result.walk[dir4]) {
          result.walk[dir4] = idleFrames; // idleOnly for vendor1
        }
      }
    }

    // Ensure all 4 directions have at least south fallback
    const dirs4 = ['south', 'east', 'north', 'west'];
    for (const dir of dirs4) {
      if (!result.idle[dir] && result.idle['south']) {
        result.idle[dir] = result.idle['south'];
      }
      if (!result.walk[dir] && result.walk['south']) {
        result.walk[dir] = result.walk['south'];
      }
    }

    return result;
  }

  /** Extract a single frame from a sprite sheet as an offscreen canvas */
  private _extractFrame(image: HTMLImageElement, col: number, row: number, layout: SpriteSheetLayout): NpcFrame {
    // Target display size for NPC frames (scale down for game rendering)
    const targetWidth = 64;  // Display size for NPC frame
    const targetHeight = 64;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true; // bilinear for clean downscale
    ctx.drawImage(
      image,
      col * layout.frameWidth, row * layout.frameHeight,
      layout.frameWidth, layout.frameHeight,
      0, 0,
      targetWidth, targetHeight
    );
    return { canvas, width: targetWidth, height: targetHeight };
  }

  /** Load an image and return a promise */
  private _loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`[AssetManager] Failed to load image: ${src}`);
        // Create a 1×1 transparent placeholder
        const fallback = document.createElement('canvas');
        fallback.width = 1;
        fallback.height = 1;
        // Convert canvas to image for API compatibility
        const fallbackImg = new Image();
        fallbackImg.src = fallback.toDataURL();
        fallbackImg.onload = () => resolve(fallbackImg);
      };
      img.src = src;
    });
  }

  // ── Public accessors ──

  getTile(tileType: number): TileCanvas | undefined {
    return this.assets.tiles.get(tileType);
  }

  getBuilding(key: string): BuildingAsset | undefined {
    return this.assets.buildings.get(key);
  }

  getProp(key: string): PropAsset | undefined {
    return this.assets.props.get(key);
  }

  getNpcSheet(key: string): NpcSpriteSet | undefined {
    return this.assets.npcSheets.get(key);
  }

  isLoaded(): boolean {
    return this.assets.loaded;
  }

  getTiles(): Map<number, TileCanvas> {
    return this.assets.tiles;
  }

  getBuildings(): Map<string, BuildingAsset> {
    return this.assets.buildings;
  }

  getProps(): Map<string, PropAsset> {
    return this.assets.props;
  }

  getNpcSheets(): Map<string, NpcSpriteSet> {
    return this.assets.npcSheets;
  }
}

export const assetManager = new AssetManager();
export default AssetManager;

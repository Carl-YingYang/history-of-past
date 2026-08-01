// AssetManager - Loads and pre-processes ALL game assets (tiles, buildings, props, NPC sheets)
// Pre-renders tiles to offscreen canvases for fast blitting with imageSmoothingEnabled = false
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

// ── Building image paths ──
const BUILDING_IMAGE_PATHS: Record<string, string> = {
  church: '/sprites/buildings/church_convent.png',
  mansion: '/sprites/buildings/ibarra_mansion.png',
};

// ── Prop image paths ──
const PROP_IMAGE_PATHS: Record<string, string> = {
  market_stalls: '/sprites/props/market_stalls.png',
  cart: '/sprites/props/cart.png',
  carabao: '/sprites/props/carabao.png',
  produce_table: '/sprites/props/produce_table.png',
  rice_crates: '/sprites/props/rice_crates.png',
  clay_jar: '/sprites/props/clay_jar.png',
  bench: '/sprites/props/bench.png',
  street_lamp: '/sprites/props/street_lamp.png',
  woven_basket: '/sprites/props/woven_basket.png',
};

// ── NPC sheet paths ──
const NPC_SHEET_PATHS: Record<string, string> = {
  mang_tenyo_sheet: '/sprites/npcs/mang_tenyo_sheet.png',
  vendor1_sheet: '/sprites/npcs/vendor1_sheet.png',
  vendor2_sheet: '/sprites/npcs/vendor2_sheet.png',
};

// ── Sprite sheet layout definitions ──
interface SpriteSheetLayout {
  cols: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  idleCols: number; // number of columns for idle animation
  walkCols: number; // number of columns for walk animation
  idleOnly?: boolean; // if true, use idle frames for walk too
}

const NPC_SHEET_LAYOUTS: Record<string, SpriteSheetLayout> = {
  mang_tenyo_sheet: { cols: 8, rows: 8, frameWidth: 120, frameHeight: 120, idleCols: 4, walkCols: 4 },
  vendor1_sheet: { cols: 9, rows: 5, frameWidth: 128, frameHeight: 216, idleCols: 4, walkCols: 5 },
  vendor2_sheet: { cols: 4, rows: 8, frameWidth: 144, frameHeight: 108, idleCols: 4, walkCols: 0, idleOnly: true },
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

// ── Exported types ──
export interface TileCanvas {
  canvas: HTMLCanvasElement;
  tileType: number;
}

export interface BuildingAsset {
  image: HTMLImageElement;
  key: string;
}

export interface PropAsset {
  image: HTMLImageElement;
  key: string;
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

    const tileSize = 48; // All tiles are pre-rendered to 48×48 canvases

    // 1. Load and pre-render tiles
    const tilePromises = Object.entries(TILE_IMAGE_PATHS).map(async ([typeStr, path]) => {
      const type = Number(typeStr);
      const img = await this._loadImage(path);
      const canvas = document.createElement('canvas');
      canvas.width = tileSize;
      canvas.height = tileSize;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, tileSize, tileSize);
      this.assets.tiles.set(type, { canvas, tileType: type });
    });

    // 2. Load building images
    const buildingPromises = Object.entries(BUILDING_IMAGE_PATHS).map(async ([key, path]) => {
      const image = await this._loadImage(path);
      this.assets.buildings.set(key, { image, key });
    });

    // 3. Load prop images
    const propPromises = Object.entries(PROP_IMAGE_PATHS).map(async ([key, path]) => {
      const image = await this._loadImage(path);
      this.assets.props.set(key, { image, key });
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

    // For each row (direction)
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
      // If this direction row maps to the same 4-dir as a previous row,
      // only keep the first one (prioritize cardinal directions)
      if (!result.idle[dir4]) {
        result.idle[dir4] = idleFrames;
      }
      if (!result.walk[dir4]) {
        result.walk[dir4] = layout.idleOnly ? idleFrames : walkFrames;
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
    const canvas = document.createElement('canvas');
    canvas.width = layout.frameWidth;
    canvas.height = layout.frameHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      col * layout.frameWidth, row * layout.frameHeight,
      layout.frameWidth, layout.frameHeight,
      0, 0,
      layout.frameWidth, layout.frameHeight
    );
    return { canvas, width: layout.frameWidth, height: layout.frameHeight };
  }

  /** Load an image and return a promise */
  private _loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        // Create a 1×1 transparent placeholder
        const fallback = new Image();
        fallback.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
        resolve(fallback);
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

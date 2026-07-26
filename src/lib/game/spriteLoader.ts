// SpriteLoader - Loads individual PNG frame images for character animations
// Only loads Breathing_Idle and Walk (per design rules: no combat, jump, or run)

import characterData from '@/data/characters.json';

interface SpriteFrameCache {
  [characterId: string]: {
    [animation: string]: {
      [direction: string]: HTMLImageElement[]
    }
  };
}

interface PlaceholderConfig {
  placeholder: boolean;
  placeholderColor: string;
  placeholderLabel: string;
}

class SpriteLoader {
  private cache: SpriteFrameCache = {};
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private placeholderCache: Map<string, HTMLImageElement> = new Map();

  async loadCharacter(characterId: string): Promise<void> {
    if (this.loadingPromises.has(characterId)) {
      return this.loadingPromises.get(characterId)!;
    }

    const promise = this._loadCharacterInternal(characterId);
    this.loadingPromises.set(characterId, promise);
    return promise;
  }

  private async _loadCharacterInternal(characterId: string): Promise<void> {
    const charConfig = (characterData.characters as Record<string, typeof characterData.characters.student & Partial<PlaceholderConfig>>)[characterId];
    
    if (!charConfig) {
      throw new Error(`Character config not found for: ${characterId}`);
    }

    // Handle placeholder characters
    if (charConfig.placeholder) {
      this.cache[characterId] = {};
      for (const animName of ['Breathing_Idle', 'Walk']) {
        this.cache[characterId][animName] = {};
        const animConfig = charConfig.animations[animName as keyof typeof charConfig.animations];
        const directions = characterData.directions;
        
        for (const dir of directions) {
          // Generate placeholder frames
          this.cache[characterId][animName][dir] = [];
          for (let i = 0; i < animConfig.frames; i++) {
            const placeholderImg = this._createPlaceholderFrame(
              charConfig.placeholderColor,
              charConfig.placeholderLabel || characterId,
              charConfig.size.width,
              charConfig.size.height,
              animName === 'Breathing_Idle' ? 0.3 + (i * 0.1) : 1
            );
            this.cache[characterId][animName][dir].push(placeholderImg);
          }
        }
      }
      return;
    }

    // Load real sprite frames
    this.cache[characterId] = {};
    const animationsToLoad = ['Breathing_Idle', 'Walk'];

    for (const animName of animationsToLoad) {
      const animConfig = charConfig.animations[animName as keyof typeof charConfig.animations];
      this.cache[characterId][animName] = {};
      
      for (const dir of characterData.directions) {
        this.cache[characterId][animName][dir] = [];
        
        for (let frameIdx = 0; frameIdx < animConfig.frames; frameIdx++) {
          const img = new Image();
          img.src = `${charConfig.spritePath}/animations/${animName}/${dir}/frame_${String(frameIdx).padStart(3, '0')}.png`;
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => {
              // Fallback: use a placeholder if the real frame fails to load
              console.warn(`Failed to load frame: ${img.src}, using placeholder`);
              const fallback = this._createPlaceholderFrame(
                '#FF6B6B',
                `${characterId} (missing)`,
                charConfig.size.width,
                charConfig.size.height,
                1
              );
              this.cache[characterId][animName][dir][frameIdx] = fallback;
              resolve();
            };
          });
          
          this.cache[characterId][animName][dir].push(img);
        }
      }
    }
  }

  private _createPlaceholderFrame(
    color: string,
    label: string,
    width: number,
    height: number,
    alpha: number
  ): HTMLImageElement {
    // Create a canvas-based placeholder sprite
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Draw placeholder body
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    
    // Simple body shape (oval torso + head circle)
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Head
    ctx.beginPath();
    ctx.arc(centerX, centerY - 14, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 6, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Label text
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label.substring(0, 8), centerX, centerY + 28);
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width - 1, height - 1);
    
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  }

  getFrame(
    characterId: string,
    animation: string,
    direction: string,
    frameIndex: number
  ): HTMLImageElement | null {
    const charCache = this.cache[characterId];
    if (!charCache) return null;
    
    const animCache = charCache[animation];
    if (!animCache) return null;
    
    const dirFrames = animCache[direction];
    if (!dirFrames) return null;
    
    return dirFrames[frameIndex] || null;
  }

  getAnimationFrameCount(characterId: string, animation: string): number {
    const charCache = this.cache[characterId];
    if (!charCache) return 0;
    
    const animCache = charCache[animation];
    if (!animCache) return 0;
    
    const firstDir = Object.values(animCache)[0];
    return firstDir?.length || 0;
  }

  isLoaded(characterId: string): boolean {
    return !!this.cache[characterId];
  }
}

export const spriteLoader = new SpriteLoader();
export default SpriteLoader;

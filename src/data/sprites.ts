/**
 * Custom Sprites Storage & Default Exports for GitHub Persistence
 * 
 * Kids and developers can draw custom ships (16x16) and custom planets (32x32)
 * in the game's Pixel Art Editors, export their Base64 text codes, and paste them here!
 */

export interface CustomPlanetData {
  id: string;
  name: string;
  type: 'normal' | 'ice' | 'lava' | 'gold';
  dataUrl: string;
  radius?: number;
}

/**
 * Default custom ship sprite (Base64 PNG Data URL).
 * If empty string, default game canvas drawing vector is used.
 */
export const PLAYER_SHIP_SPRITE: string = "";

/**
 * Default custom planet sprites list (Base64 PNG Data URLs).
 * Exported planet text strings can be permanently added to this array.
 */
export const PLANET_SPRITES: CustomPlanetData[] = [
  // Example starter custom planet (can be extended with kids' exported codes)
];

// LocalStorage Keys for persistent browser session playback
export const STORAGE_KEY_SHIP_SPRITE = 'asteroid_miner_custom_ship_sprite';
export const STORAGE_KEY_PLANET_SPRITES = 'asteroid_miner_custom_planet_sprites';

/**
 * Load active ship sprite from localStorage or default code export
 */
export function getActiveShipSprite(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SHIP_SPRITE);
    if (saved && saved.startsWith('data:image/')) {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to read custom ship sprite from localStorage', e);
  }
  return PLAYER_SHIP_SPRITE;
}

/**
 * Save custom ship sprite to localStorage
 */
export function saveActiveShipSprite(dataUrl: string): void {
  try {
    if (dataUrl) {
      localStorage.setItem(STORAGE_KEY_SHIP_SPRITE, dataUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_SHIP_SPRITE);
    }
  } catch (e) {
    console.warn('Failed to save custom ship sprite to localStorage', e);
  }
}

/**
 * Load list of custom planets from localStorage or default exports
 */
export function getActivePlanetSprites(): CustomPlanetData[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PLANET_SPRITES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to read custom planet sprites from localStorage', e);
  }
  return PLANET_SPRITES;
}

/**
 * Save custom planet list to localStorage
 */
export function saveActivePlanetSprites(planets: CustomPlanetData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PLANET_SPRITES, JSON.stringify(planets));
  } catch (e) {
    console.warn('Failed to save custom planet sprites to localStorage', e);
  }
}

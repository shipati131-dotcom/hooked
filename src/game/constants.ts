export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 900;
export const COLORS_BG = '#0b2a3a';

export const SCENE_KEYS = {
    BOOT: 'BootScene',
    MENU: 'MenuScene',
    FISHING: 'FishingScene',
    HUD: 'HudScene',
    SHOP: 'ShopScene',
    UPGRADE: 'UpgradeScene',
    COLLECTION: 'CollectionScene',
    ACHIEVEMENT: 'AchievementScene',
    MAP: 'MapScene',
    SETTINGS: 'SettingsScene'
} as const;

export const DEPTH = {
    BG_FAR: 0,
    BG_MID: 10,
    WATER: 20,
    PROPS_BACK: 25,
    LINE: 30,
    BOBBER: 35,
    PROPS_FRONT: 40,
    ROD: 45,
    PARTICLES: 50,
    MINIGAME: 60,
    REVEAL: 70,
    UI_PANEL: 100,
    UI_POPUP: 200,
    UI_TOP: 300
} as const;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_COLOR: Record<Rarity, number> = {
    common: 0xb9c2c9,
    uncommon: 0x4caf6a,
    rare: 0x3d8bf0,
    epic: 0xa54cec,
    legendary: 0xf0b93d,
    mythic: 0xef4ccb
};

export const RARITY_COLOR_2: Record<Rarity, number> = {
    // secondary color, used for mythic animated glow etc.
    common: 0xd8dee2,
    uncommon: 0x6fce8f,
    rare: 0x6fb0f5,
    epic: 0xc37bf5,
    legendary: 0xf7d585,
    mythic: 0x4cd4ef
};

export const RARITY_LABEL: Record<Rarity, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic'
};

export const SIZE_LABELS = ['Small', 'Average', 'Large', 'Huge', 'Trophy', 'Record'] as const;
export type SizeLabel = typeof SIZE_LABELS[number];

export const SAVE_KEY = 'hooked:save';
export const SAVE_BACKUP_KEY = 'hooked:save:corrupt';
export const SAVE_VERSION = 1;

export const NAV_ITEMS = [
    { key: SCENE_KEYS.FISHING, label: 'FISH' },
    { key: SCENE_KEYS.SHOP, label: 'SHOP' },
    { key: SCENE_KEYS.COLLECTION, label: 'COLLECTION' },
    { key: SCENE_KEYS.UPGRADE, label: 'UPGRADES' },
    { key: SCENE_KEYS.ACHIEVEMENT, label: 'ACHIEVEMENTS' }
] as const;

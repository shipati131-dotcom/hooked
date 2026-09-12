import Phaser from 'phaser';
import { SCENE_KEYS } from '../constants';
import { buildTextures } from '../art/TextureFactory';
import { createServices } from '../core/services';
import { SPECIES_WITH_REAL_ART } from '../art/FishArt';
import { LOCATIONS_WITH_VIDEO } from '../art/LocationRenderer';
import { LOCATIONS } from '../data/locations';
import { PERKS } from '../data/upgrades';
import { RODS, REELS, LINES, BAITS, BOBBERS } from '../data/equipment';
import type { EquipmentDef, EquipmentCategory } from '../data/types';

const EQUIPMENT_ATLASES: { category: EquipmentCategory; file: string; cols: number; rows: number; items: EquipmentDef[] }[] = [
    { category: 'rod', file: 'shop-rods.png', cols: 3, rows: 2, items: RODS },
    { category: 'reel', file: 'shop-reels.png', cols: 5, rows: 1, items: REELS },
    { category: 'line', file: 'shop-lines.png', cols: 5, rows: 1, items: LINES },
    { category: 'bait', file: 'shop-baits.png', cols: 4, rows: 2, items: BAITS },
    { category: 'bobber', file: 'shop-bobbers.png', cols: 3, rows: 2, items: BOBBERS }
];

export class BootScene extends Phaser.Scene {
    constructor() { super(SCENE_KEYS.BOOT); }

    preload(): void {
        // Real illustrated sprites (replacing the procedural silhouettes) --
        // loaded under the same `fish-${id}` key every scene already expects,
        // so nothing downstream needs to change.
        for (const id of SPECIES_WITH_REAL_ART) {
            this.load.image(`fish-${id}`, `visual-game-assets/sprites/fish/${id}.png`);
        }
        for (const location of LOCATIONS) {
            this.load.image(`location-${location.id}`, `visual-game-assets/locations/${location.id}.webp`);
            if (LOCATIONS_WITH_VIDEO.has(location.id)) {
                this.load.video(`location-${location.id}-video`, `visual-game-assets/locations/${location.id}.mp4`, true);
            }
        }
        this.load.image('rod-vintage', 'visual-game-assets/equipment/rod-vintage.webp');
        this.load.image('bobber-art', 'visual-game-assets/equipment/bobber-classic.webp');
        for (const atlas of EQUIPMENT_ATLASES) {
            this.load.image(`equipment-${atlas.category}`, `visual-game-assets/equipment/${atlas.file}`);
        }
        for (const perk of PERKS) {
            this.load.image(`perk-${perk.id}`, `visual-game-assets/upgrades/${perk.id}.webp`);
        }

        // Open-source icon set (Iconify/Twemoji + Noto) -- real coin icon and a
        // representative icon per location, loaded as SVGs so they stay crisp
        // at any size.
        this.load.svg('coin-icon-art', 'visual-game-assets/icons/coin.svg', { width: 128, height: 128 });
        for (const location of LOCATIONS) {
            this.load.svg(`location-icon-${location.id}`, `visual-game-assets/icons/${location.id}.svg`, { width: 64, height: 64 });
        }
    }

    create(): void {
        // Fish sprites are authored as crisp pixel art and are intentionally
        // enlarged in the reel meter, catch reveal, and Fishdex.
        for (const id of SPECIES_WITH_REAL_ART) {
            this.textures.get(`fish-${id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        for (const perk of PERKS) {
            const texture = this.textures.get(`perk-${perk.id}`);
            const source = texture.getSourceImage() as HTMLImageElement;
            for (let tier = 1; tier <= perk.maxLevel; tier++) {
                const col = (tier - 1) % 5;
                const row = Math.floor((tier - 1) / 5);
                const x = Math.round(col * source.width / 5);
                const y = Math.round(row * source.height / 2);
                const right = Math.round((col + 1) * source.width / 5);
                const bottom = Math.round((row + 1) * source.height / 2);
                texture.add(String(tier), 0, x, y, right - x, bottom - y);
            }
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        for (const atlas of EQUIPMENT_ATLASES) {
            const texture = this.textures.get(`equipment-${atlas.category}`);
            const source = texture.getSourceImage() as HTMLImageElement;
            atlas.items.forEach((item, index) => {
                const col = index % atlas.cols;
                const row = Math.floor(index / atlas.cols);
                const x = Math.round(col * source.width / atlas.cols);
                const y = Math.round(row * source.height / atlas.rows);
                const right = Math.round((col + 1) * source.width / atlas.cols);
                const bottom = Math.round((row + 1) * source.height / atlas.rows);
                texture.add(item.id, 0, x, y, right - x, bottom - y);
            });
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        buildTextures(this);

        // Swap the procedural coin placeholder for the real open-source coin
        // art (Noto `coin` icon via Iconify) under the same 'coin-icon' key,
        // so every existing `this.add.image(..., 'coin-icon')` call picks it
        // up with no other changes.
        this.textures.remove('coin-icon');
        this.textures.addImage('coin-icon', this.textures.get('coin-icon-art').getSourceImage() as HTMLImageElement);

        createServices(this.game);

        // Best-effort font warm-up: index.html already pre-warms Fredoka/Nunito via
        // hidden DOM elements, so by the time we get here the browser has usually
        // already started (or finished) loading them. We don't block the scene
        // transition on this -- worst case the very first frame of text uses the
        // fallback stack before swapping in, which reads fine either way.
        this.scene.start(SCENE_KEYS.MENU);
    }
}

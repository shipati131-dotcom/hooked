import Phaser from 'phaser';
import { RARITY_COLOR } from '../constants';
import type { Rarity } from '../constants';

/**
 * Applies (or clears) a v4 filter glow on a game object based on rarity.
 * Filters are WebGL-only and enableFilters() is a no-op harness on canvas mode,
 * so this is wrapped defensively and never throws if unsupported.
 */
export function applyRarityGlow(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, rarity: Rarity): void {
    try {
        const anyObj = obj as unknown as { enableFilters?: () => void; filters?: { internal: { clear: () => void; addGlow: (color: number, outer?: number, inner?: number, scale?: number) => void } } };
        if (!anyObj.enableFilters) return;
        anyObj.enableFilters();
        anyObj.filters?.internal.clear();
        if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
            const strength = rarity === 'mythic' ? 5 : rarity === 'legendary' ? 4.5 : rarity === 'epic' ? 3.5 : 2.5;
            anyObj.filters?.internal.addGlow(RARITY_COLOR[rarity], strength, 0, 1.1);
        }
    } catch {
        // filters unsupported on this renderer -- silently skip, gameplay unaffected
    }
}

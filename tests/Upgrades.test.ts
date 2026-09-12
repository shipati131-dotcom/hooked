import { describe, expect, it } from 'vitest';
import { createDefaultSave, GameBus } from '../src/game/core/GameState';
import { PERKS, perkArtTier } from '../src/game/data/upgrades';
import { UpgradeSystem } from '../src/game/systems/UpgradeSystem';

describe('UpgradeSystem', () => {
    it('gives every perk ten distinct visual tiers and previews the next one', () => {
        for (const perk of PERKS) {
            expect(perk.maxLevel).toBe(10);
            expect(perkArtTier(perk, 0)).toBe(1);
            expect(perkArtTier(perk, 5)).toBe(6);
            expect(perkArtTier(perk, 9)).toBe(10);
            expect(perkArtTier(perk, 10)).toBe(10);
        }
    });

    it('applies and caps all six gameplay upgrade lines', () => {
        const save = createDefaultSave();
        const upgrades = new UpgradeSystem(save, new GameBus());
        for (const perk of PERKS) {
            for (let tier = 0; tier < 10; tier++) {
                expect(upgrades.buyLevel(perk.id, () => true)).toBe(true);
            }
            expect(upgrades.level(perk.id)).toBe(10);
            expect(upgrades.isMaxed(perk.id)).toBe(true);
            expect(upgrades.buyLevel(perk.id, () => true)).toBe(false);
        }

        expect(upgrades.luckyHook).toBeCloseTo(0.2);
        expect(upgrades.quickBite).toBeCloseTo(0.35);
        expect(upgrades.strongArms).toBeCloseTo(0.3);
        expect(upgrades.fishSenseLevel).toBe(10);
        expect(upgrades.goldenTouchMult).toBeCloseTo(1.4);
        expect(upgrades.xpHunterMult).toBeCloseTo(1.4);
    });
});

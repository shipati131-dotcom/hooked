import { describe, it, expect } from 'vitest';
import { FishGenerator } from '../src/game/systems/FishGenerator';
import { Rng } from '../src/game/utils/rng';
import { RARITY_ORDER } from '../src/game/constants';
import { LOCATIONS } from '../src/game/data/locations';
import { FISH } from '../src/game/data/fish';

describe('FishGenerator', () => {
    it('only rolls species valid for the requested location', () => {
        const gen = new FishGenerator(new Rng(42));
        const discovered = new Set<string>();
        for (let i = 0; i < 300; i++) {
            const result = gen.roll('pond', { rodRareLuck: 0, baitRarityLuck: 0, luckyHookBonus: 0 }, discovered, 0, 0);
            expect(result.fish.locations).toContain('pond');
        }
    });

    it('never produces a weight outside the species range', () => {
        const gen = new FishGenerator(new Rng(7));
        const discovered = new Set<string>();
        for (let i = 0; i < 500; i++) {
            const result = gen.roll('ocean', { rodRareLuck: 0, baitRarityLuck: 0, luckyHookBonus: 0 }, discovered, 0, 0);
            expect(result.weight).toBeGreaterThanOrEqual(result.fish.minWeight);
            expect(result.weight).toBeLessThanOrEqual(result.fish.maxWeight);
        }
    });

    it('skews weight toward the low end so huge specimens are rare', () => {
        const gen = new FishGenerator(new Rng(11));
        const discovered = new Set<string>();
        let aboveHalfCount = 0;
        const trials = 1000;
        for (let i = 0; i < trials; i++) {
            const result = gen.roll('pond', { rodRareLuck: 0, baitRarityLuck: 0, luckyHookBonus: 0 }, discovered, 0, 0);
            if (result.weightPercentile > 0.5) aboveHalfCount++;
        }
        // with skew > 1, far fewer than half of rolls should land above the midpoint percentile
        expect(aboveHalfCount / trials).toBeLessThan(0.35);
    });

    it('rarity luck increases the chance of rolling rare-or-better fish', () => {
        const trials = 2000;
        const countRareOrBetter = (luck: number) => {
            const gen = new FishGenerator(new Rng(99));
            let count = 0;
            for (let i = 0; i < trials; i++) {
                const rarity = gen.rollRarity('pond', { rodRareLuck: luck, baitRarityLuck: 0, luckyHookBonus: 0 }, 0);
                if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('rare')) count++;
            }
            return count;
        };
        const baseline = countRareOrBetter(0);
        const boosted = countRareOrBetter(1.5);
        expect(boosted).toBeGreaterThan(baseline);
    });

    it('every location has at least one fish available in its table', () => {
        for (const loc of LOCATIONS) {
            const pool = FISH.filter(f => f.locations.includes(loc.id));
            expect(pool.length).toBeGreaterThan(0);
        }
    });
});

import { BALANCE, sizeLabelForPercentile } from '../data/balance';
import { fishForLocation } from '../data/fish';
import { getLocation } from '../data/locations';
import type { FishDef } from '../data/types';
import type { Rarity, SizeLabel } from '../constants';
import { RARITY_ORDER } from '../constants';
import { Rng, rng as defaultRng } from '../utils/rng';

export interface LoadoutLuck {
    rodRareLuck: number;
    baitRarityLuck: number;
    luckyHookBonus: number; // from perk, e.g. 0.02 per level
}

export interface RolledFish {
    fish: FishDef;
    weight: number;
    weightPercentile: number;
    sizeLabel: SizeLabel;
}

/**
 * Controlled-randomness fish roller. Rarity odds come from the location table,
 * boosted by equipment/perk luck and a pity counter; species selection favors
 * undiscovered fish slightly; weight is skewed so huge specimens stay rare.
 */
export class FishGenerator {
    constructor(private r: Rng = defaultRng) {}

    rollRarity(locationId: string, luck: LoadoutLuck, castsSinceRareOrBetter: number): Rarity {
        const loc = getLocation(locationId);
        const totalLuck = luck.rodRareLuck + luck.baitRarityLuck + luck.luckyHookBonus;
        const pity = Math.min(
            BALANCE.rarity.pityMaxBonus,
            Math.max(0, castsSinceRareOrBetter - BALANCE.rarity.pityStartCasts) * BALANCE.rarity.pityRampPerCast
        );
        const entries: [Rarity, number][] = RARITY_ORDER.map(rarity => {
            const base = loc.rarityWeights[rarity];
            const scale = BALANCE.rarity.luckRarityScale[rarity];
            const mult = 1 + scale * (totalLuck + pity);
            return [rarity, base * mult];
        });
        return this.r.weighted(entries);
    }

    rollSpecies(locationId: string, rarity: Rarity, discovered: Set<string>): FishDef {
        let pool = fishForLocation(locationId).filter(f => f.rarity === rarity);
        if (pool.length === 0) {
            // fall back to the nearest lower rarity available at this location
            const idx = RARITY_ORDER.indexOf(rarity);
            for (let i = idx - 1; i >= 0 && pool.length === 0; i--) {
                pool = fishForLocation(locationId).filter(f => f.rarity === RARITY_ORDER[i]);
            }
        }
        if (pool.length === 0) pool = fishForLocation(locationId);
        const entries: [FishDef, number][] = pool.map(f => {
            const bias = discovered.has(f.id) ? 1 : BALANCE.rarity.discoveryBias;
            return [f, f.biteChance * bias];
        });
        return this.r.weighted(entries);
    }

    rollWeight(fish: FishDef, fishSenseLevel: number): { weight: number; percentile: number; sizeLabel: SizeLabel } {
        const skew = Math.max(1.1, BALANCE.rarity.weightSkew - fishSenseLevel * BALANCE.rarity.weightSkewFishSenseReduction);
        const p = Math.pow(this.r.next(), skew);
        const weight = fish.minWeight + (fish.maxWeight - fish.minWeight) * p;
        return { weight, percentile: p, sizeLabel: sizeLabelForPercentile(p) };
    }

    roll(locationId: string, luck: LoadoutLuck, discovered: Set<string>, castsSinceRareOrBetter: number, fishSenseLevel: number): RolledFish {
        const rarity = this.rollRarity(locationId, luck, castsSinceRareOrBetter);
        const fish = this.rollSpecies(locationId, rarity, discovered);
        const { weight, percentile, sizeLabel } = this.rollWeight(fish, fishSenseLevel);
        return { fish, weight, weightPercentile: percentile, sizeLabel };
    }
}

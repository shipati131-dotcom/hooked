import type { Rarity } from '../constants';

/**
 * Centralized tuning. Every "magic number" that affects game feel or economy pacing
 * should live here, not scattered through systems/scenes.
 */
export const BALANCE = {
    xp: {
        /** XP required to go from level L to L+1. Grows steadily slower, never flat/grindy. */
        toNext: (level: number) => Math.round(40 + 45 * Math.pow(level, 1.6)),
        maxLevel: 60,
        perfectBonusMult: 1.25
    },

    economy: {
        /** value = baseValue * (weight/avgWeight)^weightExp * sizeLabelMult * location.valueMult * goldenTouchMult */
        weightValueExp: 0.8,
        sizeLabelValueMult: { Small: 0.85, Average: 1.0, Large: 1.25, Huge: 1.7, Trophy: 2.6, Record: 4.0 } as Record<string, number>
    },

    rarity: {
        /** Extra multiplicative luck applied to rarity weights above `common`, stacking from equipment/perks. */
        luckRarityScale: { common: 0, uncommon: 0.6, rare: 1.0, epic: 1.5, legendary: 2.2, mythic: 3.0 } as Record<Rarity, number>,
        /** Pity: after this many casts without rare+ catch, luck ramps up per extra cast. */
        pityStartCasts: 12,
        pityRampPerCast: 0.08,
        pityMaxBonus: 2.5,
        /** Undiscovered species get a bite-chance multiplier to help Fishdex completion pace. */
        discoveryBias: 1.4,
        /** Weight roll skew: weight = min + (max-min) * r^skew. Higher skew = big fish rarer. */
        weightSkew: 2.2,
        weightSkewFishSenseReduction: 0.09 // per fish-sense level
    },

    sizeLabels: {
        // percentile thresholds (0..1) of the weight roll
        thresholds: { small: 0.2, average: 0.55, large: 0.8, huge: 0.93, trophy: 0.985 }
    },

    bite: {
        minMs: 1500,
        maxMs: 5000,
        nibbleChance: 0.55,
        maxNibbles: 2,
        hookWindowMs: 1400,
        tutorialCatchCount: 3,
        tutorialScale: 0.5,
        hugeRarityThreshold: 'epic' as Rarity,
        hugeWeightPercentile: 0.9
    },

    minigame: {
        catchZoneBaseHeight: 170,
        catchZoneControlScale: 8, // + control*scale px
        liftAccel: 2400,
        gravity: 1900,
        maxVelocity: 950,
        bounceDamp: 0.35,
        trackPadding: 40,
        meterStart: 0.3,
        fillRatePerSec: 0.34, // * reel.captureSpeed
        drainRatePerSec: 0.20, // reduced by line quality
        tensionBuildPerSec: 0.28,
        tensionDecayPerSec: 0.4,
        tensionThresholdWeightRatio: 0.6, // fish weight / line.maxTension ratio above which tension bar appears
        fishBaseSpeed: 90,
        fishSpeedPerDifficulty: 22,
        fishSpeedWeightFactor: 0.35
    },

    perks: {
        maxLevel: 10,
        costGrowth: 1.55
    },

    challenges: {
        activeSlots: 3,
        rerollCost: 150
    },

    location: {
        // fee scaling is per-location (see locations.ts); nothing extra here yet.
    },

    autosave: {
        intervalMs: 30000
    }
};

export function sizeLabelForPercentile(p: number): 'Small' | 'Average' | 'Large' | 'Huge' | 'Trophy' | 'Record' {
    const t = BALANCE.sizeLabels.thresholds;
    if (p < t.small) return 'Small';
    if (p < t.average) return 'Average';
    if (p < t.large) return 'Large';
    if (p < t.huge) return 'Huge';
    if (p < t.trophy) return 'Trophy';
    return 'Record';
}

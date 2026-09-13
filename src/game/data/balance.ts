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
        // The fight starts at `tutorialScale` difficulty (for a brand new
        // player still learning to hold/release/steer/manage tension) and
        // ramps smoothly up to full difficulty by `tutorialRampCatches`
        // total catches -- a gradual climb rather than a hard cliff, so
        // nothing suddenly gets harder overnight right as a player is
        // getting comfortable.
        tutorialScale: 0.45,
        tutorialRampCatches: 8,
        hugeRarityThreshold: 'epic' as Rarity,
        hugeWeightPercentile: 0.9
    },

    /** Aim + power-timing cast. See systems/fishing/CastModel.ts. */
    cast: {
        needleCycleSec: 1.3, // one full 0-1-0 sweep of the power needle
        baseSweetWidth: 0.16, // fraction of the 0..1 power range that lands cleanly
        controlWidthPerPoint: 0.007, // rod control widens the sweet band
        perfectWidth: 0.05, // distance from band center still counted as a "Perfect" cast
        baseReachPx: 700,
        reachPerPowerPoint: 220, // rod.power above 1.0 extends reach
        shortCastPenalty: 0.6, // luck multiplier when well under-powered
        overshootPenalty: 0.7, // luck multiplier when well over-powered (still lands, just sloppy)
        hotspotCount: 2,
        hotspotRadiusPx: 90,
        hotspotRelocateSec: 15,
        hotspotShimmerLuck: 0.15,
        hotspotShimmerBiteSpeedMult: 0.75, // bites arrive faster on a shimmer hotspot
        hotspotGoldenChance: 0.15,
        hotspotGoldenLuck: 0.35,
        perfectCastLuck: 0.08,
        farCastWeightBonusMaxPx: 900, // casts at/beyond this distance get the full weight-skew bonus
        farCastWeightSkewReduction: 0.35 // subtracted from weightSkew on a max-distance cast (bigger fish more likely)
    },

    /** Pre-strike bite-cue sequencing. See systems/fishing/BiteModel.ts. */
    biteCues: {
        nibbleDurationMs: 260,
        tugDurationMs: 220,
        dragDurationMs: 900,
        falsePlungeDurationMs: 260,
        plungeTelegraphMs: 140, // time between the real plunge starting and the strike window opening
        tutorialSpookGraceCatches: 3 // first N catches: striking a fake cue just warns instead of spooking the fish
    },

    /** Directional hook-set. See systems/fishing/BiteModel.ts resolveStrike(). */
    hookSet: {
        baseWindowMs: 900,
        solidSpeedMs: 450, // a swipe completed within this long after the window opens is "fast" (Solid hook eligible)
        lightHookThrowBonus: 0.18, // extra hook-throw chance added to a Light hook's baseline
        doublePullThreshold: 0.75, // hookDifficulty at/above this may flip direction mid-window
        doublePullDelayMs: 260
    },

    /** The fight itself -- tension/stamina/distance/lateral model. See systems/fishing/FightModel.ts. */
    fight: {
        tensionApproachRate: 5.0, // how fast tension chases its target, before rod flex/reel resistance
        tensionSafeMax: 0.6, // below this: green zone
        tensionPowerMax: 0.9, // below this: amber "power" zone (bonus stamina damage), above: red
        powerZoneStaminaMult: 1.35,
        redlineStaminaMult: 1.7,
        snapGraceBaseSec: 0.22, // scaled by line.snapResist
        lineCapacityWeightScale: 0.55,
        lineCapacityMin: 0.45,
        lineCapacityMax: 1.25,
        staminaDrainExponent: 1.6, // superlinear: high tension exhausts much faster -- the risk/reward knob
        staminaDrainBase: 0.16,
        counterSteerStaminaBonus: 0.8,
        counterSteerBurstShorten: 0.35,
        followSteerTensionCut: 0.3,
        followSteerStaminaCut: 0.5,
        slackTensionThreshold: 0.15,
        slackTimerBaseSec: 2.2, // scaled by hook.holdStrength
        reelBaseDistPerSec: 0.066,
        restReelMult: 1.8,
        exhaustedStaminaThreshold: 0.12,
        landedDistanceThreshold: 0.03,
        moveCooldownBaseSec: 0.65,
        jumpAirborneSec: 0.7,
        jumpTensionThrowThreshold: 0.45,
        jumpBaseThrowChance: 0.3,
        phaseAnnounceDurationSec: 0.8,
        thrashHz: 5,
        thrashDurationMinSec: 1.2,
        thrashDurationMaxSec: 1.8
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

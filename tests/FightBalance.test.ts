import { describe, it, expect } from 'vitest';
import { Rng } from '../src/game/utils/rng';
import { FightModel, type FightGear, type FightSnapshot } from '../src/game/systems/fishing/FightModel';
import { buildFightProfile } from '../src/game/systems/fishing/fightProfile';
import { getFish } from '../src/game/data/fish';
import { getLocation } from '../src/game/data/locations';
import { RODS, REELS, LINES, HOOKS } from '../src/game/data/equipment';
import type { RodStats, ReelStats, LineStats, HookStats } from '../src/game/data/types';

/** One representative fish + era-appropriate gear per rarity tier, used to
 *  check the whole difficulty curve rather than one arbitrary fish. */
const TIERS = [
    { rarity: 'common', fishId: 'bluegill', rodTier: 1, reelTier: 1, lineTier: 1, hookTier: 1, band: [4, 12] as [number, number] },
    { rarity: 'uncommon', fishId: 'bass', rodTier: 1, reelTier: 1, lineTier: 1, hookTier: 1, band: [5, 16] as [number, number] },
    { rarity: 'rare', fishId: 'catfish', rodTier: 3, reelTier: 2, lineTier: 2, hookTier: 2, band: [8, 24] as [number, number] },
    { rarity: 'epic', fishId: 'muskie', rodTier: 4, reelTier: 3, lineTier: 3, hookTier: 3, band: [12, 34] as [number, number] },
    { rarity: 'legendary', fishId: 'pinewood-phantom', rodTier: 5, reelTier: 4, lineTier: 4, hookTier: 4, band: [18, 55] as [number, number] },
    { rarity: 'mythic', fishId: 'moonlit-koi', rodTier: 6, reelTier: 5, hookTier: 5, lineTier: 5, band: [24, 75] as [number, number] }
];

function gearFor(rodTier: number, reelTier: number, lineTier: number, hookTier: number): FightGear {
    return {
        rod: RODS[rodTier - 1].stats as RodStats,
        reel: REELS[reelTier - 1].stats as ReelStats,
        line: LINES[lineTier - 1].stats as LineStats,
        hook: HOOKS[hookTier - 1].stats as HookStats
    };
}

function buildFight(fishId: string, gear: FightGear, seed: number): FightModel {
    const fish = getFish(fishId);
    const locationMod = getLocation(fish.locations[0]).difficultyMod;
    const profile = buildFightProfile(fish, {
        weightPercentile: 0.5, locationDifficultyMod: locationMod, tutorialProgress: 1, totalCaught: 60
    });
    const weight = fish.minWeight + (fish.maxWeight - fish.minWeight) * 0.5;
    return new FightModel(profile, gear, weight, {}, new Rng(seed));
}

type Policy = 'reactive' | 'reckless' | 'passive';
function simulate(fm: FightModel, policy: Policy): FightSnapshot {
    let held = true, previous = fm.snapshot().requiredAction, reaction = 0;
    for (let i = 0; i < 60 * 90 && !fm.isDone(); i++) {
        const snap = fm.snapshot();
        if (snap.requiredAction !== previous) { reaction = 0.18; previous = snap.requiredAction; }
        reaction -= 1 / 60;
        if (reaction <= 0) held = snap.requiredAction === 'pull';
        fm.update(1 / 60, policy === 'reactive' ? held : policy === 'reckless', 0);
    }
    return fm.snapshot();
}

describe('Fight balance across all rarities', () => {
    it('human-speed reactions land every rarity with appropriate gear', () => {
        for (const tier of TIERS) {
            for (let seed = 1; seed <= 10; seed++) {
                const snap = simulate(buildFight(tier.fishId, gearFor(tier.rodTier, tier.reelTier, tier.lineTier, tier.hookTier), seed), 'reactive');
                expect(snap.result, tier.rarity + ' seed ' + seed).toBe('landed');
                expect(snap.escapeRisk).toBe(0);
                expect(snap.elapsedSec).toBeGreaterThan(5);
                expect(snap.elapsedSec).toBeLessThan(60);
                expect(snap.successfulReleases).toBeGreaterThanOrEqual(2);
            }
        }
    });
    it('holding forever or releasing forever loses at every rarity, even with top gear', () => {
        for (const tier of TIERS) {
            for (const policy of ['reckless', 'passive'] as const) {
                for (let seed = 1; seed <= 6; seed++) {
                    const snap = simulate(buildFight(tier.fishId, gearFor(6, 5, 5, 5), seed), policy);
                    expect(snap.result, tier.rarity + ' ' + policy).toBe(policy === 'reckless' ? 'lineSnapped' : 'slackEscape');
                }
            }
        }
    });
    it('upgraded rod and reel shorten fights but do not bypass release windows', () => {
        const basic = simulate(buildFight('catfish', gearFor(1, 1, 1, 1), 5), 'reactive');
        const improved = simulate(buildFight('catfish', gearFor(5, 4, 4, 4), 5), 'reactive');
        expect(basic.result).toBe('landed');
        expect(improved.result).toBe('landed');
        expect(improved.elapsedSec).toBeLessThan(basic.elapsedSec);
        expect(improved.successfulReleases).toBeGreaterThanOrEqual(2);
    });
});

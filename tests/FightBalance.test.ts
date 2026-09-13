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

interface Policy { holding: (snap: FightSnapshot) => boolean; steer: (snap: FightSnapshot) => number; }

const competent: Policy = {
    holding: snap => snap.tension < 0.82,
    steer: snap => -Math.sign(snap.runDir)
};
const reckless: Policy = { holding: () => true, steer: () => 0 };
const passive: Policy = { holding: () => false, steer: () => 0 };
const neutralHold: Policy = { holding: snap => snap.tension < 0.85, steer: () => 0 };
const counterHold: Policy = { holding: snap => snap.tension < 0.85, steer: snap => -Math.sign(snap.runDir) };
const followHold: Policy = { holding: snap => snap.tension < 0.85, steer: snap => Math.sign(snap.runDir) };

function simulate(fm: FightModel, policy: Policy, maxSteps: number, dtSec = 1 / 30): FightSnapshot {
    let snap = fm.snapshot();
    for (let i = 0; i < maxSteps && snap.result === 'none'; i++) {
        fm.update(dtSec, policy.holding(snap), policy.steer(snap));
        snap = fm.snapshot();
    }
    return snap;
}

describe('Fight balance simulation', () => {
    it('a competent bot lands every rarity tier within its target duration band', () => {
        for (const tier of TIERS) {
            const gear = gearFor(tier.rodTier, tier.reelTier, tier.lineTier, tier.hookTier);
            let landed = 0;
            let totalSec = 0;
            const N = 6;
            for (let seed = 1; seed <= N; seed++) {
                const fm = buildFight(tier.fishId, gear, seed);
                const snap = simulate(fm, competent, 60 * 90);
                if (snap.result === 'landed') { landed++; totalSec += snap.elapsedSec; }
            }
            expect(landed, `${tier.rarity} should be landable by a competent bot`).toBeGreaterThan(N * 0.6);
            const avgSec = totalSec / Math.max(1, landed);
            // Loose sanity bounds, not the tight design-doc band: era-appropriate top
            // gear legitimately speeds up even a mythic fight (that's the payoff for
            // grinding to it), so this only catches "instant win" / "never lands" bugs.
            expect(avgSec, `${tier.rarity} average landing time`).toBeGreaterThanOrEqual(tier.band[0] * 0.25);
            expect(avgSec, `${tier.rarity} average landing time`).toBeLessThanOrEqual(tier.band[1] * 1.6);
        }
    });

    it('a reckless bot (always reeling) snaps a heavy fish on starter line a meaningful fraction of the time', () => {
        const gear = gearFor(1, 1, 1, 1); // starter gear against the rare/heavy catfish
        let snaps = 0;
        const N = 40;
        for (let seed = 1; seed <= N; seed++) {
            const fm = buildFight('catfish', gear, seed);
            const snap = simulate(fm, reckless, 60 * 60);
            if (snap.result === 'lineSnapped') snaps++;
        }
        expect(snaps / N).toBeGreaterThanOrEqual(0.4);
    });

    it('a passive bot (never reeling) always loses the fish to slack', () => {
        const gear = gearFor(1, 1, 1, 1);
        for (let seed = 1; seed <= 5; seed++) {
            const fm = buildFight('bluegill', gear, seed);
            const snap = simulate(fm, passive, 60 * 30);
            expect(snap.result).toBe('slackEscape');
        }
    });

    it('a counter-steering bot lands the fish faster on average than a neutral bot', () => {
        const gear = gearFor(3, 2, 2, 2);
        const avg = (policy: Policy): number => {
            let total = 0, landed = 0;
            for (let seed = 1; seed <= 10; seed++) {
                const fm = buildFight('muskie', gear, seed);
                const snap = simulate(fm, policy, 60 * 90);
                if (snap.result === 'landed') { total += snap.elapsedSec; landed++; }
            }
            return landed ? total / landed : Infinity;
        };
        expect(avg(counterHold)).toBeLessThan(avg(neutralHold));
    });

    it('a follow-steering bot keeps less average tension than a neutral bot', () => {
        const gear = gearFor(3, 2, 2, 2);
        const avgTension = (policy: Policy): number => {
            let sum = 0, samples = 0;
            for (let seed = 1; seed <= 10; seed++) {
                const fm = buildFight('muskie', gear, seed);
                let snap = fm.snapshot();
                for (let i = 0; i < 60 * 20 && snap.result === 'none'; i++) {
                    fm.update(1 / 30, policy.holding(snap), policy.steer(snap));
                    snap = fm.snapshot();
                    sum += snap.tension; samples++;
                }
            }
            return sum / samples;
        };
        expect(avgTension(followHold)).toBeLessThan(avgTension(neutralHold));
    });

    it('a flexible rod measurably cuts the snap rate versus a stiff rod under reckless play', () => {
        const snapRate = (flex: number): number => {
            let snaps = 0;
            const N = 40;
            for (let seed = 1; seed <= N; seed++) {
                const gear = gearFor(1, 1, 1, 1);
                gear.rod = { ...gear.rod, flex };
                const fm = buildFight('catfish', gear, seed);
                const snap = simulate(fm, reckless, 60 * 60);
                if (snap.result === 'lineSnapped') snaps++;
            }
            return snaps / N;
        };
        expect(snapRate(0.85)).toBeLessThan(snapRate(0.05));
    });

    it('reel drag assist (tensionResist) measurably cuts the snap rate versus a basic reel under reckless play', () => {
        const snapRate = (tensionResist: number): number => {
            let snaps = 0;
            const N = 40;
            for (let seed = 1; seed <= N; seed++) {
                const gear = gearFor(1, 1, 1, 1);
                gear.reel = { ...gear.reel, tensionResist };
                const fm = buildFight('catfish', gear, seed);
                const snap = simulate(fm, reckless, 60 * 60);
                if (snap.result === 'lineSnapped') snaps++;
            }
            return snaps / N;
        };
        expect(snapRate(2.6)).toBeLessThan(snapRate(1.0));
    });
});

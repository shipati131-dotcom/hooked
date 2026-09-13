import { describe, it, expect } from 'vitest';
import { Rng } from '../src/game/utils/rng';
import { FightModel, type FightGear } from '../src/game/systems/fishing/FightModel';
import type { FightProfile } from '../src/game/data/types';

const profile: FightProfile = {
    behaviorType: 'small', stamina: 0.5, strength: 0.5, aggression: 0.3, burstChance: 0.2, burstPower: 1,
    directionChangeFrequency: 5, recoveryRate: 0.05, hookDifficulty: 0.1, biteStyle: 'timid',
    moves: ['cruise', 'run', 'rest'], parSec: 8
};
const gear: FightGear = {
    rod: { control: 0, power: 1, rareLuck: 0, flex: 0.15 },
    reel: { captureSpeed: 1, tensionResist: 1 },
    line: { maxTension: 15, snapResist: 1, color: 0xffffff },
    hook: { windowMult: 1, directionForgiveness: 0, holdStrength: 0 }
};
const make = (p = profile, g = gear, seed = 1) => new FightModel(p, g, 0.5, {}, new Rng(seed));
function run(fm: FightModel, seconds: number, policy: boolean | 'correct', dt = 1 / 60) {
    for (let i = 0; i < seconds / dt && !fm.isDone(); i++) {
        fm.update(dt, policy === 'correct' ? fm.snapshot().requiredAction === 'pull' : policy);
    }
}
function toRelease(fm: FightModel) {
    while (fm.snapshot().requiredAction === 'pull') fm.update(1 / 60, true);
}

describe('Pull / release battle', () => {
    it('following the cues lands a fish after multiple windows with no escape risk', () => {
        const fm = make();
        run(fm, 45, 'correct');
        expect(fm.snapshot().result).toBe('landed');
        expect(fm.snapshot().successfulReleases).toBeGreaterThanOrEqual(2);
        expect(fm.snapshot().escapeRisk).toBe(0);
        expect(fm.isPerfect()).toBe(true);
    });
    it('always holding fails even against the gentlest tutorial fish', () => {
        const fm = make({ ...profile, strength: 0.1, aggression: 0.05, moves: ['cruise', 'rest'] });
        run(fm, 60, true);
        expect(fm.snapshot().result).toBe('lineSnapped');
    });
    it('never pulling loses the fish', () => {
        const fm = make();
        run(fm, 40, false);
        expect(fm.snapshot().result).toBe('slackEscape');
    });
    it('wrong pulls give the fish ground and raise escape risk', () => {
        const fm = make();
        toRelease(fm);
        const before = fm.snapshot();
        run(fm, 0.7, true);
        expect(fm.snapshot().distance).toBeGreaterThan(before.distance);
        expect(fm.snapshot().escapeRisk).toBeGreaterThan(0);
        expect(fm.snapshot().feedback).toBe('wrong-pull');
    });
    it('missing a pull window gives the fish ground and raises escape risk', () => {
        const fm = make();
        const before = fm.snapshot();
        run(fm, 0.7, false);
        expect(fm.snapshot().distance).toBeGreaterThan(before.distance);
        expect(fm.snapshot().escapeRisk).toBeGreaterThan(0);
        expect(fm.snapshot().feedback).toBe('missed-pull');
    });
    it('correctly releasing preserves distance and never punishes safe slack', () => {
        const fm = make();
        toRelease(fm);
        const before = fm.snapshot().distance;
        run(fm, 0.8, false);
        expect(fm.snapshot().distance).toBe(before);
        expect(fm.snapshot().escapeRisk).toBe(0);
        expect(fm.snapshot().feedback).toBe('safe-release');
    });
    it('allows time to react at both cue changes, without input-spamming resetting grace', () => {
        const fm = make();
        run(fm, 0.18, false);
        expect(fm.snapshot().escapeRisk).toBe(0);
        toRelease(fm);
        run(fm, 0.18, true);
        expect(fm.snapshot().escapeRisk).toBe(0);
        for (let i = 0; i < 60; i++) fm.update(1 / 60, i % 2 === 0);
        expect(fm.snapshot().escapeRisk).toBeGreaterThan(0);
    });
    it('lets a player recover from a brief mistake and still land, but not perfectly', () => {
        const fm = make();
        run(fm, 0.8, false);
        expect(fm.snapshot().escapeRisk).toBeGreaterThan(0);
        run(fm, 60, 'correct');
        expect(fm.snapshot().result).toBe('landed');
        expect(fm.isPerfect()).toBe(false);
    });
    it('does not depend on pointer position or steering', () => {
        const a = make(), b = make();
        for (let i = 0; i < 250; i++) {
            const pull = a.snapshot().requiredAction === 'pull';
            a.update(1 / 60, pull, -1);
            b.update(1 / 60, pull, 1);
        }
        expect(a.snapshot()).toEqual(b.snapshot());
    });
    it('has consistent outcomes at 30, 60 and 120fps', () => {
        const snapshots = [30, 60, 120].map(fps => {
            const fm = make(); run(fm, 60, 'correct', 1 / fps); return fm.snapshot();
        });
        for (const snap of snapshots) {
            expect(snap.result).toBe('landed');
            expect(snap.escapeRisk).toBe(0);
            expect(Math.abs(snap.elapsedSec - snapshots[0].elapsedSec)).toBeLessThan(0.25);
        }
    });
    it('ignores stalled time and cannot skip an entire cue on resume', () => {
        const fm = make();
        fm.update(30, false);
        expect(fm.snapshot().elapsedSec).toBeCloseTo(0.25);
        expect(fm.snapshot().result).toBe('none');
        expect(fm.snapshot().requiredAction).toBe('pull');
    });
    it('better rod control extends reaction time, and stronger gear reduces mistake damage', () => {
        const improved: FightGear = { ...gear, rod: { ...gear.rod, control: 0.5, flex: 0.8 },
            reel: { ...gear.reel, tensionResist: 2 }, line: { ...gear.line, snapResist: 2 } };
        const a = make(), b = make(profile, improved);
        expect(b.snapshot().reactionGraceRemaining).toBeGreaterThan(a.snapshot().reactionGraceRemaining);
        toRelease(a); toRelease(b);
        run(a, 0.8, true); run(b, 0.8, true);
        expect(b.snapshot().escapeRisk).toBeLessThan(a.snapshot().escapeRisk);
        expect(b.snapshot().distance).toBeGreaterThan(0);
    });
    it('solid hook sets reduce starting stamina and later boss phases retain the same cues', () => {
        const solid = new FightModel(profile, gear, 0.5, { startingStaminaFrac: 0.9 }, new Rng(1));
        expect(solid.snapshot().staminaFrac).toBe(0.9);
        const fm = make({ ...profile, phases: [{ staminaThreshold: 0.8, addMoves: ['jump'], aggressionMult: 1.2, label: 'SECOND WIND' }] });
        run(fm, 60, 'correct');
        expect(fm.snapshot().phaseIndex).toBe(1);
        expect(fm.snapshot().result).toBe('landed');
    });
});

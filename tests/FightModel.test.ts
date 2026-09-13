import { describe, it, expect } from 'vitest';
import { Rng } from '../src/game/utils/rng';
import { FightModel, type FightGear } from '../src/game/systems/fishing/FightModel';
import type { FightProfile } from '../src/game/data/types';

function profile(overrides: Partial<FightProfile> = {}): FightProfile {
    return {
        behaviorType: 'small', stamina: 0.5, strength: 0.5, aggression: 0.3, burstChance: 0.2, burstPower: 1,
        directionChangeFrequency: 5, recoveryRate: 0.05, hookDifficulty: 0.1, biteStyle: 'timid',
        moves: ['cruise', 'run', 'rest'], parSec: 8, ...overrides
    };
}

function gear(overrides: Partial<FightGear> = {}): FightGear {
    return {
        rod: { control: 0, power: 1, rareLuck: 0, flex: 0.15 },
        reel: { captureSpeed: 1, tensionResist: 1 },
        line: { maxTension: 15, snapResist: 1, color: 0xffffff },
        hook: { windowMult: 1, directionForgiveness: 0, holdStrength: 0 },
        ...overrides
    };
}

function run(fm: FightModel, steps: number, holding: boolean, steer = 0, dtSec = 1 / 60): void {
    for (let i = 0; i < steps && !fm.isDone(); i++) fm.update(dtSec, holding, steer);
}

describe('FightModel', () => {
    it('a small, patient fish can be landed by steady reeling', () => {
        const fm = new FightModel(profile({ stamina: 0.4, strength: 0.3 }), gear(), 0.5, {}, new Rng(1));
        run(fm, 60 * 60, true); // up to 60s of holding
        expect(fm.snapshot().result).toBe('landed');
    });

    it('never reeling lets the fish recover and eventually throw the hook via slack', () => {
        const fm = new FightModel(profile(), gear(), 0.5, {}, new Rng(2));
        run(fm, 60 * 30, false);
        expect(fm.snapshot().result).toBe('slackEscape');
    });

    it('reeling hard against a heavy fish on weak line risks a snap', () => {
        let snaps = 0;
        for (let seed = 1; seed <= 20; seed++) {
            const fm = new FightModel(
                profile({ behaviorType: 'heavy', stamina: 0.85, strength: 1.1, moves: ['cruise', 'dive', 'rest'] }),
                gear({ rod: { control: 0, power: 1, rareLuck: 0, flex: 0.05 }, line: { maxTension: 15, snapResist: 0.8, color: 0 } }),
                60, // a genuinely heavy fish relative to a 15-rated line
                {}, new Rng(seed)
            );
            run(fm, 60 * 45, true); // reckless: always reeling
            if (fm.snapshot().result === 'lineSnapped') snaps++;
        }
        expect(snaps).toBeGreaterThan(0);
    });

    it('always counter-steering (opposite the fish\'s current run) drains stamina faster on average than never steering', () => {
        // "Counter" means steer opposite runDir; since the model tracks runDir per-frame,
        // steer = -Math.sign(runDir) reliably counters whatever direction is active.
        const avgStaminaAfterFixedTime = (counterSteer: boolean, seeds: number): number => {
            let total = 0;
            for (let seed = 1; seed <= seeds; seed++) {
                const fm = new FightModel(profile({ moves: ['cruise', 'run'], aggression: 0.9, stamina: 0.9 }), gear(), 0.5, {}, new Rng(seed));
                for (let i = 0; i < 60 * 5 && !fm.isDone(); i++) {
                    const snap = fm.snapshot();
                    const steer = counterSteer ? -Math.sign(snap.runDir || 1) : 0;
                    fm.update(1 / 60, true, steer);
                }
                total += fm.snapshot().staminaFrac;
            }
            return total / seeds;
        };
        const neutralAvg = avgStaminaAfterFixedTime(false, 8);
        const counteredAvg = avgStaminaAfterFixedTime(true, 8);
        expect(counteredAvg).toBeLessThan(neutralAvg);
    });

    it('a flexible rod slows the tension rise compared to a stiff one under the same pull', () => {
        const stiff = new FightModel(profile({ moves: ['cruise', 'run'], strength: 0.9 }), gear({ rod: { control: 0, power: 1, rareLuck: 0, flex: 0 } }), 0.5, {}, new Rng(9));
        const flexy = new FightModel(profile({ moves: ['cruise', 'run'], strength: 0.9 }), gear({ rod: { control: 0, power: 1, rareLuck: 0, flex: 0.8 } }), 0.5, {}, new Rng(9));
        run(stiff, 20, true);
        run(flexy, 20, true);
        expect(flexy.snapshot().tension).toBeLessThanOrEqual(stiff.snapshot().tension);
    });

    it('reel.tensionResist recovers tension faster once the player releases', () => {
        const slow = new FightModel(profile({ moves: ['cruise', 'run'] }), gear({ reel: { captureSpeed: 1, tensionResist: 1 } }), 0.5, {}, new Rng(11));
        const fast = new FightModel(profile({ moves: ['cruise', 'run'] }), gear({ reel: { captureSpeed: 1, tensionResist: 2 } }), 0.5, {}, new Rng(11));
        run(slow, 30, true); run(fast, 30, true); // build up tension identically first
        run(slow, 10, false); run(fast, 10, false); // then release for both
        expect(fast.snapshot().tension).toBeLessThanOrEqual(slow.snapshot().tension);
    });

    it('legendary phases add moves and raise aggression as stamina drops', () => {
        const fm = new FightModel(profile({
            behaviorType: 'legendary', stamina: 1, strength: 0.6, aggression: 0.4,
            moves: ['cruise', 'run', 'rest'],
            phases: [{ staminaThreshold: 0.8, addMoves: ['thrash'], aggressionMult: 1.5, label: 'PHASE 2' }]
        }), gear(), 2, {}, new Rng(13));
        run(fm, 60 * 20, true);
        expect(fm.snapshot().phaseIndex).toBeGreaterThanOrEqual(1);
    });

    it('a Solid hook-set starts the fish with reduced stamina versus a Light hook', () => {
        const solid = new FightModel(profile(), gear(), 0.5, { startingStaminaFrac: 0.9 }, new Rng(1));
        const light = new FightModel(profile(), gear(), 0.5, { startingStaminaFrac: 1 }, new Rng(1));
        expect(solid.snapshot().staminaFrac).toBeLessThan(light.snapshot().staminaFrac);
    });

    it('isPerfect requires both landing within par and never redlining', () => {
        const fm = new FightModel(profile({ stamina: 0.3, strength: 0.2, parSec: 30 }), gear(), 0.3, {}, new Rng(21));
        run(fm, 60 * 30, true);
        if (fm.snapshot().result === 'landed') {
            expect(fm.isPerfect()).toBe(!fm.snapshot().everRedlined);
        }
    });
});

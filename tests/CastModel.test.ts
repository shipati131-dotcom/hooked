import { describe, it, expect } from 'vitest';
import { Rng } from '../src/game/utils/rng';
import { CastModel } from '../src/game/systems/fishing/CastModel';
import type { RodStats } from '../src/game/data/types';

const rod: RodStats = { control: 0, power: 1, rareLuck: 0, flex: 0.15 };

describe('CastModel', () => {
    it('ping-pongs the power needle between 0 and 1 while charging', () => {
        const cast = new CastModel(new Rng(1));
        cast.startCharge();
        let sawRise = false, sawFall = false;
        let prev = cast.power;
        for (let i = 0; i < 400; i++) {
            cast.updateCharge(0.016);
            if (cast.power > prev) sawRise = true;
            if (cast.power < prev) sawFall = true;
            prev = cast.power;
            expect(cast.power).toBeGreaterThanOrEqual(0);
            expect(cast.power).toBeLessThanOrEqual(1);
        }
        expect(sawRise).toBe(true);
        expect(sawFall).toBe(true);
    });

    it('lands closer to the target the more precisely power matches what the distance needs', () => {
        const cast = new CastModel(new Rng(2));
        const reach = cast.reachFor(rod);
        const targetDist = reach * 0.5;
        const required = cast.requiredPower(targetDist, rod);

        cast.startCharge();
        cast.power = required; // release exactly on target
        const perfect = cast.release(targetDist, rod);
        expect(perfect.quality).toBe('perfect');
        expect(perfect.landDistPx).toBeCloseTo(targetDist, 0);

        cast.startCharge();
        cast.power = clampTest(required - 0.3);
        const short = cast.release(targetDist, rod);
        expect(short.quality).toBe('short');
        expect(short.landDistPx).toBeLessThan(targetDist);
    });

    it('flags a target beyond the rod\'s reach as out of reach', () => {
        const cast = new CastModel(new Rng(3));
        const reach = cast.reachFor(rod);
        cast.startCharge();
        cast.power = 1;
        const result = cast.release(reach * 1.8, rod);
        expect(result.quality).toBe('outOfReach');
    });

    it('a better rod reaches further', () => {
        const cast = new CastModel(new Rng(4));
        const basic = cast.reachFor(rod);
        const upgraded = cast.reachFor({ ...rod, power: 2.8 });
        expect(upgraded).toBeGreaterThan(basic);
    });

    it('landing on a hotspot grants luck and a bite-speed bonus', () => {
        const cast = new CastModel(new Rng(5));
        const hotspots = cast.getHotspots();
        const target = hotspots[0].distPx;
        const required = cast.requiredPower(target, rod);
        cast.startCharge();
        cast.power = required;
        const result = cast.release(target, rod);
        expect(result.hitHotspot).toBe(true);
        expect(result.luckBonus).toBeGreaterThan(0);
        expect(result.biteSpeedMult).toBeLessThan(1);
    });

    it('relocates hotspots after the relocation interval', () => {
        const cast = new CastModel(new Rng(6));
        const before = cast.getHotspots().map(h => h.distPx);
        cast.tick(20); // past hotspotRelocateSec
        const after = cast.getHotspots().map(h => h.distPx);
        expect(after).not.toEqual(before);
    });
});

function clampTest(v: number): number { return Math.max(0, Math.min(1, v)); }

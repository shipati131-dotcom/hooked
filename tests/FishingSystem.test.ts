import { describe, it, expect } from 'vitest';
import { FishingSystem, type CastContext } from '../src/game/systems/FishingSystem';

function makeCtx(overrides: Partial<CastContext> = {}): CastContext {
    return {
        locationId: 'pond',
        loadout: {
            rod: { control: 0, power: 1, rareLuck: 0 },
            reel: { captureSpeed: 1, tensionResist: 1 },
            line: { maxTension: 15, snapResist: 1, color: 0xffffff },
            bait: { biteSpeed: 1, rarityLuck: 0, habitatAffinity: {} },
            bobber: { skinColor: 0xffffff }
        },
        luck: { rodRareLuck: 0, baitRarityLuck: 0, luckyHookBonus: 0 },
        discovered: new Set(), fishSenseLevel: 0, castsSinceRareOrBetter: 0,
        totalCaught: 10, quickBiteBonus: 0, strongArmsBonus: 0, ...overrides
    };
}

function driveToReeling(fs: FishingSystem, ctx = makeCtx()): void {
    fs.startCast(ctx, 800);
    fs.onSplashLanded();
    const wait = fs as unknown as { waitElapsed: number; waitTarget: number; nibbleTimes: number[] };
    wait.waitElapsed = 999999;
    wait.nibbleTimes = [];
    fs.update(0, false);
    expect(fs.state).toBe('bite');
    fs.attemptHook();
    expect(fs.state).toBe('reeling');
}

function landAccurateStroke(fs: FishingSystem): void {
    const internal = fs as unknown as { phaseDuration: number };
    internal.phaseDuration = 99;
    const target = (fs.snapshot().sweetSpotStart + fs.snapshot().sweetSpotEnd) / 2;
    for (let i = 0; i < 200 && fs.snapshot().charge < target; i++) fs.update(8, true);
    fs.update(8, false);
}

describe('FishingSystem reel-stroke duel', () => {
    it('reaches the duel through cast, bite, and deliberate hook input', () => {
        const fs = new FishingSystem();
        driveToReeling(fs);
    });

    it('turns an accurately timed release into progress and a perfect streak', () => {
        const fs = new FishingSystem();
        driveToReeling(fs);
        const before = fs.snapshot().meter;
        landAccurateStroke(fs);
        const after = fs.snapshot();
        expect(after.pulseResult).toBe('perfect');
        expect(after.combo).toBe(1);
        expect(after.meter).toBeGreaterThan(before);
    });

    it('lands a fish by chaining accurate reel strokes', () => {
        const fs = new FishingSystem();
        driveToReeling(fs);
        let succeeded = false;
        fs.on('reelSuccess', () => { succeeded = true; });
        for (let i = 0; i < 12 && fs.state === 'reeling'; i++) landAccurateStroke(fs);
        expect(succeeded).toBe(true);
        expect(fs.state).toBe('idle');
    });

    it('penalizes an overcranked stroke and locks it until release', () => {
        const fs = new FishingSystem();
        driveToReeling(fs);
        const internal = fs as unknown as { phaseDuration: number };
        internal.phaseDuration = 99;
        for (let i = 0; i < 300 && fs.snapshot().pulseResult !== 'overload'; i++) fs.update(12, true);
        const overloaded = fs.snapshot();
        expect(overloaded.pulseResult).toBe('overload');
        expect(overloaded.tension).toBeGreaterThan(0);
        expect(overloaded.combo).toBe(0);
        fs.update(16, false);
        expect(fs.snapshot().charge).toBe(0);
    });

    it('telegraphs a run and rewards giving slack instead of reeling', () => {
        const fs = new FishingSystem();
        driveToReeling(fs);
        const internal = fs as unknown as { phaseElapsed: number; phaseDuration: number; tension: number };
        internal.phaseElapsed = 0;
        internal.phaseDuration = 0.001;
        internal.tension = 0.25;
        fs.update(16, true);
        expect(fs.snapshot().phase).toBe('surge');
        const strained = fs.snapshot().tension;
        expect(strained).toBeGreaterThan(0.25);
        fs.update(240, false);
        expect(fs.snapshot().tension).toBeLessThan(strained);
    });

    it('snaps a highly strained line when the player reels into a run', () => {
        const fs = new FishingSystem();
        driveToReeling(fs);
        const internal = fs as unknown as { battlePhase: 'surge'; phaseDuration: number; tension: number };
        internal.battlePhase = 'surge';
        internal.phaseDuration = 99;
        internal.tension = 0.99;
        let snapped = false;
        fs.on('reelFail', (...args: unknown[]) => { snapped = (args[0] as { lineSnapped: boolean }).lineSnapped; });
        fs.update(100, true);
        expect(snapped).toBe(true);
        expect(fs.state).toBe('idle');
    });

    it('widens the strike window when rod control improves', () => {
        const basic = new FishingSystem();
        driveToReeling(basic);
        const pro = new FishingSystem();
        driveToReeling(pro, makeCtx({ loadout: { ...makeCtx().loadout, rod: { control: 12, power: 1, rareLuck: 0 } } }));
        const basicWidth = basic.snapshot().sweetSpotEnd - basic.snapshot().sweetSpotStart;
        const proWidth = pro.snapshot().sweetSpotEnd - pro.snapshot().sweetSpotStart;
        expect(proWidth).toBeGreaterThan(basicWidth);
    });
});

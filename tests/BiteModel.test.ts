import { describe, it, expect } from 'vitest';
import { Rng } from '../src/game/utils/rng';
import { BiteModel } from '../src/game/systems/fishing/BiteModel';
import type { BaitStats, HookStats } from '../src/game/data/types';

const bait: BaitStats = { biteSpeed: 1, rarityLuck: 0, habitatAffinity: {} };
const greedyBait: BaitStats = { biteSpeed: 1.3, rarityLuck: 0, habitatAffinity: {} };
const basicHook: HookStats = { windowMult: 1, directionForgiveness: 0, holdStrength: 0 };
const forgivingHook: HookStats = { windowMult: 1.5, directionForgiveness: 1, holdStrength: 0.8 };

function driveToRealPlunge(bm: BiteModel, stepMs = 20, maxSteps = 3000): void {
    for (let i = 0; i < maxSteps && !bm.isRealPlungeFired(); i++) bm.update(stepMs);
}
function driveIntoStrikeWindow(bm: BiteModel, stepMs = 20, maxSteps = 500): void {
    for (let i = 0; i < maxSteps && !bm.isInStrikeWindow(); i++) bm.update(stepMs);
}

describe('BiteModel', () => {
    it('eventually fires the real plunge for every bite style', () => {
        const styles = ['timid', 'greedy', 'cautious', 'runner', 'trickster', 'ominous'] as const;
        for (const style of styles) {
            const bm = new BiteModel(style, 0.5, bait, basicHook, 10, new Rng(1));
            driveToRealPlunge(bm);
            expect(bm.isRealPlungeFired()).toBe(true);
        }
    });

    it('a plain tap before hookDifficulty gates direction still lands a hook', () => {
        const bm = new BiteModel('greedy', 0.1, bait, basicHook, 20, new Rng(2));
        driveIntoStrikeWindow(bm);
        const result = bm.attemptStrike(null, false);
        expect(['solidHook', 'lightHook']).toContain(result.outcome);
    });

    it('a fast, correctly-directed swipe against a high-hookDifficulty fish sets a solid hook', () => {
        const bm = new BiteModel('runner', 0.6, bait, basicHook, 20, new Rng(3));
        driveIntoStrikeWindow(bm);
        const wrongDir = bm.currentPullDir();
        const correctSwipe = wrongDir === 1 ? -1 : 1;
        const result = bm.attemptStrike(correctSwipe, false);
        expect(result.outcome).toBe('solidHook');
    });

    it('striking the wrong direction on a high-hookDifficulty fish loses it, unless the hook forgives', () => {
        const strict = new BiteModel('runner', 0.6, bait, basicHook, 20, new Rng(4));
        driveIntoStrikeWindow(strict);
        const dir = strict.currentPullDir();
        const wrongSwipe = dir === 1 ? 1 : -1; // same as the pull direction = wrong
        expect(strict.attemptStrike(wrongSwipe, false).outcome).toBe('wrongDirection');

        const forgiven = new BiteModel('runner', 0.6, bait, forgivingHook, 20, new Rng(4));
        driveIntoStrikeWindow(forgiven);
        const dir2 = forgiven.currentPullDir();
        const result = forgiven.attemptStrike(dir2 === 1 ? 1 : -1, false);
        expect(result.outcome).toBe('lightHook'); // directionForgiveness: 1 always downgrades instead of losing the fish
    });

    it('striking a false plunge spooks the fish outside the tutorial grace window', () => {
        const bm = new BiteModel('trickster', 0.5, bait, basicHook, 30, new Rng(5));
        let firedFalsePlunge = false;
        for (let i = 0; i < 3000 && !firedFalsePlunge; i++) {
            const cues = bm.update(20);
            if (cues.some(c => c.kind === 'falsePlunge')) firedFalsePlunge = true;
        }
        expect(firedFalsePlunge).toBe(true);
        expect(bm.attemptStrike(null, false).outcome).toBe('spooked');
    });

    it('striking a false plunge during the tutorial grace warns instead of spooking', () => {
        const bm = new BiteModel('trickster', 0.5, bait, basicHook, 1, new Rng(6));
        for (let i = 0; i < 3000; i++) {
            const cues = bm.update(20);
            if (cues.some(c => c.kind === 'falsePlunge')) break;
        }
        expect(bm.attemptStrike(null, true).outcome).toBe('warned');
    });

    it('missing the strike window entirely is reported as missed', () => {
        const bm = new BiteModel('greedy', 0.2, bait, basicHook, 20, new Rng(7));
        for (let i = 0; i < 3000 && !bm.hasMissedWindow(); i++) bm.update(20);
        expect(bm.hasMissedWindow()).toBe(true);
    });

    it('a greedy bait widens the strike window', () => {
        const basic = new BiteModel('greedy', 0.2, bait, basicHook, 20, new Rng(8));
        const greedy = new BiteModel('greedy', 0.2, greedyBait, basicHook, 20, new Rng(8));
        driveIntoStrikeWindow(basic);
        driveIntoStrikeWindow(greedy);
        expect(greedy.windowRemainingMs()).toBeGreaterThan(basic.windowRemainingMs());
    });
});

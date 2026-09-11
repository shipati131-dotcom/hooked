import { describe, it, expect } from 'vitest';
import { createDefaultSave, GameBus } from '../src/game/core/GameState';
import { EconomySystem } from '../src/game/systems/EconomySystem';
import { getFish } from '../src/game/data/fish';

describe('EconomySystem', () => {
    it('adds and spends coins correctly', () => {
        const save = createDefaultSave();
        const econ = new EconomySystem(save, new GameBus());
        econ.addCoins(100);
        expect(econ.coins).toBe(100);
        expect(econ.spend(40)).toBe(true);
        expect(econ.coins).toBe(60);
        expect(econ.spend(1000)).toBe(false);
        expect(econ.coins).toBe(60);
    });

    it('values a heavier fish of the same species more than a lighter one', () => {
        const save = createDefaultSave();
        const econ = new EconomySystem(save, new GameBus());
        const bass = getFish('bass');
        const light = econ.fishValue(bass, bass.minWeight, 'Small', 'pond', 1);
        const heavy = econ.fishValue(bass, bass.maxWeight, 'Record', 'pond', 1);
        expect(heavy).toBeGreaterThan(light);
    });

    it('values fish more highly in later, tougher locations', () => {
        const save = createDefaultSave();
        const econ = new EconomySystem(save, new GameBus());
        const bass = getFish('bass');
        const avg = (bass.minWeight + bass.maxWeight) / 2;
        const pondValue = econ.fishValue(bass, avg, 'Average', 'pond', 1);
        const oceanValue = econ.fishValue(bass, avg, 'Average', 'ocean', 1);
        expect(oceanValue).toBeGreaterThan(pondValue);
    });

    it('golden touch multiplier increases sell value', () => {
        const save = createDefaultSave();
        const econ = new EconomySystem(save, new GameBus());
        const bass = getFish('bass');
        const base = econ.fishValue(bass, bass.minWeight, 'Average', 'pond', 1);
        const boosted = econ.fishValue(bass, bass.minWeight, 'Average', 'pond', 1.2);
        expect(boosted).toBeGreaterThan(base);
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { SaveSystem } from '../src/game/systems/SaveSystem';
import { createDefaultSave } from '../src/game/core/GameState';
import { SAVE_KEY, SAVE_BACKUP_KEY } from '../src/game/constants';

describe('SaveSystem', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns fresh defaults when nothing is saved yet', () => {
        const save = new SaveSystem();
        const data = save.load();
        expect(data.coins).toBe(0);
        expect(data.level).toBe(1);
        expect(data.unlockedLocations).toEqual(['pond']);
    });

    it('round-trips a saved game exactly', () => {
        const save = new SaveSystem();
        const data = createDefaultSave();
        data.coins = 500;
        data.level = 5;
        save.saveNow(data);

        const loaded = save.load();
        expect(loaded.coins).toBe(500);
        expect(loaded.level).toBe(5);
    });

    it('merges missing fields from an older save onto current defaults', () => {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, coins: 42 }));
        const save = new SaveSystem();
        const loaded = save.load();
        expect(loaded.coins).toBe(42);
        expect(loaded.stats).toBeDefined();
        expect(loaded.stats.totalCaught).toBe(0);
        expect(loaded.equipped.rod).toBe('rod-old');
    });

    it('backs up and recovers from a corrupt save instead of crashing', () => {
        localStorage.setItem(SAVE_KEY, '{not valid json');
        const save = new SaveSystem();
        const loaded = save.load();
        expect(loaded.coins).toBe(0);
        expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBe('{not valid json');
    });

    it('reset clears the save key', () => {
        const save = new SaveSystem();
        save.saveNow(createDefaultSave());
        expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
        save.reset();
        expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    });
});

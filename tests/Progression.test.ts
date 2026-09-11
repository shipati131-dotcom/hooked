import { describe, it, expect } from 'vitest';
import { BALANCE } from '../src/game/data/balance';
import { createDefaultSave } from '../src/game/core/GameState';
import { GameBus } from '../src/game/core/GameState';
import { ProgressionSystem } from '../src/game/systems/ProgressionSystem';
import { EVENTS } from '../src/game/core/events';

describe('XP curve', () => {
    it('requires steadily more XP per level without exploding', () => {
        let prev = BALANCE.xp.toNext(1);
        for (let lvl = 2; lvl <= 50; lvl++) {
            const next = BALANCE.xp.toNext(lvl);
            expect(next).toBeGreaterThanOrEqual(prev);
            prev = next;
        }
    });

    it('keeps level 1->2 achievable in just a few common catches', () => {
        // A common pond catch is worth roughly 8-10 xp; the first level should
        // take only a handful of catches so the opening minutes feel fast.
        const need = BALANCE.xp.toNext(1);
        expect(need / 9).toBeLessThan(12);
    });
});

describe('ProgressionSystem', () => {
    it('levels up and carries over leftover XP', () => {
        const save = createDefaultSave();
        const bus = new GameBus();
        const prog = new ProgressionSystem(save, bus);
        let leveledTo = 0;
        bus.on(EVENTS.LEVEL_UP, (...args: unknown[]) => { leveledTo = (args[0] as { level: number }).level; });

        const need = prog.xpToNext();
        prog.addXp(need + 5);

        expect(save.level).toBe(2);
        expect(leveledTo).toBe(2);
        expect(save.xp).toBe(5);
    });

    it('handles multiple level-ups from one large XP grant', () => {
        const save = createDefaultSave();
        const bus = new GameBus();
        const prog = new ProgressionSystem(save, bus);
        prog.addXp(100000);
        expect(save.level).toBeGreaterThan(2);
    });

    it('never levels past the configured max level', () => {
        const save = createDefaultSave();
        save.level = BALANCE.xp.maxLevel;
        const bus = new GameBus();
        const prog = new ProgressionSystem(save, bus);
        prog.addXp(10_000_000);
        expect(save.level).toBe(BALANCE.xp.maxLevel);
    });
});

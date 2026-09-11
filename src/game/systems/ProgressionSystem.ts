import { BALANCE } from '../data/balance';
import type { SaveData } from '../core/GameState';
import { GameBus } from '../core/GameState';
import { EVENTS } from '../core/events';

/** XP, leveling, and unlock queries. Emits LEVEL_UP / XP_CHANGED via the bus. */
export class ProgressionSystem {
    constructor(private save: SaveData, private bus: GameBus) {}

    xpToNext(level = this.save.level): number {
        return BALANCE.xp.toNext(level);
    }

    addXp(amount: number): void {
        if (amount <= 0 || this.save.level >= BALANCE.xp.maxLevel) return;
        this.save.xp += amount;
        let leveledUp = false;
        while (this.save.level < BALANCE.xp.maxLevel && this.save.xp >= this.xpToNext()) {
            this.save.xp -= this.xpToNext();
            this.save.level += 1;
            leveledUp = true;
        }
        this.bus.emit(EVENTS.XP_CHANGED, { xp: this.save.xp, level: this.save.level, xpToNext: this.xpToNext(), delta: amount });
        if (leveledUp) this.bus.emit(EVENTS.LEVEL_UP, { level: this.save.level });
    }

    get level(): number { return this.save.level; }
    get xp(): number { return this.save.xp; }
    get xpProgress(): number { return this.save.level >= BALANCE.xp.maxLevel ? 1 : this.save.xp / this.xpToNext(); }
}

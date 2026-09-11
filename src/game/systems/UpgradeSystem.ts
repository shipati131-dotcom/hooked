import type { SaveData } from '../core/GameState';
import { GameBus } from '../core/GameState';
import { EVENTS } from '../core/events';
import { PERKS, getPerk, perkCost } from '../data/upgrades';

export class UpgradeSystem {
    constructor(private save: SaveData, private bus: GameBus) {}

    level(perkId: string): number {
        return this.save.perkLevels[perkId] ?? 0;
    }

    nextCost(perkId: string): number {
        return perkCost(getPerk(perkId), this.level(perkId));
    }

    isMaxed(perkId: string): boolean {
        return this.level(perkId) >= getPerk(perkId).maxLevel;
    }

    buyLevel(perkId: string, spend: (price: number) => boolean): boolean {
        if (this.isMaxed(perkId)) return false;
        const cost = this.nextCost(perkId);
        if (!spend(cost)) return false;
        this.save.perkLevels[perkId] = this.level(perkId) + 1;
        this.bus.emit(EVENTS.PERK_UPGRADED, { perkId, level: this.save.perkLevels[perkId] });
        return true;
    }

    effect(perkId: string): number {
        const perk = getPerk(perkId);
        return this.level(perkId) * perk.effectPerLevel;
    }

    // Convenience accessors used by other systems
    get luckyHook(): number { return this.effect('lucky-hook'); }
    get quickBite(): number { return this.effect('quick-bite'); }
    get strongArms(): number { return this.effect('strong-arms'); }
    get fishSenseLevel(): number { return this.level('fish-sense'); }
    get goldenTouchMult(): number { return 1 + this.effect('golden-touch'); }
    get xpHunterMult(): number { return 1 + this.effect('xp-hunter'); }

    all() { return PERKS; }
}

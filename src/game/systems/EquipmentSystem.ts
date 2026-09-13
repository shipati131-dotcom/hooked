import type { SaveData } from '../core/GameState';
import { GameBus } from '../core/GameState';
import { EVENTS } from '../core/events';
import { ALL_EQUIPMENT, getEquipment } from '../data/equipment';
import type { EquipmentCategory, RodStats, ReelStats, LineStats, BaitStats, BobberStats, HookStats } from '../data/types';

export interface LoadoutStats {
    rod: RodStats;
    reel: ReelStats;
    line: LineStats;
    bait: BaitStats;
    bobber: BobberStats;
    hook: HookStats;
}

export class EquipmentSystem {
    constructor(private save: SaveData, private bus: GameBus) {}

    isOwned(id: string): boolean {
        const def = getEquipment(id);
        return def.price === 0 || this.save.ownedEquipment.includes(id);
    }

    isEquipped(id: string): boolean {
        const def = getEquipment(id);
        return this.save.equipped[def.category] === id;
    }

    isUnlockedByLevel(id: string): boolean {
        return getEquipment(id).unlockLevel <= this.save.level;
    }

    buy(id: string, spend: (price: number) => boolean): boolean {
        const def = getEquipment(id);
        if (this.isOwned(id)) return false;
        if (!this.isUnlockedByLevel(id)) return false;
        if (!spend(def.price)) return false;
        this.save.ownedEquipment.push(id);
        this.save.stats.equipmentPurchased += 1;
        this.recalcCategoriesUpgraded();
        this.bus.emit(EVENTS.ITEM_PURCHASED, { itemId: id });
        return true;
    }

    equip(id: string): boolean {
        const def = getEquipment(id);
        if (!this.isOwned(id)) return false;
        this.save.equipped[def.category] = id;
        this.bus.emit(EVENTS.EQUIP_CHANGED, { category: def.category, itemId: id });
        return true;
    }

    private recalcCategoriesUpgraded(): void {
        const categories: EquipmentCategory[] = ['rod', 'reel', 'line', 'bait', 'bobber', 'hook'];
        let count = 0;
        for (const cat of categories) {
            const owned = ALL_EQUIPMENT.filter(e => e.category === cat && this.isOwned(e.id));
            if (owned.length > 1) count++;
        }
        this.save.stats.categoriesUpgraded = count;
    }

    getLoadout(): LoadoutStats {
        return {
            rod: getEquipment(this.save.equipped.rod).stats as RodStats,
            reel: getEquipment(this.save.equipped.reel).stats as ReelStats,
            line: getEquipment(this.save.equipped.line).stats as LineStats,
            bait: getEquipment(this.save.equipped.bait).stats as BaitStats,
            bobber: getEquipment(this.save.equipped.bobber).stats as BobberStats,
            hook: getEquipment(this.save.equipped.hook).stats as HookStats
        };
    }
}

import { BALANCE } from '../data/balance';
import type { SaveData } from '../core/GameState';
import { GameBus } from '../core/GameState';
import { EVENTS } from '../core/events';
import type { FishDef } from '../data/types';
import { getLocation } from '../data/locations';

export class EconomySystem {
    constructor(private save: SaveData, private bus: GameBus) {}

    get coins(): number { return this.save.coins; }

    canAfford(price: number): boolean { return this.save.coins >= price; }

    addCoins(amount: number, recordEarned = true): void {
        if (amount === 0) return;
        this.save.coins = Math.max(0, this.save.coins + amount);
        if (amount > 0 && recordEarned) this.save.stats.totalCoinsEarned += amount;
        this.bus.emit(EVENTS.COINS_CHANGED, { coins: this.save.coins, delta: amount });
    }

    spend(amount: number): boolean {
        if (!this.canAfford(amount)) return false;
        this.addCoins(-amount, false);
        return true;
    }

    /** Value = baseValue * (weight/avgWeight)^exp * sizeLabelMult * location.valueMult * goldenTouchMult */
    fishValue(fish: FishDef, weight: number, sizeLabel: string, locationId: string, goldenTouchMult: number): number {
        const avgWeight = (fish.minWeight + fish.maxWeight) / 2;
        const weightMult = Math.pow(Math.max(0.05, weight / Math.max(0.01, avgWeight)), BALANCE.economy.weightValueExp);
        const sizeMult = BALANCE.economy.sizeLabelValueMult[sizeLabel] ?? 1;
        const loc = getLocation(locationId);
        return Math.round(fish.baseValue * weightMult * sizeMult * loc.valueMult * goldenTouchMult);
    }
}

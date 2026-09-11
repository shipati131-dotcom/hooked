import type { SaveData } from '../core/GameState';
import { GameBus } from '../core/GameState';
import { EVENTS } from '../core/events';
import { ACHIEVEMENTS, getAchievement } from '../data/achievements';
import { FISH } from '../data/fish';
import type { AchievementCondition } from '../data/types';

export class AchievementSystem {
    constructor(
        private save: SaveData,
        private bus: GameBus,
        private awardCoins: (n: number) => void,
        private awardXp: (n: number) => void
    ) {}

    isUnlocked(id: string): boolean { return this.save.achievementsUnlocked.includes(id); }

    /** Call after any state change that could satisfy an achievement (catch, purchase, level up, etc). */
    checkAll(): void {
        for (const def of ACHIEVEMENTS) {
            if (this.isUnlocked(def.id)) continue;
            if (this.evaluate(def.condition)) this.unlock(def.id);
        }
    }

    private evaluate(cond: AchievementCondition): boolean {
        const s = this.save.stats;
        switch (cond.type) {
            case 'stat': return (s as unknown as Record<string, number>)[cond.stat] >= cond.gte;
            case 'rarityCaught': return this.rarityCaughtCount(cond.rarity) >= cond.gte;
            case 'speciesDiscovered': return Object.keys(this.save.fishRecords).length >= cond.gte;
            case 'allSpeciesDiscovered': return Object.keys(this.save.fishRecords).length >= FISH.length;
            case 'level': return this.save.level >= cond.gte;
            case 'locationsUnlocked': return this.save.unlockedLocations.length >= cond.gte;
            case 'perkLevel': return (this.save.perkLevels[cond.perkId] ?? 0) >= cond.gte;
        }
    }

    private rarityCaughtCount(rarity: string): number {
        let total = 0;
        for (const [fishId, count] of Object.entries(this.save.stats.speciesCaughtCount)) {
            const fish = FISH.find(f => f.id === fishId);
            if (fish && fish.rarity === rarity) total += count;
        }
        return total;
    }

    private unlock(id: string): void {
        this.save.achievementsUnlocked.push(id);
        const def = getAchievement(id);
        if (def.rewardCoins) this.awardCoins(def.rewardCoins);
        if (def.rewardXp) this.awardXp(def.rewardXp);
        this.bus.emit(EVENTS.ACHIEVEMENT_UNLOCKED, { id });
    }

    all() { return ACHIEVEMENTS; }
}

import type { SaveData } from '../core/GameState';
import type { CatchResult, EscapeResult } from '../core/events';

/** Pure bookkeeping of running statistics, used by achievements and the stats screen. */
export class StatsSystem {
    constructor(private save: SaveData) {}

    private playtimeAnchor = performance.now();

    recordCatch(result: CatchResult): void {
        const s = this.save.stats;
        s.totalCaught += 1;
        s.totalWeightKg += result.weight;
        if (result.weight > s.biggestFishKg) {
            s.biggestFishKg = result.weight;
            s.biggestFishId = result.fish.id;
        }
        if (result.fish.rarity === 'legendary') s.legendaryCaught += 1;
        if (result.fish.rarity === 'mythic') s.mythicCaught += 1;
        if (result.perfect) s.perfectCatches += 1;
        s.speciesCaughtCount[result.fish.id] = (s.speciesCaughtCount[result.fish.id] ?? 0) + 1;
        s.currentCatchStreak += 1;
        if (s.currentCatchStreak > s.bestCatchStreak) s.bestCatchStreak = s.currentCatchStreak;
        if (result.fish.rarity !== 'common') s.castsSinceRareOrBetter = 0;
        else s.castsSinceRareOrBetter += 1;
    }

    recordEscape(_result: EscapeResult): void {
        const s = this.save.stats;
        s.totalEscaped += 1;
        s.currentCatchStreak = 0;
    }

    recordCast(): void {
        this.save.stats.castAttempts += 1;
    }

    favoriteSpecies(): string | null {
        const entries = Object.entries(this.save.stats.speciesCaughtCount);
        if (entries.length === 0) return null;
        entries.sort((a, b) => b[1] - a[1]);
        return entries[0][0];
    }

    tickPlaytime(): void {
        const now = performance.now();
        this.save.stats.playtimeMs += now - this.playtimeAnchor;
        this.playtimeAnchor = now;
    }
}

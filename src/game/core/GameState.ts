import { SAVE_VERSION } from '../constants';
import { DEFAULT_EQUIPPED } from '../data/equipment';
import type { ActiveChallenge } from '../data/types';

export interface FishRecord {
    caughtCount: number;
    bestWeight: number;
    firstCaughtAt: number; // epoch ms
}

export interface SaveData {
    version: number;
    coins: number;
    level: number;
    xp: number;

    equipped: {
        rod: string;
        reel: string;
        line: string;
        bait: string;
        bobber: string;
    };
    ownedEquipment: string[]; // equipment ids owned (rods/reels/lines/baits/bobbers beyond the defaults)
    perkLevels: Record<string, number>;

    unlockedLocations: string[];
    currentLocation: string;

    fishRecords: Record<string, FishRecord>; // fishId -> record
    achievementsUnlocked: string[];

    activeChallenges: ActiveChallenge[];

    stats: {
        totalCaught: number;
        totalEscaped: number;
        totalWeightKg: number;
        biggestFishKg: number;
        biggestFishId: string | null;
        totalCoinsEarned: number;
        legendaryCaught: number;
        mythicCaught: number;
        perfectCatches: number;
        currentCatchStreak: number;
        bestCatchStreak: number;
        speciesCaughtCount: Record<string, number>; // for "favorite fish"
        castAttempts: number;
        equipmentPurchased: number;
        categoriesUpgraded: number; // distinct categories with >1 owned item
        playtimeMs: number;
        castsSinceRareOrBetter: number;
    };

    settings: {
        sfxVolume: number;
        musicVolume: number;
        muted: boolean;
    };

    createdAt: number;
    lastSavedAt: number;
}

export function createDefaultSave(): SaveData {
    return {
        version: SAVE_VERSION,
        coins: 0,
        level: 1,
        xp: 0,
        equipped: { ...DEFAULT_EQUIPPED },
        ownedEquipment: [],
        perkLevels: {},
        unlockedLocations: ['pond'],
        currentLocation: 'pond',
        fishRecords: {},
        achievementsUnlocked: [],
        activeChallenges: [],
        stats: {
            totalCaught: 0,
            totalEscaped: 0,
            totalWeightKg: 0,
            biggestFishKg: 0,
            biggestFishId: null,
            totalCoinsEarned: 0,
            legendaryCaught: 0,
            mythicCaught: 0,
            perfectCatches: 0,
            currentCatchStreak: 0,
            bestCatchStreak: 0,
            speciesCaughtCount: {},
            castAttempts: 0,
            equipmentPurchased: 0,
            categoriesUpgraded: 0,
            playtimeMs: 0,
            castsSinceRareOrBetter: 0
        },
        settings: { sfxVolume: 0.8, musicVolume: 0.5, muted: false },
        createdAt: Date.now(),
        lastSavedAt: Date.now()
    };
}

/**
 * Deep-merges loaded save data onto a fresh default so new fields introduced
 * in later versions are always present without a hard migration.
 */
export function mergeWithDefaults(loaded: Partial<SaveData>): SaveData {
    const def = createDefaultSave();
    return {
        ...def,
        ...loaded,
        equipped: { ...def.equipped, ...(loaded.equipped ?? {}) },
        perkLevels: { ...def.perkLevels, ...(loaded.perkLevels ?? {}) },
        fishRecords: { ...def.fishRecords, ...(loaded.fishRecords ?? {}) },
        stats: { ...def.stats, ...(loaded.stats ?? {}), speciesCaughtCount: { ...def.stats.speciesCaughtCount, ...(loaded.stats?.speciesCaughtCount ?? {}) } },
        settings: { ...def.settings, ...(loaded.settings ?? {}) },
        ownedEquipment: loaded.ownedEquipment ?? def.ownedEquipment,
        unlockedLocations: loaded.unlockedLocations?.length ? loaded.unlockedLocations : def.unlockedLocations,
        activeChallenges: loaded.activeChallenges ?? def.activeChallenges,
        achievementsUnlocked: loaded.achievementsUnlocked ?? def.achievementsUnlocked
    };
}

/**
 * Global typed event bus shared by every system and scene. A tiny hand-rolled
 * emitter (not Phaser.Events.EventEmitter) so pure systems -- and their unit
 * tests -- never need to import the Phaser package, which has browser-only
 * side effects on module load.
 */
export class GameBus {
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    on(event: string, fn: (...args: unknown[]) => void): this {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(fn);
        return this;
    }

    once(event: string, fn: (...args: unknown[]) => void): this {
        const wrapper = (...args: unknown[]) => { this.off(event, wrapper); fn(...args); };
        return this.on(event, wrapper);
    }

    off(event: string, fn: (...args: unknown[]) => void): this {
        this.listeners.get(event)?.delete(fn);
        return this;
    }

    emit(event: string, ...args: unknown[]): void {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const fn of [...set]) fn(...args);
    }

    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0;
    }

    removeAllListeners(event?: string): this {
        if (event) this.listeners.delete(event);
        else this.listeners.clear();
        return this;
    }
}

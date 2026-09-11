import type { FishDef } from '../data/types';
import type { Rarity, SizeLabel } from '../constants';

export interface CatchResult {
    fish: FishDef;
    weight: number;
    weightPercentile: number;
    sizeLabel: SizeLabel;
    isNewSpecies: boolean;
    isNewRecord: boolean;
    coins: number;
    xp: number;
    perfect: boolean;
}

export interface EscapeResult {
    fish: FishDef;
    meterAtEscape: number;
}

export const EVENTS = {
    CATCH: 'catch',
    ESCAPE: 'escape',
    COINS_CHANGED: 'coinsChanged',
    XP_CHANGED: 'xpChanged',
    LEVEL_UP: 'levelUp',
    EQUIP_CHANGED: 'equipChanged',
    ITEM_PURCHASED: 'itemPurchased',
    PERK_UPGRADED: 'perkUpgraded',
    LOCATION_UNLOCKED: 'locationUnlocked',
    LOCATION_CHANGED: 'locationChanged',
    ACHIEVEMENT_UNLOCKED: 'achievementUnlocked',
    CHALLENGE_COMPLETED: 'challengeCompleted',
    CHALLENGES_REROLLED: 'challengesRerolled',
    SAVE_LOADED: 'saveLoaded',
    SAVE_RESET: 'saveReset',
    HUGE_FISH_ON_LINE: 'hugeFishOnLine'
} as const;

export interface HookedEventMap {
    [EVENTS.CATCH]: CatchResult;
    [EVENTS.ESCAPE]: EscapeResult;
    [EVENTS.COINS_CHANGED]: { coins: number; delta: number };
    [EVENTS.XP_CHANGED]: { xp: number; level: number; xpToNext: number; delta: number };
    [EVENTS.LEVEL_UP]: { level: number };
    [EVENTS.EQUIP_CHANGED]: { category: string; itemId: string };
    [EVENTS.ITEM_PURCHASED]: { itemId: string };
    [EVENTS.PERK_UPGRADED]: { perkId: string; level: number };
    [EVENTS.LOCATION_UNLOCKED]: { locationId: string };
    [EVENTS.LOCATION_CHANGED]: { locationId: string };
    [EVENTS.ACHIEVEMENT_UNLOCKED]: { id: string };
    [EVENTS.CHALLENGE_COMPLETED]: { id: string };
    [EVENTS.CHALLENGES_REROLLED]: undefined;
    [EVENTS.SAVE_LOADED]: undefined;
    [EVENTS.SAVE_RESET]: undefined;
    [EVENTS.HUGE_FISH_ON_LINE]: { fish: FishDef };
}

export type EventKey = keyof HookedEventMap;
export type Rarity_ = Rarity; // re-export convenience

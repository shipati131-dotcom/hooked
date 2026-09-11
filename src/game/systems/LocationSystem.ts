import type { SaveData } from '../core/GameState';
import { GameBus } from '../core/GameState';
import { EVENTS } from '../core/events';
import { LOCATIONS, getLocation } from '../data/locations';

export class LocationSystem {
    constructor(private save: SaveData, private bus: GameBus) {}

    get current() { return getLocation(this.save.currentLocation); }

    isUnlocked(id: string): boolean { return this.save.unlockedLocations.includes(id); }

    canUnlock(id: string): boolean {
        const loc = getLocation(id);
        return this.save.level >= loc.unlockLevel;
    }

    unlock(id: string, spend: (price: number) => boolean): boolean {
        if (this.isUnlocked(id)) return true;
        const loc = getLocation(id);
        if (!this.canUnlock(id)) return false;
        if (!spend(loc.travelCost)) return false;
        this.save.unlockedLocations.push(id);
        this.bus.emit(EVENTS.LOCATION_UNLOCKED, { locationId: id });
        this.travel(id);
        return true;
    }

    travel(id: string): boolean {
        if (!this.isUnlocked(id)) return false;
        this.save.currentLocation = id;
        this.bus.emit(EVENTS.LOCATION_CHANGED, { locationId: id });
        return true;
    }

    /** Next location the player doesn't have yet, in order -- used for the "long term goal" text. */
    nextLocked() {
        return LOCATIONS.find(l => !this.isUnlocked(l.id));
    }

    all() { return LOCATIONS; }
}

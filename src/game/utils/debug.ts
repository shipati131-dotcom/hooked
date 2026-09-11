import type Phaser from 'phaser';
import type { Services } from '../core/services';
import { LOCATIONS } from '../data/locations';

/** Dev-only console helpers for fast manual testing. Never imported by production code paths. */
export function installDebugHooks(game: Phaser.Game): void {
    const services = game.registry.get('services') as Services;

    (window as unknown as Record<string, unknown>).__HOOKED__ = {
        addCoins: (n: number) => services.economy.addCoins(n),
        setLevel: (n: number) => { services.save.level = n; services.save.xp = 0; },
        unlockAll: () => { services.save.unlockedLocations = LOCATIONS.map(l => l.id); },
        save: () => services.saveSystem.saveNow(services.save),
        reset: () => services.resetSave(),
        state: () => services.save,
        services
    };
    (window as unknown as Record<string, unknown>).__game = game;

    console.log('%c[HOOKED] Debug hooks ready: window.__HOOKED__', 'color:#8affb0');
}

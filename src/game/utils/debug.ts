import type Phaser from 'phaser';
import type { Services } from '../core/services';
import { LOCATIONS } from '../data/locations';

/** Dev-only console helpers for fast manual testing. Never imported by production code paths. */
export function installDebugHooks(game: Phaser.Game): void {
    const getServices = () => game.registry.get('services') as Services | undefined;

    const hooks = {
        addCoins: (n: number) => getServices()?.economy.addCoins(n),
        setLevel: (n: number) => {
            const services = getServices();
            if (services) { services.save.level = n; services.save.xp = 0; }
        },
        unlockAll: () => {
            const services = getServices();
            if (services) services.save.unlockedLocations = LOCATIONS.map(l => l.id);
        },
        save: () => {
            const services = getServices();
            if (services) services.saveSystem.saveNow(services.save);
        },
        reset: () => getServices()?.resetSave(),
        state: () => getServices()?.save
    };
    Object.defineProperty(hooks, 'services', { get: getServices });
    (window as unknown as Record<string, unknown>).__HOOKED__ = hooks;
    (window as unknown as Record<string, unknown>).__game = game;
    // Opt-in deterministic stepping for the local QA browser only. Normal
    // gameplay keeps Phaser's animation loop until this hook is called.
    let manualTime = 0;
    (window as unknown as Record<string, unknown>).advanceTime = (ms: number) => {
        game.loop.stop();
        manualTime = Math.max(manualTime, game.loop.now);
        const steps = Math.max(1, Math.ceil(ms / (1000 / 60)));
        const dt = ms / steps;
        for (let i = 0; i < steps; i++) {
            // Phaser tweens normally read Date.now instead of the scene delta.
            // Step their clocks too, so a cast arc finishes at the same time
            // as the model under test. Restore the normal clock after each frame.
            const managers = game.scene.getScenes(true).map(scene => ({ manager: scene.tweens, clock: scene.tweens.getDelta }));
            managers.forEach(({ manager }) => { manager.getDelta = () => dt; });
            try { game.step(manualTime += dt, dt); }
            finally { managers.forEach(({ manager, clock }) => { manager.getDelta = clock; }); }
        }
    };
    (window as unknown as Record<string, unknown>).render_game_to_text = () => {
        const services = getServices();
        if (!services) return JSON.stringify({ mode: 'loading' });
        const fishingScene = game.scene.getScene('FishingScene') as unknown as {
            fishing?: { state?: string; fightSnapshot?: () => unknown };
            visualState?: () => unknown;
        };
        const fishing = fishingScene?.fishing;
        const textureKeys = game.textures.getTextureKeys();
        const frameCount = (key: string) => game.textures.exists(key)
            ? game.textures.get(key).getFrameNames().filter(name => name !== '__BASE').length
            : 0;
        return JSON.stringify({
            coordinateSystem: 'origin top-left; x increases right; y increases down; canvas 1600x900',
            activeScenes: game.scene.getScenes(true).map(scene => scene.scene.key),
            location: services.save.currentLocation,
            level: services.save.level,
            coins: services.save.coins,
            totalCaught: services.save.stats.totalCaught,
            fishingState: fishing?.state ?? 'inactive',
            reel: fishing?.state === 'fighting' ? fishing.fightSnapshot?.() : undefined,
            visuals: fishingScene?.visualState?.(),
            assetAudit: {
                fishTextures: textureKeys.filter(key => key.startsWith('fish-')).length,
                locationTextures: textureKeys.filter(key => key.startsWith('location-') && !key.endsWith('-video')).length,
                equipmentFrames: ['rod', 'reel', 'line', 'bait', 'bobber'].reduce((sum, key) => sum + frameCount(`equipment-${key}`), 0),
                perkFrames: ['lucky-hook', 'quick-bite', 'strong-arms', 'fish-sense', 'golden-touch', 'xp-hunter'].reduce((sum, key) => sum + frameCount(`perk-${key}`), 0)
            }
        });
    };

    console.log('%c[HOOKED] Debug hooks ready: window.__HOOKED__', 'color:#8affb0');
}

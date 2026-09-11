import Phaser from 'phaser';
import type { GameBus } from './GameState';
import type { HookedEventMap } from './events';

/**
 * Binds a bus listener and automatically removes it when the scene shuts down,
 * so overlay scenes (Shop, Collection, ...) never leak listeners between opens.
 */
export function listen<K extends keyof HookedEventMap>(
    scene: Phaser.Scene,
    bus: GameBus,
    event: K,
    handler: (payload: HookedEventMap[K]) => void
): void {
    bus.on(event as string, handler as (...args: unknown[]) => void);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        bus.off(event as string, handler as (...args: unknown[]) => void);
    });
}

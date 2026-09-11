import Phaser from 'phaser';
import { GameBus, type SaveData } from './GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { EquipmentSystem } from '../systems/EquipmentSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { LocationSystem } from '../systems/LocationSystem';
import { StatsSystem } from '../systems/StatsSystem';
import { AchievementSystem } from '../systems/AchievementSystem';
import { ChallengeSystem } from '../systems/ChallengeSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { BALANCE } from '../data/balance';
import { EVENTS, type CatchResult } from './events';

/**
 * Every system is constructed exactly once here and stored on the Phaser
 * registry, so any scene can call `getServices(this)` and reach the same
 * shared instances. Scenes never touch SaveData directly.
 */
export class Services {
    bus = new GameBus();
    saveSystem = new SaveSystem();
    save: SaveData;

    economy: EconomySystem;
    progression: ProgressionSystem;
    equipment: EquipmentSystem;
    upgrades: UpgradeSystem;
    location: LocationSystem;
    stats: StatsSystem;
    achievements: AchievementSystem;
    challenges: ChallengeSystem;
    audio: AudioSystem;
    private resetting = false;

    constructor(game: Phaser.Game) {
        this.save = this.saveSystem.load();
        this.economy = new EconomySystem(this.save, this.bus);
        this.progression = new ProgressionSystem(this.save, this.bus);
        this.equipment = new EquipmentSystem(this.save, this.bus);
        this.upgrades = new UpgradeSystem(this.save, this.bus);
        this.location = new LocationSystem(this.save, this.bus);
        this.stats = new StatsSystem(this.save);
        this.achievements = new AchievementSystem(this.save, this.bus, c => this.economy.addCoins(c), x => this.progression.addXp(x));
        this.challenges = new ChallengeSystem(this.save, this.bus, c => this.economy.addCoins(c), x => this.progression.addXp(x));
        this.audio = new AudioSystem(game, this.save);

        this.autosave();
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && !this.resetting) this.saveSystem.saveNow(this.save);
        });
        window.addEventListener('beforeunload', () => {
            if (!this.resetting) this.saveSystem.saveNow(this.save);
        });
    }

    private autosave(): void {
        setInterval(() => {
            if (this.resetting) return;
            this.stats.tickPlaytime();
            this.saveSystem.requestSave(() => this.save, 0);
        }, BALANCE.autosave.intervalMs);
    }

    requestSave(): void {
        this.saveSystem.requestSave(() => this.save);
    }

    /** Central place any catch flows through so every dependent system stays in sync. */
    finalizeCatch(result: CatchResult): void {
        const rec = this.save.fishRecords[result.fish.id];
        if (!rec) {
            this.save.fishRecords[result.fish.id] = { caughtCount: 1, bestWeight: result.weight, firstCaughtAt: Date.now() };
        } else {
            rec.caughtCount += 1;
            if (result.weight > rec.bestWeight) rec.bestWeight = result.weight;
        }
        this.stats.recordCatch(result);
        this.economy.addCoins(result.coins);
        this.progression.addXp(result.xp);
        this.challenges.onCatch(result);
        this.challenges.onCoinsEarned(this.save.stats.totalCoinsEarned);
        this.achievements.checkAll();
        this.bus.emit(EVENTS.CATCH, result);
        this.requestSave();
    }

    resetSave(): void {
        // Flip this first so any autosave/visibility/unload handler that fires
        // during the reload never re-writes the in-memory save we're discarding.
        this.resetting = true;
        this.saveSystem.reset();
        window.location.reload();
    }
}

export function createServices(game: Phaser.Game): Services {
    const services = new Services(game);
    game.registry.set('services', services);
    return services;
}

export function getServices(scene: Phaser.Scene): Services {
    return scene.game.registry.get('services') as Services;
}

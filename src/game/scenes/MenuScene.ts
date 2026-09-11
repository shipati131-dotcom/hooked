import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_KEYS } from '../constants';
import { LocationRenderer } from '../art/LocationRenderer';
import { getLocation } from '../data/locations';
import { Button } from '../ui/Button';
import { COLORS } from '../ui/theme';
import { getServices } from '../core/services';

export class MenuScene extends Phaser.Scene {
    private env!: LocationRenderer;

    constructor() { super(SCENE_KEYS.MENU); }

    create(): void {
        const services = getServices(this);
        this.env = new LocationRenderer(this);
        this.env.build(getLocation(services.save.currentLocation ?? 'pond'));

        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.18).setOrigin(0, 0).setDepth(90);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.32, 'HOOKED', {
            fontFamily: 'Fredoka, sans-serif', fontSize: '128px', color: '#fff6e0',
            stroke: '#0c2733', strokeThickness: 12
        }).setOrigin(0.5).setDepth(100);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.32 + 78, 'a cozy fishing game', {
            fontFamily: 'Nunito, sans-serif', fontSize: '24px', color: '#c9e8ec', fontStyle: '700'
        }).setOrigin(0.5).setDepth(100);

        new Button(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.62, 'PLAY', () => {
            this.scene.start(SCENE_KEYS.FISHING);
            this.scene.launch(SCENE_KEYS.HUD);
        }, { width: 300, height: 84, fontSize: 32, color: COLORS.gold }).setDepth(100);

        const hasSave = services.save.stats.totalCaught > 0;
        if (hasSave) {
            this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.62 + 70,
                `Level ${services.save.level} • ${services.save.stats.totalCaught} fish caught`,
                { fontFamily: 'Nunito, sans-serif', fontSize: '18px', color: '#c9e8ec' }
            ).setOrigin(0.5).setDepth(100);
        }

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.env.destroy());
    }

    update(_time: number, dt: number): void {
        this.env.update(dt);
    }
}

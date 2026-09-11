import Phaser from 'phaser';
import { TRACK_HEIGHT, type ReelSnapshot } from '../systems/FishingSystem';
import type { Rarity } from '../constants';
import { applyRarityGlow } from './glow';

const TRACK_WIDTH = 96;

/**
 * Visual for the reeling minigame: a vertical track, the player-controlled
 * catch zone, the fish icon, a capture meter and (conditionally) a tension bar.
 * Purely a renderer -- FishingSystem owns all the physics/state.
 */
export class ReelMeter extends Phaser.GameObjects.Container {
    private track: Phaser.GameObjects.Graphics;
    private zoneGfx: Phaser.GameObjects.Graphics;
    private fishIcon: Phaser.GameObjects.Image;
    private meterBar: Phaser.GameObjects.Graphics;
    private tensionBar: Phaser.GameObjects.Graphics;
    private tensionLabel: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        this.track = scene.add.graphics();
        this.zoneGfx = scene.add.graphics();
        this.fishIcon = scene.add.image(0, 0, 'particle-dot').setVisible(false);
        this.meterBar = scene.add.graphics();
        this.tensionBar = scene.add.graphics();
        this.tensionLabel = scene.add.text(TRACK_WIDTH / 2 + 44, -TRACK_HEIGHT - 4, 'TENSION', {
            fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#ffb0a0', fontStyle: '800'
        }).setOrigin(0.5, 1).setVisible(false);

        this.drawTrack();
        this.add([this.track, this.zoneGfx, this.fishIcon, this.meterBar, this.tensionBar, this.tensionLabel]);
        this.setVisible(false);
        scene.add.existing(this);
    }

    private drawTrack(): void {
        this.track.clear();
        this.track.fillStyle(0x08222d, 0.65);
        this.track.fillRoundedRect(-TRACK_WIDTH / 2, -TRACK_HEIGHT, TRACK_WIDTH, TRACK_HEIGHT, 16);
        this.track.lineStyle(2, 0xffffff, 0.15);
        this.track.strokeRoundedRect(-TRACK_WIDTH / 2, -TRACK_HEIGHT, TRACK_WIDTH, TRACK_HEIGHT, 16);
    }

    beginEncounter(fishTextureKey: string, rarity: Rarity): void {
        this.setVisible(true);
        this.setAlpha(0);
        this.scene.tweens.add({ targets: this, alpha: 1, duration: 180 });
        this.fishIcon.setTexture(fishTextureKey).setVisible(true).setScale(0.55).setDepth(1);
        this.fishIcon.setTint(0xffffff);
        applyRarityGlow(this.fishIcon, rarity);
    }

    /** y here is bottom-origin pixel space matching FishingSystem (0 = bottom of track). */
    update(snap: ReelSnapshot): void {
        const toLocalY = (y: number) => -y; // container origin is at the bottom of the track

        this.zoneGfx.clear();
        const zoneTop = toLocalY(snap.zoneY + snap.zoneHeight);
        const zoneColor = snap.inZone ? 0x8affb0 : 0x4dd4c4;
        this.zoneGfx.fillStyle(zoneColor, snap.inZone ? 0.38 : 0.22);
        this.zoneGfx.fillRoundedRect(-TRACK_WIDTH / 2 + 4, zoneTop, TRACK_WIDTH - 8, snap.zoneHeight, 10);
        this.zoneGfx.lineStyle(3, zoneColor, 0.9);
        this.zoneGfx.strokeRoundedRect(-TRACK_WIDTH / 2 + 4, zoneTop, TRACK_WIDTH - 8, snap.zoneHeight, 10);

        this.fishIcon.setPosition(0, toLocalY(snap.fishY));
        this.fishIcon.setScale(snap.inZone ? 0.62 : 0.55);

        this.meterBar.clear();
        const meterX = -TRACK_WIDTH / 2 - 26;
        this.meterBar.fillStyle(0x08222d, 0.6);
        this.meterBar.fillRoundedRect(meterX - 8, -TRACK_HEIGHT, 16, TRACK_HEIGHT, 8);
        const meterH = TRACK_HEIGHT * snap.meter;
        this.meterBar.fillStyle(0xf0c93d, 1);
        this.meterBar.fillRoundedRect(meterX - 8, -meterH, 16, meterH, 8);

        this.tensionBar.clear();
        this.tensionLabel.setVisible(snap.tensionActive);
        if (snap.tensionActive) {
            const tX = TRACK_WIDTH / 2 + 26;
            this.tensionBar.fillStyle(0x08222d, 0.6);
            this.tensionBar.fillRoundedRect(tX - 8, -TRACK_HEIGHT, 16, TRACK_HEIGHT, 8);
            const tH = TRACK_HEIGHT * snap.tension;
            this.tensionBar.fillStyle(snap.tension > 0.75 ? 0xff4a3a : 0xe17a4a, 1);
            this.tensionBar.fillRoundedRect(tX - 8, -tH, 16, tH, 8);
        }
    }

    endEncounter(): void {
        this.scene.tweens.add({
            targets: this, alpha: 0, duration: 160,
            onComplete: () => { this.setVisible(false); this.fishIcon.setVisible(false); }
        });
    }
}

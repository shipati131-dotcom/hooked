import Phaser from 'phaser';
import { TRACK_HEIGHT, type ReelSnapshot } from '../systems/FishingSystem';
import type { Rarity } from '../constants';
import { applyRarityGlow } from './glow';
import { COLORS } from './theme';

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
            fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#e8a08c', fontStyle: '800'
        }).setOrigin(0.5, 1).setVisible(false);

        this.drawTrack();
        this.add([this.track, this.zoneGfx, this.fishIcon, this.meterBar, this.tensionBar, this.tensionLabel]);
        this.setVisible(false);
        scene.add.existing(this);
    }

    private drawTrack(): void {
        this.track.clear();
        this.track.fillStyle(COLORS.panelDeep, 0.72);
        this.track.fillRoundedRect(-TRACK_WIDTH / 2, -TRACK_HEIGHT, TRACK_WIDTH, TRACK_HEIGHT, 14);
        this.track.lineStyle(2, COLORS.sand, 0.28);
        this.track.strokeRoundedRect(-TRACK_WIDTH / 2, -TRACK_HEIGHT, TRACK_WIDTH, TRACK_HEIGHT, 14);
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
        const zoneColor = snap.inZone ? COLORS.accent : COLORS.accentDeep;
        this.zoneGfx.fillStyle(zoneColor, snap.inZone ? 0.4 : 0.2);
        this.zoneGfx.fillRoundedRect(-TRACK_WIDTH / 2 + 4, zoneTop, TRACK_WIDTH - 8, snap.zoneHeight, 9);
        this.zoneGfx.lineStyle(3, zoneColor, snap.inZone ? 0.95 : 0.6);
        this.zoneGfx.strokeRoundedRect(-TRACK_WIDTH / 2 + 4, zoneTop, TRACK_WIDTH - 8, snap.zoneHeight, 9);

        this.fishIcon.setPosition(0, toLocalY(snap.fishY));
        this.fishIcon.setScale(snap.inZone ? 0.62 : 0.55);

        this.meterBar.clear();
        const meterX = -TRACK_WIDTH / 2 - 26;
        this.meterBar.fillStyle(COLORS.panelDeep, 0.55);
        this.meterBar.fillRoundedRect(meterX - 8, -TRACK_HEIGHT, 16, TRACK_HEIGHT, 8);
        const meterH = TRACK_HEIGHT * snap.meter;
        if (meterH > 1) {
            this.meterBar.fillStyle(COLORS.gold, 1);
            this.meterBar.fillRoundedRect(meterX - 8, -meterH, 16, meterH, 8);
        }

        this.tensionBar.clear();
        this.tensionLabel.setVisible(snap.tensionActive);
        if (snap.tensionActive) {
            const tX = TRACK_WIDTH / 2 + 26;
            this.tensionBar.fillStyle(COLORS.panelDeep, 0.55);
            this.tensionBar.fillRoundedRect(tX - 8, -TRACK_HEIGHT, 16, TRACK_HEIGHT, 8);
            const tH = TRACK_HEIGHT * snap.tension;
            if (tH > 1) {
                this.tensionBar.fillStyle(snap.tension > 0.75 ? COLORS.danger : COLORS.coral, 1);
                this.tensionBar.fillRoundedRect(tX - 8, -tH, 16, tH, 8);
            }
        }
    }

    endEncounter(): void {
        this.scene.tweens.add({
            targets: this, alpha: 0, duration: 160,
            onComplete: () => { this.setVisible(false); this.fishIcon.setVisible(false); }
        });
    }
}

import Phaser from 'phaser';
import { DEPTH } from '../constants';
import type { Rarity } from '../constants';
import { applyRarityGlow } from '../ui/glow';
import { fitImage } from '../ui/fitImage';
import { FONT_DISPLAY } from '../ui/theme';
import type { FightSnapshot } from '../systems/fishing/FightModel';

const NEAR_Y_OFFSET = 60; // below the reference Y at distance=0 (closest to the boat)
const FAR_Y_OFFSET = -140; // above the reference Y at distance=1 (near the horizon)
const NEAR_SCALE = 1.15;
const FAR_SCALE = 0.4;

/**
 * The in-world part of a fish fight: a dark "shadow" of the hooked fish
 * swimming on the actual water (lateral position + perspective distance),
 * a full-color splash when it jumps, a wake trail, and a move-label callout
 * that floats above it. FightHud (a slim numeric strip) is the rest of the
 * fight's UI; this is the part that makes it feel like a real animal on
 * the other end of the line.
 */
export class FightView {
    private scene: Phaser.Scene;
    private fish: Phaser.GameObjects.Image;
    private wake: Phaser.GameObjects.Particles.ParticleEmitter;
    private callout: Phaser.GameObjects.Text;
    private refX: number;
    private refY: number;
    private fishScale = 1;
    private wasAirborne = false;
    private lastCalloutText = '';

    constructor(scene: Phaser.Scene, refX: number, refY: number) {
        this.scene = scene;
        this.refX = refX;
        this.refY = refY;
        this.fish = scene.add.image(refX, refY, 'particle-dot').setVisible(false).setDepth(DEPTH.BOBBER + 1);
        this.wake = scene.add.particles(0, 0, 'particle-dot', {
            speed: { min: 10, max: 40 }, lifespan: 400, scale: { start: 0.6, end: 0 },
            alpha: { start: 0.5, end: 0 }, quantity: 0, frequency: -1, tint: 0xdfeef2
        }).setDepth(DEPTH.WATER + 2);
        this.callout = scene.add.text(refX, refY - 40, '', {
            fontFamily: FONT_DISPLAY, fontSize: '19px', color: '#fff0bd', fontStyle: '700',
            stroke: '#07161d', strokeThickness: 4
        }).setOrigin(0.5).setDepth(DEPTH.UI_TOP).setVisible(false);
    }

    beginEncounter(fishTextureKey: string, rarity: Rarity): void {
        this.fish.setTexture(fishTextureKey).setVisible(true).clearTint();
        this.fishScale = fitImage(this.fish, 150, 90);
        this.fish.setTint(0x10181c).setTintMode(Phaser.TintModes.FILL);
        this.wasAirborne = false;
        this.lastCalloutText = '';
        applyRarityGlow(this.fish, rarity);
    }

    private xFor(lateralPos: number): number { return this.refX + lateralPos * 240; }
    private yFor(distance: number): number {
        const t = Phaser.Math.Clamp(distance, 0, 1);
        return this.refY + Phaser.Math.Linear(NEAR_Y_OFFSET, FAR_Y_OFFSET, t);
    }
    private scaleFor(distance: number): number {
        const t = Phaser.Math.Clamp(distance, 0, 1);
        return Phaser.Math.Linear(NEAR_SCALE, FAR_SCALE, t);
    }

    update(snap: FightSnapshot): void {
        const x = this.xFor(snap.lateralPos);
        const baseY = this.yFor(snap.distance);
        const scaleMult = this.scaleFor(snap.distance);

        if (snap.airborne) {
            const y = baseY - 70;
            this.fish.setPosition(x, y).setScale(this.fishScale * scaleMult * 1.1).clearTint();
            if (!this.wasAirborne) this.wake.explode(10, x, baseY);
        } else {
            this.fish.setPosition(x, baseY).setScale(this.fishScale * scaleMult)
                .setTint(0x10181c).setTintMode(Phaser.TintModes.FILL);
            if (snap.movePhase === 'active' && (snap.move === 'run' || snap.move === 'dive' || snap.move === 'thrash' || snap.move === 'frenzy')) {
                this.wake.setPosition(x, baseY);
                this.wake.frequency = 60;
            } else {
                this.wake.frequency = -1;
            }
        }
        if (snap.airborne && !this.wasAirborne) this.scene.cameras.main.shake(60, 0.002);
        this.wasAirborne = snap.airborne;

        const angle = snap.runDir * 12;
        this.fish.setAngle(angle);
        this.fish.setFlipX(snap.lateralPos < 0);

        const label = snap.phaseAnnouncing ? snap.phaseLabel : (snap.movePhase === 'active' ? snap.moveLabel : '');
        if (label) {
            this.callout.setText(label).setPosition(x, baseY - 55).setVisible(true);
            if (label !== this.lastCalloutText) {
                this.callout.setScale(0.7).setAlpha(0.9);
                this.scene.tweens.add({ targets: this.callout, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
            }
        } else {
            this.callout.setVisible(false);
        }
        this.lastCalloutText = label;
    }

    /** World position of the fish, for the line to target. */
    lineTarget(): { x: number; y: number } {
        return { x: this.fish.x, y: this.fish.y };
    }

    endEncounter(): void {
        this.fish.setVisible(false);
        this.callout.setVisible(false);
        this.wake.frequency = -1;
    }

    destroy(): void {
        this.fish.destroy();
        this.wake.destroy();
        this.callout.destroy();
    }
}

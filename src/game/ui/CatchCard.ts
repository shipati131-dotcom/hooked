import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, RARITY_COLOR, RARITY_LABEL } from '../constants';
import type { Rarity } from '../constants';
import type { CatchResult } from '../core/events';
import { formatWeight, formatCoins } from '../utils/format';
import { countUpText } from './CountUpText';
import { applyRarityGlow } from './glow';
import { hex } from './theme';

/** Per-rarity suspense delay (ms) before the reveal, and how much spectacle it earns. */
const TEASER: Record<Rarity, { delay: number; line: string; burst: number; shake: number } | null> = {
    common: null,
    uncommon: null,
    rare: { delay: 380, line: 'Something is glinting below...', burst: 14, shake: 0 },
    epic: { delay: 560, line: 'Something rare is on the line...', burst: 22, shake: 0.004 },
    legendary: { delay: 760, line: 'Something special...', burst: 34, shake: 0.007 },
    mythic: { delay: 950, line: '...is this even real?', burst: 48, shake: 0.011 }
};

/**
 * The catch/reveal moment: fish rises from a splash, a beat of suspense for
 * anything Rare or better, then a staged reveal (name -> rarity -> weight ->
 * coins/XP -> new-species/record badges) rather than everything at once.
 */
export class CatchCard extends Phaser.GameObjects.Container {
    private backdrop: Phaser.GameObjects.Rectangle;
    private fishImage: Phaser.GameObjects.Image;
    private teaserText: Phaser.GameObjects.Text;
    private rarityText: Phaser.GameObjects.Text;
    private nameText: Phaser.GameObjects.Text;
    private weightText: Phaser.GameObjects.Text;
    private sizeText: Phaser.GameObjects.Text;
    private badgeText: Phaser.GameObjects.Text;
    private coinsText: Phaser.GameObjects.Text;
    private xpText: Phaser.GameObjects.Text;
    private hintText: Phaser.GameObjects.Text;
    private continueCb?: () => void;
    private pendingTimers: Phaser.Time.TimerEvent[] = [];

    constructor(scene: Phaser.Scene) {
        super(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.setDepth(DEPTH.REVEAL);

        this.backdrop = scene.add.rectangle(0, 0, GAME_WIDTH * 2, GAME_HEIGHT * 2, 0x081217, 0.76).setInteractive();
        this.fishImage = scene.add.image(0, 40, 'particle-dot').setScale(0);
        this.teaserText = scene.add.text(0, -30, '', {
            fontFamily: 'Nunito, sans-serif', fontSize: '20px', color: '#d8c9a3', fontStyle: '700italic'
        }).setOrigin(0.5).setAlpha(0);
        this.rarityText = scene.add.text(0, -190, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '23px', fontStyle: '600' }).setOrigin(0.5).setAlpha(0);
        this.nameText = scene.add.text(0, -150, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '42px', color: '#f4e8cf', stroke: '#17252b', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
        this.weightText = scene.add.text(0, 10, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '34px', color: '#f4e8cf', stroke: '#17252b', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
        this.sizeText = scene.add.text(0, 48, '', { fontFamily: 'Nunito, sans-serif', fontSize: '20px', color: '#d8c9a3', fontStyle: '700' }).setOrigin(0.5).setAlpha(0);
        this.coinsText = scene.add.text(-70, 128, '', { fontFamily: 'Nunito, sans-serif', fontSize: '25px', color: '#e7b94f', fontStyle: '800' }).setOrigin(0.5).setAlpha(0);
        this.xpText = scene.add.text(70, 128, '', { fontFamily: 'Nunito, sans-serif', fontSize: '25px', color: '#3ab7a7', fontStyle: '800' }).setOrigin(0.5).setAlpha(0);
        this.badgeText = scene.add.text(0, 168, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '21px', color: '#e7b94f', stroke: '#17252b', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setScale(0.6);
        this.hintText = scene.add.text(0, 216, 'Tap to continue', { fontFamily: 'Nunito, sans-serif', fontSize: '18px', color: '#d8c9a3' }).setOrigin(0.5).setAlpha(0);

        this.add([
            this.backdrop, this.fishImage, this.teaserText, this.rarityText, this.nameText,
            this.weightText, this.sizeText, this.coinsText, this.xpText, this.badgeText, this.hintText
        ]);
        this.setVisible(false).setAlpha(0);

        this.backdrop.on('pointerdown', () => this.continueCb?.());
        scene.add.existing(this);
    }

    show(result: CatchResult, fishTextureKey: string, onContinue: () => void): void {
        this.clearTimers();
        this.continueCb = onContinue;
        const rarity = result.fish.rarity;
        const color = RARITY_COLOR[rarity];
        const colorHex = hex(color);
        const teaser = TEASER[rarity];

        // Reset every element to its pre-reveal state.
        for (const t of [this.teaserText, this.rarityText, this.nameText, this.weightText, this.sizeText, this.coinsText, this.xpText, this.badgeText, this.hintText]) {
            t.setAlpha(0);
        }
        this.badgeText.setScale(0.6);
        this.rarityText.setText(result.perfect ? 'PERFECT CATCH!' : RARITY_LABEL[rarity].toUpperCase())
            .setColor(result.perfect ? '#e7b94f' : colorHex);
        this.nameText.setText(result.fish.name);
        this.sizeText.setText(result.sizeLabel);
        this.weightText.setText('0.00 kg');
        this.coinsText.setText('+0 coins');
        this.xpText.setText('+0 XP');
        const badges: string[] = [];
        if (result.isNewSpecies) badges.push('NEW SPECIES!');
        if (result.isNewRecord && !result.isNewSpecies) badges.push('NEW PERSONAL RECORD!');
        this.badgeText.setText(badges.join('   '));

        this.fishImage.setTexture(fishTextureKey).setScale(0).setAngle(0).setTint(teaser ? 0x0a0a0a : 0xffffff);

        this.setVisible(true);
        this.setAlpha(0);
        this.backdrop.setAlpha(0);
        this.scene.tweens.add({ targets: this.backdrop, alpha: 1, duration: 220 });
        this.scene.tweens.add({ targets: this, alpha: 1, duration: 150 });

        // 1. Fish rises from the water with a small splash burst.
        playSfx(this.scene, 'catch');
        this.spawnBurst(0xdfeef2, 12, 0.35, 60, 240);
        this.scene.tweens.add({
            targets: this.fishImage, scale: 2.05, angle: -8, y: -40, duration: 420, ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({ targets: this.fishImage, angle: 6, duration: 260, yoyo: true, repeat: 3, ease: 'Sine.inOut' });
            }
        });

        if (teaser) {
            // 2a. A beat of suspense before anything is confirmed -- fish stays a silhouette.
            this.teaserText.setText(teaser.line);
            this.scene.tweens.add({ targets: this.teaserText, alpha: 0.9, duration: 200, delay: 120 });
            this.delay(teaser.delay, () => this.reveal(result, rarity, color, teaser.burst, teaser.shake));
        } else {
            // Common/uncommon: no suspense, reveal immediately.
            this.reveal(result, rarity, color, 0, 0);
        }
    }

    /** The actual reveal: un-silhouette the fish and stage in every stat, most important first. */
    private reveal(result: CatchResult, rarity: Rarity, color: number, burst: number, shake: number): void {
        this.scene.tweens.add({ targets: this.teaserText, alpha: 0, duration: 150 });
        this.fishImage.setTint(0xffffff);
        applyRarityGlow(this.fishImage, rarity);

        if (burst > 0) this.spawnBurst(color, burst, 0.6, 90, 500);
        if (shake > 0) this.scene.cameras.main.shake(220, shake);
        if (rarity === 'legendary' || rarity === 'mythic') playSfx(this.scene, 'rare');

        this.popIn(this.rarityText, 0);
        this.popIn(this.nameText, 60);

        this.delay(160, () => {
            countUpText(this.scene, this.weightText, 0, result.weight, 600, n => formatWeight(n));
            this.scene.tweens.add({ targets: this.weightText, alpha: 1, duration: 200 });
        });
        this.delay(260, () => this.scene.tweens.add({ targets: this.sizeText, alpha: 1, duration: 200 }));

        this.delay(560, () => {
            this.scene.tweens.add({ targets: this.coinsText, alpha: 1, duration: 200 });
            countUpText(this.scene, this.coinsText, 0, result.coins, 500, n => `+${formatCoins(n)} coins`);
        });
        this.delay(620, () => {
            this.scene.tweens.add({ targets: this.xpText, alpha: 1, duration: 200 });
            countUpText(this.scene, this.xpText, 0, result.xp, 500, n => `+${Math.round(n)} XP`);
        });

        if (result.isNewSpecies || result.isNewRecord) {
            this.delay(1000, () => {
                this.badgeText.setVisible(true);
                this.scene.tweens.add({ targets: this.badgeText, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
            });
        } else {
            this.badgeText.setVisible(false);
        }

        this.delay(1100, () => this.scene.tweens.add({ targets: this.hintText, alpha: 0.8, duration: 300 }));
    }

    private popIn(target: Phaser.GameObjects.Text, delayMs: number): void {
        target.setScale(0.7);
        this.delay(delayMs, () => {
            this.scene.tweens.add({ targets: target, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
        });
    }

    private spawnBurst(color: number, quantity: number, alpha: number, speed: number, lifespan: number): void {
        if (quantity <= 0) return;
        const emitter = this.scene.add.particles(this.x, this.y + 40, 'particle-spark', {
            speed: { min: speed * 0.4, max: speed }, angle: { min: 0, max: 360 }, lifespan,
            scale: { start: 1, end: 0 }, alpha: { start: alpha, end: 0 }, quantity, tint: color
        }).setDepth(DEPTH.REVEAL + 1);
        this.scene.time.delayedCall(lifespan + 60, () => emitter.destroy());
    }

    private delay(ms: number, fn: () => void): void {
        this.pendingTimers.push(this.scene.time.delayedCall(ms, fn));
    }

    private clearTimers(): void {
        for (const t of this.pendingTimers) t.remove(false);
        this.pendingTimers = [];
    }

    hide(): void {
        this.clearTimers();
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 150, onComplete: () => this.setVisible(false) });
    }
}

/** Plays a sfx via the shared services registry without CatchCard needing a direct services import (avoids a circular dependency). */
function playSfx(scene: Phaser.Scene, key: string): void {
    const services = scene.game.registry.get('services') as { audio?: { play: (k: string) => void } } | undefined;
    services?.audio?.play(key);
}

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, RARITY_COLOR, RARITY_LABEL } from '../constants';
import type { CatchResult } from '../core/events';
import { formatWeight, formatCoins } from '../utils/format';
import { countUpText } from './CountUpText';
import { applyRarityGlow } from './glow';

/**
 * The catch/reveal overlay: fish pop + wiggle, rarity glow, weight count-up,
 * new species / new record badges, coin + XP rewards. Reused for every catch.
 */
export class CatchCard extends Phaser.GameObjects.Container {
    private backdrop: Phaser.GameObjects.Rectangle;
    private fishImage: Phaser.GameObjects.Image;
    private rarityText: Phaser.GameObjects.Text;
    private nameText: Phaser.GameObjects.Text;
    private weightText: Phaser.GameObjects.Text;
    private sizeText: Phaser.GameObjects.Text;
    private badgeText: Phaser.GameObjects.Text;
    private rewardText: Phaser.GameObjects.Text;
    private hintText: Phaser.GameObjects.Text;
    private continueCb?: () => void;

    constructor(scene: Phaser.Scene) {
        super(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.setDepth(DEPTH.REVEAL);

        this.backdrop = scene.add.rectangle(0, 0, GAME_WIDTH * 2, GAME_HEIGHT * 2, 0x03141c, 0.72).setInteractive();
        this.fishImage = scene.add.image(0, -80, 'particle-dot').setScale(1.6);
        this.rarityText = scene.add.text(0, -190, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', fontStyle: '600' }).setOrigin(0.5);
        this.nameText = scene.add.text(0, -150, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '40px', color: '#fff6e0', stroke: '#0c2733', strokeThickness: 6 }).setOrigin(0.5);
        this.weightText = scene.add.text(0, 10, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '34px', color: '#fff6e0', stroke: '#0c2733', strokeThickness: 5 }).setOrigin(0.5);
        this.sizeText = scene.add.text(0, 48, '', { fontFamily: 'Nunito, sans-serif', fontSize: '20px', color: '#c9e8ec', fontStyle: '700' }).setOrigin(0.5);
        this.badgeText = scene.add.text(0, 84, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', color: '#f7d585', stroke: '#0c2733', strokeThickness: 4 }).setOrigin(0.5);
        this.rewardText = scene.add.text(0, 130, '', { fontFamily: 'Nunito, sans-serif', fontSize: '26px', color: '#8affb0', fontStyle: '800' }).setOrigin(0.5);
        this.hintText = scene.add.text(0, 210, 'Tap to continue', { fontFamily: 'Nunito, sans-serif', fontSize: '18px', color: '#c9e8ec' }).setOrigin(0.5).setAlpha(0.8);

        this.add([this.backdrop, this.fishImage, this.rarityText, this.nameText, this.weightText, this.sizeText, this.badgeText, this.rewardText, this.hintText]);
        this.setVisible(false).setAlpha(0);

        this.backdrop.on('pointerdown', () => this.continueCb?.());
        scene.add.existing(this);
    }

    show(result: CatchResult, fishTextureKey: string, onContinue: () => void): void {
        this.continueCb = onContinue;
        const color = RARITY_COLOR[result.fish.rarity];
        this.rarityText.setText(result.perfect ? 'PERFECT CATCH!' : RARITY_LABEL[result.fish.rarity].toUpperCase())
            .setColor(result.perfect ? '#8affb0' : `#${color.toString(16).padStart(6, '0')}`);
        this.nameText.setText(result.fish.name);
        this.sizeText.setText(result.sizeLabel);
        this.rewardText.setText(`+${formatCoins(result.coins)} coins   +${result.xp} XP`);

        const badges: string[] = [];
        if (result.isNewSpecies) badges.push('NEW SPECIES!');
        if (result.isNewRecord && !result.isNewSpecies) badges.push('NEW PERSONAL RECORD!');
        this.badgeText.setText(badges.join('   ')).setVisible(badges.length > 0);

        this.fishImage.setTexture(fishTextureKey).setScale(0).setAngle(0).setTint(0xffffff);
        applyRarityGlow(this.fishImage, result.fish.rarity);

        this.weightText.setText('0.00 kg');

        this.setVisible(true);
        this.setAlpha(0);
        this.backdrop.setAlpha(0);
        this.scene.tweens.add({ targets: this.backdrop, alpha: 1, duration: 200 });
        this.scene.tweens.add({ targets: this, alpha: 1, duration: 150 });

        this.scene.tweens.add({
            targets: this.fishImage, scale: 2.1, angle: -8, duration: 420, ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({ targets: this.fishImage, angle: 6, duration: 260, yoyo: true, repeat: 3, ease: 'Sine.inOut' });
            }
        });

        countUpText(this.scene, this.weightText, 0, result.weight, 650, n => formatWeight(n));

        this.hintText.setAlpha(0);
        this.scene.tweens.add({ targets: this.hintText, alpha: 0.8, duration: 300, delay: 500 });
    }

    hide(): void {
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 150, onComplete: () => this.setVisible(false) });
    }
}

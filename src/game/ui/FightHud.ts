import Phaser from 'phaser';
import type { FightSnapshot } from '../systems/fishing/FightModel';
import type { Rarity } from '../constants';
import { RARITY_COLOR } from '../constants';
import { COLORS, FONT_BODY, FONT_DISPLAY } from './theme';

const W = 900;
const H = 96;

/**
 * A slim strip (not a full framed panel) shown above the bottom nav while a
 * fish is hooked: line tension (with a redline snap-grace ring), fish
 * stamina, and reel-in distance. The actual fight plays out in-world (see
 * art/FightView.ts) -- this is just the numbers.
 */
export class FightHud extends Phaser.GameObjects.Container {
    private frame: Phaser.GameObjects.Graphics;
    private barsGfx: Phaser.GameObjects.Graphics;
    private nameText: Phaser.GameObjects.Text;
    private hintText: Phaser.GameObjects.Text;
    private distText: Phaser.GameObjects.Text;
    private phasePips: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        this.frame = scene.add.graphics();
        this.barsGfx = scene.add.graphics();
        this.nameText = scene.add.text(-W / 2 + 18, -H / 2 + 14, '', {
            fontFamily: FONT_DISPLAY, fontSize: '17px', color: '#f4e8cf', fontStyle: '700',
            stroke: '#07161d', strokeThickness: 3
        }).setOrigin(0, 0.5);
        this.phasePips = scene.add.text(-W / 2 + 18, -H / 2 + 34, '', {
            fontFamily: FONT_BODY, fontSize: '13px', color: '#ffd86a', fontStyle: '800'
        }).setOrigin(0, 0.5);
        this.hintText = scene.add.text(0, H / 2 - 12, '', {
            fontFamily: FONT_BODY, fontSize: '14px', color: '#f4e8cf', fontStyle: '800',
            stroke: '#07161d', strokeThickness: 3
        }).setOrigin(0.5);
        this.distText = scene.add.text(W / 2 - 18, -H / 2 + 14, '', {
            fontFamily: FONT_BODY, fontSize: '14px', color: '#8fd6c9', fontStyle: '800'
        }).setOrigin(1, 0.5);
        this.add([this.frame, this.barsGfx, this.nameText, this.phasePips, this.distText, this.hintText]);
        this.drawFrame();
        this.setVisible(false);
        scene.add.existing(this);
    }

    private drawFrame(): void {
        this.frame.clear();
        this.frame.fillStyle(0x071a24, 0.92);
        this.frame.fillRoundedRect(-W / 2, -H / 2, W, H, 16);
        this.frame.lineStyle(2, COLORS.sand, 0.55);
        this.frame.strokeRoundedRect(-W / 2, -H / 2, W, H, 16);
    }

    beginEncounter(fishName: string, rarity: Rarity): void {
        this.nameText.setText(fishName).setColor('#' + RARITY_COLOR[rarity].toString(16).padStart(6, '0'));
        this.setVisible(true).setAlpha(0).setScale(0.95);
        this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 200, ease: 'Cubic.easeOut' });
    }

    update(snap: FightSnapshot): void {
        const barX = -W / 2 + 18, barW = W - 36;
        this.barsGfx.clear();

        // Tension bar: green (safe) / amber (power) / red (redline) zones, a
        // needle, and a pulsing ring around the needle that fills as the
        // snap-grace timer runs out.
        const tensionY = -H / 2 + 52;
        this.barsGfx.fillStyle(0x0d232c, 0.9);
        this.barsGfx.fillRoundedRect(barX, tensionY, barW, 14, 7);
        const zoneColor = snap.tensionZone === 'safe' ? COLORS.accent : snap.tensionZone === 'power' ? COLORS.gold : COLORS.danger;
        this.barsGfx.fillStyle(zoneColor, 1);
        this.barsGfx.fillRoundedRect(barX, tensionY, barW * Phaser.Math.Clamp(snap.tension, 0, 1), 14, 7);
        if (snap.snapGraceFrac > 0) {
            this.barsGfx.lineStyle(3, COLORS.danger, 0.5 + snap.snapGraceFrac * 0.5);
            this.barsGfx.strokeRoundedRect(barX - 2, tensionY - 2, barW + 4, 18, 8);
        }

        // Stamina bar.
        const staminaY = -H / 2 + 72;
        this.barsGfx.fillStyle(0x0d232c, 0.9);
        this.barsGfx.fillRoundedRect(barX, staminaY, barW, 10, 5);
        this.barsGfx.fillStyle(0xef4ccb, 1);
        this.barsGfx.fillRoundedRect(barX, staminaY, barW * Phaser.Math.Clamp(snap.staminaFrac, 0, 1), 10, 5);

        this.distText.setText(`${Math.round(snap.distance * 100)}m away`);
        this.phasePips.setText(snap.phaseIndex > 0 ? '★'.repeat(snap.phaseIndex) : '');

        if (snap.phaseAnnouncing) {
            this.hintText.setText(snap.phaseLabel).setColor('#ffd86a');
        } else if (snap.movePhase === 'telegraph') {
            this.hintText.setText('Brace yourself...').setColor('#ffbf86');
        } else if (snap.movePhase === 'active' && snap.moveLabel) {
            this.hintText.setText(snap.moveLabel).setColor('#ff9a78');
        } else if (snap.tensionZone === 'redline') {
            this.hintText.setText('LINE ABOUT TO SNAP — LET GO!').setColor('#ff5a3d');
        } else if (snap.slackFrac > 0.4) {
            this.hintText.setText('IT\'S GETTING AWAY — REEL IN!').setColor('#ffbf86');
        } else {
            this.hintText.setText('Hold to reel, release to give line').setColor('#f4e8cf');
        }
    }

    endEncounter(): void {
        this.scene.tweens.add({
            targets: this, alpha: 0, scale: 0.96, duration: 160,
            onComplete: () => this.setVisible(false)
        });
    }
}

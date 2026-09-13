import Phaser from 'phaser';
import type { FightSnapshot } from '../systems/fishing/FightModel';
import { DEPTH, RARITY_COLOR, type Rarity } from '../constants';
import { FONT_BODY, FONT_DISPLAY } from './theme';

const W = 900;
const H = 132;

/** The current action is primary; progress and the shared mistake budget are
 * labeled separately. The rod has a reserved lane to the left of this strip. */
export class FightHud extends Phaser.GameObjects.Container {
    private bars: Phaser.GameObjects.Graphics;
    private frame: Phaser.GameObjects.Graphics;
    private showHelp = true;
    private nameText: Phaser.GameObjects.Text;
    private actionText: Phaser.GameObjects.Text;
    private hintText: Phaser.GameObjects.Text;
    private nextText: Phaser.GameObjects.Text;
    private progressText: Phaser.GameObjects.Text;
    private riskText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        const frame = scene.add.graphics();
        this.frame = frame;
        frame.fillStyle(0x071a24, 0.98).fillRoundedRect(-W / 2, -H / 2, W, H, 12);
        frame.lineStyle(2, 0x8db7ba, 0.7).strokeRoundedRect(-W / 2, -H / 2, W, H, 12);
        this.bars = scene.add.graphics();
        const text = (x: number, y: number, size: number, color = '#f4e8cf') => scene.add.text(x, y, '', {
            fontFamily: FONT_BODY, fontSize: size + 'px', fontStyle: '800', color
        }).setOrigin(0, 0.5);
        this.nameText = text(-426, -43, 18);
        this.actionText = text(-426, -4, 34).setFontFamily(FONT_DISPLAY);
        this.hintText = text(-426, 38, 17);
        this.nextText = text(-125, -5, 18);
        this.progressText = text(90, -43, 17, '#90f0cd');
        this.riskText = text(90, 14, 17, '#ffd7ab');
        this.add([frame, this.bars, this.nameText, this.actionText, this.hintText, this.nextText, this.progressText, this.riskText]);
        this.setDepth(DEPTH.MINIGAME).setVisible(false);
        scene.add.existing(this);
    }

    beginEncounter(fishName: string, rarity: Rarity, showHelp: boolean): void {
        this.showHelp = showHelp;
        this.actionText.setVisible(showHelp);
        this.hintText.setVisible(showHelp);
        this.nextText.setVisible(showHelp);
        // Once learned, collapse the tutorial area into a compact status panel.
        this.frame.clear();
        const left = showHelp ? -W / 2 : 66;
        const width = W / 2 - left;
        this.frame.fillStyle(0x071a24, 0.98).fillRoundedRect(left, -H / 2, width, H, 12);
        this.frame.lineStyle(2, 0x8db7ba, 0.7).strokeRoundedRect(left, -H / 2, width, H, 12);
        this.nameText.setX(showHelp ? -426 : 90);
        this.progressText.setY(showHelp ? -43 : -14);
        this.riskText.setY(showHelp ? 14 : 30);
        this.scene.tweens.killTweensOf(this);
        this.nameText.setText(fishName).setColor('#' + RARITY_COLOR[rarity].toString(16).padStart(6, '0'));
        this.setVisible(true).setAlpha(1).setScale(1);
    }

    update(snap: FightSnapshot): void {
        const pulling = snap.requiredAction === 'pull';
        const color = pulling ? 0x72e4bb : 0xffc67d;
        this.actionText.setText(pulling ? 'PULL' : 'RELEASE').setColor(pulling ? '#90f0cd' : '#ffd099');
        this.nextText.setText((pulling ? 'Release in ' : 'Pull in ') + snap.nextActionIn.toFixed(1) + 's');
        const hint = snap.feedback === 'wrong-pull' ? 'Let go! The fish is taking line'
            : snap.feedback === 'missed-pull' ? 'Hold now! The fish is getting away'
            : pulling ? 'Hold mouse / touch / SPACE' : 'Let go and wait for PULL';
        this.hintText.setText(hint).setColor(snap.feedback === 'wrong-pull' || snap.feedback === 'missed-pull' ? '#ffaca0' : '#f4e8cf');
        const progress = Phaser.Math.Clamp(1 - snap.distance / 0.82, 0, 1);
        this.progressText.setText('REELED IN  ' + Math.round(progress * 100) + '%');
        this.riskText.setText('ESCAPE RISK  ' + Math.round(snap.escapeRisk * 100) + '%');
        this.bars.clear();
        if (this.showHelp) {
            this.bars.fillStyle(0x28434b).fillRoundedRect(-125, 15, 175, 6, 3);
            this.bars.fillStyle(color).fillRoundedRect(-125, 15, Math.max(2, 175 * snap.nextActionIn / snap.actionDuration), 6, 3);
        }
        for (const [y, value, fill] of [[this.showHelp ? -25 : 0, progress, 0x72e4bb], [this.showHelp ? 32 : 44, snap.escapeRisk, 0xff806e]]) {
            this.bars.fillStyle(0x28434b).fillRoundedRect(90, y, 332, 13, 5);
            if (value > 0) this.bars.fillStyle(fill).fillRoundedRect(90, y, Math.max(2, 332 * value), 13, 5);
        }
    }

    endEncounter(): void {
        this.scene.tweens.killTweensOf(this);
        this.setVisible(false);
    }
}

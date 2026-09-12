import Phaser from 'phaser';
import { TRACK_HEIGHT, type ReelSnapshot } from '../systems/FishingSystem';
import type { Rarity } from '../constants';
import { RARITY_COLOR } from '../constants';
import { applyRarityGlow } from './glow';
import { COLORS, FONT_BODY, FONT_DISPLAY } from './theme';
import { fitImage } from './fitImage';

const BATTLE_W = 980;
const BATTLE_H = 430;
const ARENA_TOP = 76;
const ARENA_H = 220;
const ARENA_BOTTOM = ARENA_TOP + ARENA_H;

/** A cinematic one-button duel rendered across the water. */
export class ReelMeter extends Phaser.GameObjects.Container {
    private frame: Phaser.GameObjects.Graphics;
    private actionGfx: Phaser.GameObjects.Graphics;
    private tetherGfx: Phaser.GameObjects.Graphics;
    private effectsGfx: Phaser.GameObjects.Graphics;
    private fishIcon: Phaser.GameObjects.Image;
    private title: Phaser.GameObjects.Text;
    private phaseText: Phaser.GameObjects.Text;
    private hintText: Phaser.GameObjects.Text;
    private comboText: Phaser.GameObjects.Text;
    private progressText: Phaser.GameObjects.Text;
    private tensionText: Phaser.GameObjects.Text;
    private fishScale = 1;
    private rarityColor = COLORS.accent;
    private previousPhase: ReelSnapshot['phase'] = 'control';
    private previousFishY = 0;
    private reducedMotion = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.frame = scene.add.graphics();
        this.actionGfx = scene.add.graphics();
        this.tetherGfx = scene.add.graphics();
        this.effectsGfx = scene.add.graphics();
        this.fishIcon = scene.add.image(0, ARENA_TOP + ARENA_H / 2, 'particle-dot').setVisible(false);
        this.title = scene.add.text(-BATTLE_W / 2 + 30, 24, 'LINE BATTLE', {
            fontFamily: FONT_DISPLAY, fontSize: '23px', color: '#f4e8cf', fontStyle: '700'
        }).setOrigin(0, 0.5);
        this.phaseText = scene.add.text(0, 25, 'TRACK THE FISH', {
            fontFamily: FONT_DISPLAY, fontSize: '30px', color: '#72e4d4', fontStyle: '700',
            stroke: '#07161d', strokeThickness: 6
        }).setOrigin(0.5);
        this.hintText = scene.add.text(0, BATTLE_H - 17, 'HOLD to lift  •  RELEASE to lower', {
            fontFamily: FONT_BODY, fontSize: '18px', color: '#f4e8cf', fontStyle: '800',
            stroke: '#07161d', strokeThickness: 3
        }).setOrigin(0.5);
        this.comboText = scene.add.text(BATTLE_W / 2 - 28, 24, '', {
            fontFamily: FONT_DISPLAY, fontSize: '21px', color: '#e7b94f', fontStyle: '700'
        }).setOrigin(1, 0.5);
        this.progressText = scene.add.text(-BATTLE_W / 2 + 30, 326, 'LANDING  18%', {
            fontFamily: FONT_BODY, fontSize: '14px', color: '#f4e8cf', fontStyle: '800',
            stroke: '#07161d', strokeThickness: 2
        }).setOrigin(0, 1);
        this.tensionText = scene.add.text(BATTLE_W / 2 - 30, 363, 'LINE STRAIN  0%', {
            fontFamily: FONT_BODY, fontSize: '14px', color: '#e8c98d', fontStyle: '800',
            stroke: '#07161d', strokeThickness: 2
        }).setOrigin(1, 1);

        this.drawFrame();
        this.add([this.frame, this.actionGfx, this.tetherGfx, this.effectsGfx,
            this.fishIcon, this.title, this.phaseText, this.hintText, this.comboText,
            this.progressText, this.tensionText]);
        this.setVisible(false);
        scene.add.existing(this);
    }

    private drawFrame(): void {
        this.frame.clear();
        this.frame.fillStyle(0x071a24, 0.94);
        this.frame.fillRoundedRect(-BATTLE_W / 2, 0, BATTLE_W, BATTLE_H, 16);
        this.frame.fillStyle(0x123b49, 0.97);
        this.frame.fillRoundedRect(-BATTLE_W / 2 + 8, 60, BATTLE_W - 16, 252, 10);
        this.frame.lineStyle(2, COLORS.sand, 0.68);
        this.frame.strokeRoundedRect(-BATTLE_W / 2, 0, BATTLE_W, BATTLE_H, 16);
        this.frame.lineStyle(1, 0x8edfd8, 0.1);
        for (let i = 1; i < 4; i++) {
            const y = ARENA_TOP + (ARENA_H / 4) * i;
            this.frame.lineBetween(-BATTLE_W / 2 + 20, y, BATTLE_W / 2 - 20, y);
        }
        this.frame.fillStyle(COLORS.panelDeep, 1);
        this.frame.fillRoundedRect(-BATTLE_W / 2 + 28, 330, BATTLE_W - 56, 22, 11);
        this.frame.fillRoundedRect(-BATTLE_W / 2 + 28, 367, BATTLE_W - 56, 16, 8);
    }

    beginEncounter(fishTextureKey: string, rarity: Rarity, fishName = 'Unknown fish'): void {
        this.setVisible(true).setAlpha(0).setScale(0.97);
        this.rarityColor = RARITY_COLOR[rarity];
        this.title.setText(`${fishName}  •  ${rarity.toUpperCase()}`);
        this.fishIcon.setTexture(fishTextureKey).setVisible(true).setDepth(3).clearTint();
        this.fishScale = fitImage(this.fishIcon, 190, 118);
        applyRarityGlow(this.fishIcon, rarity);
        this.previousPhase = 'control';
        this.previousFishY = TRACK_HEIGHT / 2;
        this.scene.tweens.add({ targets: this, alpha: 1, scale: 1,
            duration: this.reducedMotion ? 1 : 260, ease: 'Cubic.easeOut' });
    }

    update(snap: ReelSnapshot): void {
        const mapY = (value: number) => ARENA_BOTTOM - (value / TRACK_HEIGHT) * ARENA_H;
        const fishY = mapY(snap.fishY);
        const fishX = Phaser.Math.Linear(BATTLE_W * 0.29, -BATTLE_W * 0.12, snap.meter);
        const zoneTop = mapY(snap.zoneY + snap.zoneHeight);
        const zoneBottom = mapY(snap.zoneY);
        const zoneHeight = Math.max(8, zoneBottom - zoneTop);
        const time = this.scene.time.now;
        const surge = snap.phase === 'surge';
        const recovery = snap.phase === 'recovery';

        this.actionGfx.clear();
        const zoneColor = surge ? COLORS.coral : snap.inZone ? COLORS.accent : COLORS.accentDeep;
        this.actionGfx.fillStyle(zoneColor, surge ? 0.09 : snap.inZone ? 0.24 : 0.13);
        this.actionGfx.fillRoundedRect(-BATTLE_W / 2 + 18, zoneTop, BATTLE_W - 36, zoneHeight, 8);
        this.actionGfx.lineStyle(snap.inZone ? 3 : 2, zoneColor, snap.inZone ? 0.9 : 0.55);
        this.actionGfx.strokeRoundedRect(-BATTLE_W / 2 + 18, zoneTop, BATTLE_W - 36, zoneHeight, 8);

        const progressW = (BATTLE_W - 56) * snap.meter;
        if (progressW > 1) {
            this.actionGfx.fillStyle(this.rarityColor, 1);
            this.actionGfx.fillRoundedRect(-BATTLE_W / 2 + 28, 330, progressW, 22, 11);
        }
        this.actionGfx.fillStyle(COLORS.cream, 0.9);
        this.actionGfx.fillCircle(-BATTLE_W / 2 + 28 + progressW, 341, 7);

        const tensionW = (BATTLE_W - 56) * snap.tension;
        if (tensionW > 1) {
            this.actionGfx.fillStyle(snap.tension > 0.7 ? COLORS.danger : COLORS.coral, 1);
            this.actionGfx.fillRoundedRect(-BATTLE_W / 2 + 28, 367, tensionW, 16, 8);
        }
        this.actionGfx.fillStyle(COLORS.cream, 0.82);
        this.actionGfx.fillTriangle(-BATTLE_W / 2 + 28, 356, -BATTLE_W / 2 + 40, 356, -BATTLE_W / 2 + 34, 362);
        this.actionGfx.fillTriangle(BATTLE_W / 2 - 40, 356, BATTLE_W / 2 - 28, 356, BATTLE_W / 2 - 34, 362);
        this.progressText.setText(`LANDING  ${Math.round(snap.meter * 100)}%`);
        this.tensionText.setText(`LINE STRAIN  ${Math.round(snap.tension * 100)}%`)
            .setColor(snap.tension > 0.7 ? '#ff9a78' : '#e8c98d');

        const anchorX = -BATTLE_W / 2 + 18;
        const anchorY = ARENA_BOTTOM - 8;
        const lineColor = snap.tension > 0.68 ? COLORS.danger : COLORS.cream;
        const slack = (1 - snap.tension) * (snap.holding ? 13 : 28);
        this.tetherGfx.clear();
        this.tetherGfx.lineStyle(2 + snap.tension * 3, lineColor, 0.95);
        this.tetherGfx.beginPath();
        this.tetherGfx.moveTo(anchorX, anchorY);
        this.tetherGfx.lineTo((anchorX + fishX) / 2, (anchorY + fishY) / 2 + slack);
        this.tetherGfx.lineTo(fishX - 50, fishY);
        this.tetherGfx.strokePath();

        const dy = fishY - mapY(this.previousFishY);
        const tilt = this.reducedMotion ? 0 : Phaser.Math.Clamp(dy * 0.8, -12, 12);
        const pulse = !this.reducedMotion && surge ? 1 + Math.sin(time * 0.035) * 0.055 : 1;
        this.fishIcon.setPosition(fishX, fishY).setAngle(tilt).setScale(this.fishScale * pulse);
        this.previousFishY = snap.fishY;

        this.effectsGfx.clear();
        if (!this.reducedMotion) {
            const trail = surge ? 5 : snap.inZone ? 3 : 2;
            for (let i = 0; i < trail; i++) {
                const phase = time * 0.003 + i * 1.7;
                const bx = fishX + 88 + ((phase * 34) % 120);
                const by = fishY + Math.sin(phase * 2) * 26;
                this.effectsGfx.fillStyle(surge ? COLORS.coral : 0xa9eff0, surge ? 0.45 : 0.28);
                this.effectsGfx.fillCircle(bx, by, 3 + (i % 2) * 2);
            }
        }

        if (surge) {
            this.phaseText.setText(snap.holding ? 'DANGER — GIVE IT SLACK!' : 'SURGE — LINE RELEASED').setColor('#ff9a78');
            this.hintText.setText('RELEASE now  •  Reeling into the run will snap the line').setColor('#ffd2c4');
        } else if (recovery) {
            this.phaseText.setText('IT IS TIRED — REEL!').setColor('#f5ca5c');
            this.hintText.setText('Recovery window  •  Track the fish for bonus progress').setColor('#fff0bd');
        } else {
            this.phaseText.setText(snap.inZone ? 'PRESSURE ON — KEEP REELING' : 'TRACK THE FISH').setColor(snap.inZone ? '#72e4d4' : '#f4e8cf');
            this.hintText.setText('HOLD to lift  •  RELEASE to lower  •  React when it surges').setColor('#f4e8cf');
        }
        this.comboText.setText(snap.combo >= 2 ? `PRESSURE ×${snap.combo}` : '');

        if (snap.phase !== this.previousPhase) {
            if (!this.reducedMotion) {
                this.scene.tweens.add({ targets: this.phaseText, scale: { from: 1.16, to: 1 },
                    duration: 220, ease: 'Cubic.easeOut' });
                if (surge) this.scene.cameras.main.shake(120, 0.004);
            }
            this.previousPhase = snap.phase;
        }
    }

    endEncounter(): void {
        this.scene.tweens.add({ targets: this, alpha: 0, scale: 0.98,
            duration: this.reducedMotion ? 1 : 170,
            onComplete: () => { this.setVisible(false); this.fishIcon.setVisible(false); } });
    }
}

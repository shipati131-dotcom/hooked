import Phaser from 'phaser';
import type { ReelSnapshot } from '../systems/FishingSystem';
import type { Rarity } from '../constants';
import { RARITY_COLOR } from '../constants';
import { applyRarityGlow } from './glow';
import { COLORS, FONT_BODY, FONT_DISPLAY } from './theme';
import { fitImage } from './fitImage';

const BATTLE_W = 980;
const BATTLE_H = 430;
const ARENA_LEFT = -BATTLE_W / 2 + 38;
const ARENA_RIGHT = BATTLE_W / 2 - 38;
const ARENA_TOP = 72;
const ARENA_BOTTOM = 254;
const CHARGE_LEFT = -BATTLE_W / 2 + 110;
const CHARGE_W = BATTLE_W - 220;

/** A timing-driven reel duel: charge a stroke, release in the strike window, slack on a run. */
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
    private resultText: Phaser.GameObjects.Text;
    private fishScale = 1;
    private rarityColor = COLORS.accent;
    private previousPhase: ReelSnapshot['phase'] = 'control';
    private previousPulseSerial = 0;
    private reducedMotion = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.frame = scene.add.graphics();
        this.actionGfx = scene.add.graphics();
        this.tetherGfx = scene.add.graphics();
        this.effectsGfx = scene.add.graphics();
        this.fishIcon = scene.add.image(0, 160, 'particle-dot').setVisible(false);
        this.title = scene.add.text(ARENA_LEFT, 25, 'REEL DUEL', {
            fontFamily: FONT_DISPLAY, fontSize: '22px', color: '#f4e8cf', fontStyle: '700'
        }).setOrigin(0, 0.5);
        this.phaseText = scene.add.text(0, 26, 'BUILD A REEL STROKE', {
            fontFamily: FONT_DISPLAY, fontSize: '29px', color: '#72e4d4', fontStyle: '700',
            stroke: '#07161d', strokeThickness: 6
        }).setOrigin(0.5);
        this.hintText = scene.add.text(0, BATTLE_H - 18, 'HOLD to charge  •  RELEASE inside the gold strike window', {
            fontFamily: FONT_BODY, fontSize: '18px', color: '#f4e8cf', fontStyle: '800',
            stroke: '#07161d', strokeThickness: 3
        }).setOrigin(0.5);
        this.comboText = scene.add.text(ARENA_RIGHT, 25, '', {
            fontFamily: FONT_DISPLAY, fontSize: '21px', color: '#ffd86a', fontStyle: '700'
        }).setOrigin(1, 0.5);
        this.progressText = scene.add.text(ARENA_LEFT, 278, 'FISH DISTANCE  88%', {
            fontFamily: FONT_BODY, fontSize: '14px', color: '#f4e8cf', fontStyle: '800',
            stroke: '#07161d', strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.tensionText = scene.add.text(ARENA_RIGHT, 278, 'LINE STRAIN  0%', {
            fontFamily: FONT_BODY, fontSize: '14px', color: '#e8c98d', fontStyle: '800',
            stroke: '#07161d', strokeThickness: 2
        }).setOrigin(1, 0.5);
        this.resultText = scene.add.text(0, 142, '', {
            fontFamily: FONT_DISPLAY, fontSize: '30px', color: '#fff0bd', fontStyle: '700',
            stroke: '#07161d', strokeThickness: 6
        }).setOrigin(0.5).setDepth(8).setAlpha(0);

        this.drawFrame();
        this.add([this.frame, this.actionGfx, this.tetherGfx, this.effectsGfx,
            this.fishIcon, this.resultText, this.title, this.phaseText, this.hintText,
            this.comboText, this.progressText, this.tensionText]);
        this.setVisible(false);
        scene.add.existing(this);
    }

    private drawFrame(): void {
        this.frame.clear();
        this.frame.fillStyle(0x071a24, 0.96);
        this.frame.fillRoundedRect(-BATTLE_W / 2, 0, BATTLE_W, BATTLE_H, 18);
        this.frame.fillStyle(0x123b49, 0.98);
        this.frame.fillRoundedRect(ARENA_LEFT - 12, ARENA_TOP - 6, ARENA_RIGHT - ARENA_LEFT + 24, ARENA_BOTTOM - ARENA_TOP + 12, 12);
        this.frame.lineStyle(2, COLORS.sand, 0.7);
        this.frame.strokeRoundedRect(-BATTLE_W / 2, 0, BATTLE_W, BATTLE_H, 18);
        this.frame.lineStyle(2, 0xb5edf0, 0.13);
        for (let i = 1; i < 5; i++) {
            const y = ARENA_TOP + i * ((ARENA_BOTTOM - ARENA_TOP) / 5);
            this.frame.lineBetween(ARENA_LEFT, y, ARENA_RIGHT, y);
        }
        this.frame.fillStyle(COLORS.panelDeep, 1);
        this.frame.fillRoundedRect(ARENA_LEFT, 292, ARENA_RIGHT - ARENA_LEFT, 18, 9);
        this.frame.fillRoundedRect(ARENA_LEFT, 318, ARENA_RIGHT - ARENA_LEFT, 12, 6);
        this.frame.fillRoundedRect(CHARGE_LEFT, 348, CHARGE_W, 34, 12);
    }

    beginEncounter(fishTextureKey: string, rarity: Rarity, fishName = 'Unknown fish'): void {
        this.setVisible(true).setAlpha(0).setScale(0.97);
        this.rarityColor = RARITY_COLOR[rarity];
        this.title.setText(`${fishName}  •  ${rarity.toUpperCase()}`);
        this.fishIcon.setTexture(fishTextureKey).setVisible(true).setDepth(3).clearTint();
        this.fishScale = fitImage(this.fishIcon, 190, 118);
        applyRarityGlow(this.fishIcon, rarity);
        this.previousPhase = 'control';
        this.previousPulseSerial = 0;
        this.scene.tweens.add({ targets: this, alpha: 1, scale: 1,
            duration: this.reducedMotion ? 1 : 230, ease: 'Cubic.easeOut' });
    }

    update(snap: ReelSnapshot): void {
        const time = this.scene.time.now;
        const surge = snap.phase === 'surge';
        const recovery = snap.phase === 'recovery';
        const fishX = Phaser.Math.Linear(ARENA_RIGHT - 130, ARENA_LEFT + 145, snap.meter);
        const fishY = 160 + Math.sin(time * (surge ? 0.014 : 0.005) + snap.fishY * 0.02) * (surge ? 45 : 20);

        this.actionGfx.clear();
        this.actionGfx.lineStyle(surge ? 5 : 3, surge ? COLORS.coral : 0x89dce0, surge ? 0.58 : 0.22);
        const streakCount = surge ? 6 : 3;
        for (let i = 0; i < streakCount; i++) {
            const sy = ARENA_TOP + 24 + i * 27;
            const drift = (time * (surge ? 0.35 : 0.12) + i * 90) % 230;
            this.actionGfx.lineBetween(ARENA_RIGHT - drift, sy, ARENA_RIGHT - drift - (surge ? 78 : 38), sy);
        }

        const progressW = (ARENA_RIGHT - ARENA_LEFT) * snap.meter;
        if (progressW > 1) {
            this.actionGfx.fillStyle(this.rarityColor, 1);
            this.actionGfx.fillRoundedRect(ARENA_LEFT, 292, progressW, 18, 9);
        }
        const tensionW = (ARENA_RIGHT - ARENA_LEFT) * snap.tension;
        if (tensionW > 1) {
            this.actionGfx.fillStyle(snap.tension > 0.7 ? COLORS.danger : COLORS.coral, 1);
            this.actionGfx.fillRoundedRect(ARENA_LEFT, 318, tensionW, 12, 6);
        }
        this.progressText.setText(`FISH DISTANCE  ${Math.round((1 - snap.meter) * 100)}%`);
        this.tensionText.setText(`LINE STRAIN  ${Math.round(snap.tension * 100)}%`).setColor(snap.tension > 0.7 ? '#ff9a78' : '#e8c98d');

        const sweetX = CHARGE_LEFT + snap.sweetSpotStart * CHARGE_W;
        const sweetW = (snap.sweetSpotEnd - snap.sweetSpotStart) * CHARGE_W;
        this.actionGfx.fillStyle(recovery ? 0x72e4d4 : COLORS.gold, 0.88);
        this.actionGfx.fillRoundedRect(sweetX, 352, sweetW, 26, 8);
        const perfectCenter = CHARGE_LEFT + ((snap.sweetSpotStart + snap.sweetSpotEnd) / 2) * CHARGE_W;
        this.actionGfx.fillStyle(0xfff2ba, 0.9);
        this.actionGfx.fillRect(perfectCenter - 3, 350, 6, 30);
        const markerX = CHARGE_LEFT + snap.charge * CHARGE_W;
        this.actionGfx.fillStyle(surge ? COLORS.coral : COLORS.cream, 1);
        this.actionGfx.fillTriangle(markerX - 11, 342, markerX + 11, 342, markerX, 352);
        this.actionGfx.fillRoundedRect(markerX - 4, 348, 8, 38, 4);

        const anchorX = ARENA_LEFT + 5;
        const anchorY = ARENA_BOTTOM - 14;
        const lineColor = snap.tension > 0.68 ? COLORS.danger : COLORS.cream;
        const slack = (1 - snap.tension) * (surge && !snap.holding ? 42 : 18);
        this.tetherGfx.clear();
        this.tetherGfx.lineStyle(2 + snap.tension * 3, lineColor, 0.96);
        this.tetherGfx.beginPath();
        this.tetherGfx.moveTo(anchorX, anchorY);
        this.tetherGfx.lineTo((anchorX + fishX) / 2, (anchorY + fishY) / 2 + slack);
        this.tetherGfx.lineTo(fishX - 50, fishY);
        this.tetherGfx.strokePath();

        const pulse = !this.reducedMotion && (surge || snap.holding) ? 1 + Math.sin(time * 0.03) * 0.045 : 1;
        this.fishIcon.setPosition(fishX, fishY).setAngle(surge ? Math.sin(time * 0.02) * 8 : 0).setScale(this.fishScale * pulse);

        this.effectsGfx.clear();
        if (snap.holding && !surge) {
            this.effectsGfx.lineStyle(3, COLORS.gold, 0.75);
            this.effectsGfx.strokeCircle(anchorX + 36, anchorY - 18, 12 + snap.charge * 16);
        }

        if (surge) {
            this.phaseText.setText(snap.holding ? 'FISH RUN — RELEASE!' : 'GOOD SLACK — HOLD FIRE').setColor('#ff9a78');
            this.hintText.setText('Do not charge during a run  •  Wait for the counter window').setColor('#ffd2c4');
        } else if (recovery) {
            this.phaseText.setText('COUNTER WINDOW — BIG PULL!').setColor('#f5ca5c');
            this.hintText.setText('The strike window is wider and every accurate stroke hits harder').setColor('#fff0bd');
        } else if (snap.surgeWarning) {
            this.phaseText.setText('RUN INCOMING — FINISH YOUR STROKE').setColor('#ffbf86');
            this.hintText.setText('Release in gold, then give the fish slack').setColor('#ffe0bd');
        } else {
            this.phaseText.setText(snap.holding ? 'CHARGING — RELEASE IN GOLD' : 'BUILD A REEL STROKE').setColor('#72e4d4');
            this.hintText.setText('HOLD to charge  •  RELEASE inside the gold strike window').setColor('#f4e8cf');
        }
        this.comboText.setText(snap.combo >= 2 ? `STREAK ×${snap.combo}` : '');

        if (snap.pulseSerial !== this.previousPulseSerial) {
            this.showPulseResult(snap.pulseResult);
            this.previousPulseSerial = snap.pulseSerial;
        }
        if (snap.phase !== this.previousPhase) {
            if (!this.reducedMotion) {
                this.scene.tweens.add({ targets: this.phaseText, scale: { from: 1.14, to: 1 }, duration: 190, ease: 'Cubic.easeOut' });
                if (surge) this.scene.cameras.main.shake(110, 0.004);
            }
            this.previousPhase = snap.phase;
        }
    }

    private showPulseResult(result: ReelSnapshot['pulseResult']): void {
        const copy = result === 'perfect' ? 'PERFECT PULL!' : result === 'good' ? 'SOLID PULL' : result === 'overload' ? 'OVERCRANKED!' : 'GLANCING PULL';
        const color = result === 'perfect' ? '#fff0a8' : result === 'good' ? '#72e4d4' : '#ff9a78';
        this.resultText.setText(copy).setColor(color).setAlpha(1).setScale(result === 'perfect' ? 1.25 : 1.05).setY(142);
        this.scene.tweens.killTweensOf(this.resultText);
        this.scene.tweens.add({ targets: this.resultText, alpha: 0, y: 118, scale: 1, duration: this.reducedMotion ? 1 : 520, ease: 'Cubic.easeOut' });
    }

    endEncounter(): void {
        this.scene.tweens.add({ targets: this, alpha: 0, scale: 0.98, duration: this.reducedMotion ? 1 : 170,
            onComplete: () => { this.setVisible(false); this.fishIcon.setVisible(false); } });
    }
}

import Phaser from 'phaser';
import { COLORS, FONT_DISPLAY } from './theme';

const BAR_H = 300;
const BAR_W = 26;

/**
 * The aim/power-timing cast gauge: a vertical power bar with a ping-pong
 * needle and a gold "sweet band" (the power this cast's distance needs),
 * shown near the rod while the player is charging a cast.
 */
export class CastMeter extends Phaser.GameObjects.Container {
    private frame: Phaser.GameObjects.Graphics;
    private fillGfx: Phaser.GameObjects.Graphics;
    private label: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        this.frame = scene.add.graphics();
        this.fillGfx = scene.add.graphics();
        this.label = scene.add.text(0, -BAR_H / 2 - 20, 'HOLD, RELEASE IN GOLD', {
            fontFamily: FONT_DISPLAY, fontSize: '15px', color: '#f4e8cf', fontStyle: '700',
            stroke: '#07161d', strokeThickness: 3
        }).setOrigin(0.5);
        this.add([this.frame, this.fillGfx, this.label]);
        this.drawFrame();
        this.setVisible(false);
        scene.add.existing(this);
    }

    private drawFrame(): void {
        this.frame.clear();
        this.frame.fillStyle(0x071a24, 0.85);
        this.frame.fillRoundedRect(-BAR_W / 2 - 6, -BAR_H / 2 - 6, BAR_W + 12, BAR_H + 12, 10);
        this.frame.lineStyle(2, COLORS.sand, 0.6);
        this.frame.strokeRoundedRect(-BAR_W / 2 - 6, -BAR_H / 2 - 6, BAR_W + 12, BAR_H + 12, 10);
    }

    /** `power` and `sweetCenter`/`sweetHalf` are all 0..1 power units (bottom = 0, top = 1). */
    update(power: number, sweetCenter: number, sweetHalf: number, outOfReach: boolean): void {
        this.fillGfx.clear();
        const top = -BAR_H / 2, bottom = BAR_H / 2;
        const yFor = (v: number) => bottom - Phaser.Math.Clamp(v, 0, 1) * BAR_H;

        // Track background.
        this.fillGfx.fillStyle(0x0d232c, 0.9);
        this.fillGfx.fillRoundedRect(-BAR_W / 2, top, BAR_W, BAR_H, 6);

        // Sweet band.
        if (!outOfReach) {
            const bandTop = yFor(Math.min(1, sweetCenter + sweetHalf));
            const bandBottom = yFor(Math.max(0, sweetCenter - sweetHalf));
            this.fillGfx.fillStyle(COLORS.gold, 0.85);
            this.fillGfx.fillRoundedRect(-BAR_W / 2, bandTop, BAR_W, Math.max(2, bandBottom - bandTop), 4);
        }

        // Needle.
        const needleY = yFor(power);
        this.fillGfx.fillStyle(outOfReach ? COLORS.danger : 0xffffff, 1);
        this.fillGfx.fillRoundedRect(-BAR_W / 2 - 5, needleY - 3, BAR_W + 10, 6, 3);

        this.label.setText(outOfReach ? 'OUT OF REACH' : 'HOLD, RELEASE IN GOLD');
        this.label.setColor(outOfReach ? '#ff9a78' : '#f4e8cf');
    }

    showAt(x: number, y: number): void { this.setPosition(x, y).setVisible(true); }
    hide(): void { this.setVisible(false); }
}

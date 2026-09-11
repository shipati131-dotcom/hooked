import Phaser from 'phaser';

export interface ProgressBarOptions {
    width: number;
    height: number;
    bgColor?: number;
    fillColor?: number;
    radius?: number;
}

/** A simple rounded progress bar with a smoothed fill tween and an optional pulse. */
export class ProgressBar extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Graphics;
    private fill: Phaser.GameObjects.Graphics;
    private boxW: number;
    private boxH: number;
    private radius: number;
    private fillColor: number;
    private value = 0;
    private displayValue = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, opts: ProgressBarOptions) {
        super(scene, x, y);
        this.boxW = opts.width;
        this.boxH = opts.height;
        this.radius = opts.radius ?? this.boxH / 2;
        this.fillColor = opts.fillColor ?? 0x4dd4c4;

        this.bg = scene.add.graphics();
        this.bg.fillStyle(opts.bgColor ?? 0x0c2733, 0.7);
        this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, this.radius);

        this.fill = scene.add.graphics();
        this.add([this.bg, this.fill]);
        this.redraw();
        scene.add.existing(this);
    }

    setColor(color: number): this { this.fillColor = color; this.redraw(); return this; }

    /** Instantly jumps the bar (used on scene entry so it doesn't animate from 0). */
    setValueImmediate(v: number): this {
        this.value = Phaser.Math.Clamp(v, 0, 1);
        this.displayValue = this.value;
        this.redraw();
        return this;
    }

    setValue(v: number, animate = true): this {
        this.value = Phaser.Math.Clamp(v, 0, 1);
        if (!animate) { this.displayValue = this.value; this.redraw(); return this; }
        this.scene.tweens.add({
            targets: this, displayValue: this.value, duration: 400, ease: 'Cubic.easeOut',
            onUpdate: () => this.redraw()
        });
        return this;
    }

    private redraw(): void {
        this.fill.clear();
        const w = Math.max(0, this.boxW * this.displayValue);
        if (w <= 0) return;
        this.fill.fillStyle(this.fillColor, 1);
        this.fill.fillRoundedRect(0, 0, w, this.boxH, Math.min(this.radius, w / 2));
    }
}

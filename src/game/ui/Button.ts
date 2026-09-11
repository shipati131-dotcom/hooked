import Phaser from 'phaser';
import { COLORS } from './theme';

export interface ButtonOptions {
    width?: number;
    height?: number;
    color?: number;
    textColor?: string;
    fontSize?: number;
    disabled?: boolean;
}

/** A chunky pill button with a bottom "lip" that presses down on click, plus hover scale. */
export class Button extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Graphics;
    private label: Phaser.GameObjects.Text;
    private boxW: number;
    private boxH: number;
    private color: number;
    private disabled: boolean;
    private onClick?: () => void;

    constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick?: () => void, opts: ButtonOptions = {}) {
        super(scene, x, y);
        this.boxW = opts.width ?? 220;
        this.boxH = opts.height ?? 64;
        this.color = opts.color ?? COLORS.accent;
        this.disabled = opts.disabled ?? false;
        this.onClick = onClick;

        this.bg = scene.add.graphics();
        this.label = scene.add.text(0, -3, text, {
            fontFamily: 'Fredoka, sans-serif',
            fontSize: `${opts.fontSize ?? 24}px`,
            color: opts.textColor ?? '#0c2733',
            fontStyle: '600'
        }).setOrigin(0.5);

        this.add([this.bg, this.label]);
        this.redraw(false);
        this.setSize(this.boxW, this.boxH);
        this.setInteractive({ useHandCursor: !this.disabled });

        this.on('pointerover', () => { if (!this.disabled) scene.tweens.add({ targets: this, scale: 1.04, duration: 90 }); });
        this.on('pointerout', () => { this.redraw(false); scene.tweens.add({ targets: this, scale: 1.0, duration: 90 }); });
        this.on('pointerdown', () => { if (!this.disabled) this.redraw(true); });
        this.on('pointerup', () => {
            if (this.disabled) return;
            this.redraw(false);
            scene.tweens.add({ targets: this, scale: 1.04, duration: 60, yoyo: true });
            this.onClick?.();
        });

        scene.add.existing(this);
    }

    setLabel(text: string): this { this.label.setText(text); return this; }

    setDisabled(disabled: boolean): this {
        this.disabled = disabled;
        this.setInteractive({ useHandCursor: !disabled });
        this.redraw(false);
        return this;
    }

    setColorTheme(color: number): this { this.color = color; this.redraw(false); return this; }

    private redraw(pressed: boolean): void {
        const g = this.bg;
        g.clear();
        const w = this.boxW, h = this.boxH, r = h / 2;
        const lip = pressed ? 2 : 6;
        const color = this.disabled ? COLORS.muted : this.color;
        const dark = Phaser.Display.Color.ValueToColor(color).darken(28).color;

        g.fillStyle(dark, 1);
        g.fillRoundedRect(-w / 2, -h / 2 + lip, w, h, r);
        g.fillStyle(color, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h - lip, r);
        if (!this.disabled) {
            g.fillStyle(0xffffff, 0.16);
            g.fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * 0.35, r * 0.6);
        }
        this.label.setY(pressed ? -3 + 3 : -3);
        this.label.setAlpha(this.disabled ? 0.6 : 1);
    }
}

export function pillLabel(scene: Phaser.Scene, x: number, y: number, text: string, color: number, textColor = '#0c2733'): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const t = scene.add.text(0, 0, text, { fontFamily: 'Nunito, sans-serif', fontSize: '16px', color: textColor, fontStyle: '800' }).setOrigin(0.5);
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(-t.width / 2 - 12, -t.height / 2 - 6, t.width + 24, t.height + 12, (t.height + 12) / 2);
    c.add([g, t]);
    return c;
}

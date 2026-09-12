import Phaser from 'phaser';
import { COLORS } from './theme';

export interface ButtonOptions {
    width?: number;
    height?: number;
    color?: number;
    textColor?: string;
    fontSize?: number;
    disabled?: boolean;
    iconKey?: string;
    iconSize?: number;
    iconGap?: number;
}

/** A chunky carved-plaque button (not a stadium pill) with a bottom "lip" that presses down on click, plus hover scale. */
export class Button extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Graphics;
    private label: Phaser.GameObjects.Text;
    private boxW: number;
    private boxH: number;
    private color: number;
    private disabled: boolean;
    private onClick?: () => void;
    private icon?: Phaser.GameObjects.Image;

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
            fontSize: `${opts.fontSize ?? 26}px`,
            color: opts.textColor ?? '#17252b',
            fontStyle: '700',
            stroke: '#00000022',
            strokeThickness: 1
        }).setOrigin(0.5);

        if (opts.iconKey) {
            const iconSize = opts.iconSize ?? 19;
            const gap = opts.iconGap ?? 8;
            const groupW = iconSize + gap + this.label.width;
            this.icon = scene.add.image(-groupW / 2 + iconSize / 2, -3, opts.iconKey)
                .setDisplaySize(iconSize, iconSize);
            this.label.setX(this.icon.x + iconSize / 2 + gap + this.label.width / 2);
        }

        this.add(this.icon ? [this.bg, this.icon, this.label] : [this.bg, this.label]);
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
        const w = this.boxW, h = this.boxH;
        const r = Math.min(14, h * 0.26); // carved-plaque corner, not a stadium pill
        const lip = pressed ? 2 : 6;
        const color = this.disabled ? COLORS.muted : this.color;
        const dark = Phaser.Display.Color.ValueToColor(color).darken(30).color;
        const edge = Phaser.Display.Color.ValueToColor(color).darken(14).color;

        // base shadow/lip
        g.fillStyle(dark, 1);
        g.fillRoundedRect(-w / 2, -h / 2 + lip, w, h, r);
        // top face
        g.fillStyle(color, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h - lip, r);
        // inset edge line reads as a carved/painted plaque rather than a glossy web button
        if (!this.disabled) {
            g.lineStyle(2, edge, 0.5);
            g.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - lip - 4, Math.max(2, r - 2));
        }
        this.label.setY(pressed ? -3 + 3 : -3);
        this.icon?.setY(pressed ? 0 : -3);
        this.label.setAlpha(this.disabled ? 0.6 : 1);
        this.icon?.setAlpha(this.disabled ? 0.6 : 1);
    }
}

export function pillLabel(scene: Phaser.Scene, x: number, y: number, text: string, color: number, textColor = '#17252b'): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const t = scene.add.text(0, 0, text, { fontFamily: 'Nunito, sans-serif', fontSize: '17px', color: textColor, fontStyle: '800' }).setOrigin(0.5);
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(-t.width / 2 - 12, -t.height / 2 - 6, t.width + 24, t.height + 12, (t.height + 12) / 2);
    c.add([g, t]);
    return c;
}

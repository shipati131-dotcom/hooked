import type Phaser from 'phaser';

export const COLORS = {
    bg: 0x0b2a3a,
    panel: 0x0f3b4f,
    panelLight: 0x155066,
    ink: 0x0c2733,
    cream: 0xfff6e0,
    gold: 0xf7d585,
    goldDark: 0xd9a83d,
    accent: 0x4dd4c4,
    accentDark: 0x2fa89a,
    danger: 0xe15a4a,
    success: 0x4caf6a,
    muted: 0x8fa8b0
};

export const FONT_DISPLAY = 'Fredoka, "Trebuchet MS", sans-serif';
export const FONT_BODY = 'Nunito, "Trebuchet MS", sans-serif';

export function displayStyle(size: number, color = '#fff6e0'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: FONT_DISPLAY,
        fontSize: `${size}px`,
        color,
        stroke: '#0c2733',
        strokeThickness: Math.max(2, Math.round(size / 9)),
        shadow: { offsetX: 0, offsetY: Math.max(2, size / 14), color: '#00000055', blur: 4, fill: true }
    };
}

export function bodyStyle(size: number, color = '#eaf6f8'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: FONT_BODY,
        fontSize: `${size}px`,
        color,
        fontStyle: '600'
    };
}

export function hex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
}

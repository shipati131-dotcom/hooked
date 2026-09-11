import type Phaser from 'phaser';

/**
 * HOOKED's palette: a warm tackle-box world (deep navy water, sand, cream
 * paper) with a coral accent for calls-to-action and gold for rewards.
 * Rarity colors live in constants.ts alongside RARITY_ORDER/RARITY_LABEL.
 */
export const COLORS = {
    bg: 0x102a36,        // deep ocean navy -- base backdrop behind every panel
    panel: 0x16333f,     // panel body, one step up from bg
    panelDeep: 0x0d232c, // ribbon headers / recessed wells
    ink: 0x17252b,       // strokes, text outlines, shadows
    cream: 0xf4e8cf,     // primary UI text on dark panels
    sand: 0xe8c98d,      // warm secondary text / dividers
    accent: 0x3ab7a7,    // bright tropical water -- primary interactive color
    accentDeep: 0x237c83,// water teal -- pressed/deep state of accent
    coral: 0xe8754f,     // coral -- CTA buttons, warm highlights
    coralDeep: 0xb85638,
    gold: 0xe7b94f,      // reward color -- coins, XP, purchases
    goldDeep: 0xb8912f,
    danger: 0xc24b3d,    // destructive actions only (reset save)
    muted: 0x5c7680      // disabled / locked state
};

export const FONT_DISPLAY = 'Fredoka, "Trebuchet MS", sans-serif';
export const FONT_BODY = 'Nunito, "Trebuchet MS", sans-serif';

export function displayStyle(size: number, color = '#f4e8cf'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: FONT_DISPLAY,
        fontSize: `${size}px`,
        color,
        stroke: '#17252b',
        strokeThickness: Math.max(2, Math.round(size / 9)),
        shadow: { offsetX: 0, offsetY: Math.max(2, size / 14), color: '#00000055', blur: 4, fill: true }
    };
}

export function bodyStyle(size: number, color = '#e7f0ee'): Phaser.Types.GameObjects.Text.TextStyle {
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

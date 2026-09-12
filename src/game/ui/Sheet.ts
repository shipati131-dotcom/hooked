import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../constants';
import { COLORS } from './theme';

export interface Sheet {
    root: Phaser.GameObjects.Container;
    content: Phaser.GameObjects.Container;
    width: number;
    height: number;
}

/** A full-screen dimmed backdrop + a ribbon-header panel frame, shared by every overlay scene. */
export function buildSheet(scene: Phaser.Scene, title: string, onClose: () => void): Sheet {
    const width = GAME_WIDTH - 200;
    const height = GAME_HEIGHT - 160;
    const x = GAME_WIDTH / 2, y = GAME_HEIGHT / 2;

    const root = scene.add.container(0, 0).setDepth(DEPTH.UI_PANEL);
    const backdrop = scene.add.rectangle(x, y, GAME_WIDTH, GAME_HEIGHT, 0x03141c, 0.78).setInteractive();
    backdrop.on('pointerdown', () => { /* absorb clicks so they don't reach the scene below */ });

    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.panel, 0.98);
    panel.fillRoundedRect(x - width / 2, y - height / 2, width, height, 16);
    panel.lineStyle(2, COLORS.sand, 0.22);
    panel.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 16);

    const ribbon = scene.add.graphics();
    ribbon.fillStyle(COLORS.panelDeep, 1);
    ribbon.fillRoundedRect(x - width / 2, y - height / 2, width, 86, { tl: 16, tr: 16, bl: 0, br: 0 });
    ribbon.lineStyle(2, COLORS.sand, 0.15);
    ribbon.lineBetween(x - width / 2, y - height / 2 + 86, x + width / 2, y - height / 2 + 86);

    const titleText = scene.add.text(x - width / 2 + 36, y - height / 2 + 43, title, {
        fontFamily: 'Fredoka, sans-serif', fontSize: '34px', color: '#f4e8cf', fontStyle: '700',
        stroke: '#07161d', strokeThickness: 4
    }).setOrigin(0, 0.5);

    const closeBtn = scene.add.container(x + width / 2 - 44, y - height / 2 + 43);
    const closeBg = scene.add.circle(0, 0, 20, COLORS.panel, 1).setStrokeStyle(2, COLORS.sand, 0.3);
    const closeX = scene.add.text(0, -2, '✕', { fontFamily: 'Nunito, sans-serif', fontSize: '18px', color: '#f4e8cf' }).setOrigin(0.5);
    closeBtn.add([closeBg, closeX]);
    closeBtn.setSize(44, 44).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBg.setFillStyle(COLORS.coral));
    closeBtn.on('pointerout', () => closeBg.setFillStyle(COLORS.panel));
    closeBtn.on('pointerdown', onClose);

    const content = scene.add.container(0, 0);

    const topGuard = scene.add.rectangle(x, (y - height / 2) / 2, GAME_WIDTH, y - height / 2, 0x03141c, 1);
    const bottomEdge = y + height / 2;
    const bottomGuard = scene.add.rectangle(x, bottomEdge + (GAME_HEIGHT - bottomEdge) / 2, GAME_WIDTH, GAME_HEIGHT - bottomEdge, 0x03141c, 1);

    // Content is below the header so an aggressively scrolled list can never
    // paint rows over the ribbon, even on renderers with container-mask quirks.
    root.add([backdrop, panel, content, topGuard, bottomGuard, ribbon, titleText, closeBtn]);
    return { root, content, width, height };
}

export function statChip(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const t = scene.add.text(0, 0, text, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#d8c9a3', fontStyle: '700' }).setOrigin(0, 0.5);
    c.add(t);
    return c;
}

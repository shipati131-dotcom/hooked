import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../constants';

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
    panel.fillStyle(0x0f3b4f, 0.98);
    panel.fillRoundedRect(x - width / 2, y - height / 2, width, height, 22);
    panel.lineStyle(2, 0xffffff, 0.08);
    panel.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 22);

    const ribbon = scene.add.graphics();
    ribbon.fillStyle(0x08222d, 1);
    ribbon.fillRoundedRect(x - width / 2, y - height / 2, width, 86, { tl: 22, tr: 22, bl: 0, br: 0 });

    const titleText = scene.add.text(x - width / 2 + 36, y - height / 2 + 43, title, {
        fontFamily: 'Fredoka, sans-serif', fontSize: '32px', color: '#fff6e0'
    }).setOrigin(0, 0.5);

    const closeBtn = scene.add.container(x + width / 2 - 44, y - height / 2 + 43);
    const closeBg = scene.add.circle(0, 0, 22, 0x1a4a5c, 1).setStrokeStyle(2, 0xffffff, 0.2);
    const closeX = scene.add.text(0, -2, '✕', { fontFamily: 'Nunito, sans-serif', fontSize: '20px', color: '#eaf6f8' }).setOrigin(0.5);
    closeBtn.add([closeBg, closeX]);
    closeBtn.setSize(44, 44).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBg.setFillStyle(0x2a6a80));
    closeBtn.on('pointerout', () => closeBg.setFillStyle(0x1a4a5c));
    closeBtn.on('pointerdown', onClose);

    const content = scene.add.container(0, 0);

    root.add([backdrop, panel, ribbon, titleText, closeBtn, content]);
    return { root, content, width, height };
}

export function statChip(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const t = scene.add.text(0, 0, text, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#c9e8ec', fontStyle: '700' }).setOrigin(0, 0.5);
    c.add(t);
    return c;
}

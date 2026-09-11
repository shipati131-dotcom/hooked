import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../constants';
import { Button } from './Button';
import { COLORS } from './theme';

/** A simple modal confirm/cancel dialog, used for destructive actions like resetting the save. */
export function showConfirmDialog(scene: Phaser.Scene, title: string, message: string, onConfirm: () => void): void {
    const root = scene.add.container(0, 0).setDepth(DEPTH.UI_POPUP + 50);
    const backdrop = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();

    const w = 480, h = 220;
    const panel = scene.add.graphics();
    panel.fillStyle(0x0f3b4f, 1);
    panel.fillRoundedRect(GAME_WIDTH / 2 - w / 2, GAME_HEIGHT / 2 - h / 2, w, h, 18);
    panel.lineStyle(2, 0xe15a4a, 0.6);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - w / 2, GAME_HEIGHT / 2 - h / 2, w, h, 18);

    const titleText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - h / 2 + 36, title, {
        fontFamily: 'Fredoka, sans-serif', fontSize: '26px', color: '#fff6e0'
    }).setOrigin(0.5);
    const msgText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, message, {
        fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#c9e8ec', align: 'center', wordWrap: { width: w - 60 }
    }).setOrigin(0.5);

    root.add([backdrop, panel, titleText, msgText]);

    const cancelBtn = new Button(scene, GAME_WIDTH / 2 - 110, GAME_HEIGHT / 2 + h / 2 - 44, 'CANCEL', () => root.destroy(), {
        width: 180, height: 52, color: COLORS.muted, fontSize: 18
    });
    const confirmBtn = new Button(scene, GAME_WIDTH / 2 + 110, GAME_HEIGHT / 2 + h / 2 - 44, 'CONFIRM', () => {
        root.destroy();
        onConfirm();
    }, { width: 180, height: 52, color: COLORS.danger, fontSize: 18, textColor: '#fff6e0' });

    root.add([cancelBtn, confirmBtn]);
}

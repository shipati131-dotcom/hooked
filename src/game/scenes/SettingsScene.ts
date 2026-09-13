import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { getServices } from '../core/services';
import { buildSheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { COLORS } from '../ui/theme';
import { showConfirmDialog } from '../ui/ConfirmDialog';

export class SettingsScene extends Phaser.Scene {
    constructor() { super(SCENE_KEYS.SETTINGS); }

    create(): void {
        const services = getServices(this);
        const sheet = buildSheet(this, 'Settings', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        let y = top + 140;

        const label = (text: string) => this.add.text(left + 60, y, text, {
            fontFamily: 'Nunito, sans-serif', fontSize: '18px', color: '#d8c9a3', fontStyle: '700'
        });

        sheet.content.add(label('Sound Effects Volume'));
        const sfxBar = new ProgressBar(this, left + 60, y + 34, { width: 300, height: 16, fillColor: COLORS.accent });
        sfxBar.setValueImmediate(services.save.settings.sfxVolume);
        sheet.content.add(sfxBar);
        y += 90;

        sheet.content.add(label('Music Volume'));
        const musicBar = new ProgressBar(this, left + 60, y + 34, { width: 300, height: 16, fillColor: COLORS.accent });
        musicBar.setValueImmediate(services.save.settings.musicVolume);
        sheet.content.add(musicBar);
        y += 90;

        const muteBtn = new Button(this, left + 160, y + 20,
            services.save.settings.muted ? 'UNMUTE' : 'MUTE',
            () => {
                services.save.settings.muted = !services.save.settings.muted;
                muteBtn.setLabel(services.save.settings.muted ? 'UNMUTE' : 'MUTE');
                services.requestSave();
            }, { width: 220, height: 52, color: COLORS.muted, fontSize: 18 }
        );
        sheet.content.add(muteBtn);
        y += 90;

        sheet.content.add(this.add.text(left + 60, y, 'Helped mode', {
            fontFamily: 'Nunito, sans-serif', fontSize: '22px', color: '#f4e8cf', fontStyle: '800'
        }));
        sheet.content.add(this.add.text(left + 60, y + 34, 'Show pull / release tags, instructions and countdowns during battles.', {
            fontFamily: 'Nunito, sans-serif', fontSize: '17px', color: '#d8c9a3', fontStyle: '700'
        }));
        const helpEnabled = () => services.save.settings.helpedMode ?? services.save.stats.totalCaught < 5;
        const helpBtn = new Button(this, left + 1040, y + 28, helpEnabled() ? 'ON' : 'OFF', () => {
            services.save.settings.helpedMode = !helpEnabled();
            helpBtn.setLabel(helpEnabled() ? 'ON' : 'OFF');
            helpBtn.setColorTheme(helpEnabled() ? COLORS.accent : COLORS.muted);
            services.requestSave();
        }, { width: 140, height: 54, fontSize: 22, color: helpEnabled() ? COLORS.accent : COLORS.muted });
        sheet.content.add(helpBtn);
        y += 120;

        sheet.content.add(this.add.text(left + 60, y, 'Danger Zone', {
            fontFamily: 'Fredoka, sans-serif', fontSize: '20px', color: '#c24b3d', fontStyle: '700'
        }));
        y += 40;

        const resetBtn = new Button(this, left + 160, y + 20, 'RESET SAVE', () => {
            showConfirmDialog(this, 'Reset your save?', 'This permanently deletes all progress: coins, level, gear, records and achievements. This cannot be undone.', () => {
                services.resetSave();
            });
        }, { width: 260, height: 56, color: COLORS.danger, fontSize: 18, textColor: '#f4e8cf' });
        sheet.content.add(resetBtn);
    }

    private close(): void {
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.FISHING);
    }
}

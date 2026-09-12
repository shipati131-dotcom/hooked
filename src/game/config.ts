import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS_BG } from './constants';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { FishingScene } from './scenes/FishingScene';
import { HudScene } from './scenes/HudScene';
import { ShopScene } from './scenes/ShopScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { CollectionScene } from './scenes/CollectionScene';
import { AchievementScene } from './scenes/AchievementScene';
import { MapScene } from './scenes/MapScene';
import { SettingsScene } from './scenes/SettingsScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS_BG,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        expandParent: true
    },
    input: {
        activePointers: 2
    },
    scene: [BootScene, MenuScene, FishingScene, HudScene, ShopScene, UpgradeScene, CollectionScene, AchievementScene, MapScene, SettingsScene]
};

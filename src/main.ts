import Phaser from 'phaser';
import { gameConfig } from './game/config';

const game = new Phaser.Game(gameConfig);

// Dev-only debug helpers (stripped from production builds by tree-shaking
// since import.meta.env.DEV is false and the whole block becomes dead code).
if (import.meta.env.DEV) {
    import('./game/utils/debug').then(({ installDebugHooks }) => installDebugHooks(game));
}

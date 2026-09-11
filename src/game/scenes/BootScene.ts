import Phaser from 'phaser';
import { SCENE_KEYS } from '../constants';
import { buildTextures } from '../art/TextureFactory';
import { createServices } from '../core/services';

export class BootScene extends Phaser.Scene {
    constructor() { super(SCENE_KEYS.BOOT); }

    create(): void {
        buildTextures(this);
        createServices(this.game);

        // Best-effort font warm-up: index.html already pre-warms Fredoka/Nunito via
        // hidden DOM elements, so by the time we get here the browser has usually
        // already started (or finished) loading them. We don't block the scene
        // transition on this -- worst case the very first frame of text uses the
        // fallback stack before swapping in, which reads fine either way.
        this.scene.start(SCENE_KEYS.MENU);
    }
}

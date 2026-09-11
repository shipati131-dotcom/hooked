import Phaser from 'phaser';

export type PropType = 'lilypad' | 'reeds' | 'pine' | 'dock' | 'rocks' | 'palm' | 'ice' | 'lava' | 'coral' | 'fireflies' | 'aurora' | 'stars';

/** Generates a small silhouette texture for a location prop, cached by key so it's only drawn once. */
export function generatePropTexture(scene: Phaser.Scene, type: PropType): string {
    const key = `prop-${type}`;
    if (scene.textures.exists(key)) return key;
    const g = scene.make.graphics({ x: 0, y: 0 });
    let w = 96, h = 96;

    switch (type) {
        case 'lilypad':
            w = 64; h = 40;
            g.fillStyle(0x3d7a3d, 1);
            g.slice(32, 20, 26, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(340), false);
            g.fillPath();
            g.fillStyle(0x2e5c2e, 1);
            g.fillEllipse(32, 20, 40, 22);
            break;
        case 'reeds':
            w = 40; h = 110;
            g.fillStyle(0x4a6a3a, 1);
            for (let i = 0; i < 4; i++) {
                const x = 6 + i * 9;
                const lean = (i - 1.5) * 4;
                g.fillTriangle(x, h, x + lean, 0, x + 4, h);
            }
            break;
        case 'pine':
            w = 70; h = 130;
            g.fillStyle(0x2a3a2a, 1);
            g.fillRect(31, 100, 8, 30);
            g.fillTriangle(35, 0, 5, 60, 65, 60);
            g.fillTriangle(35, 30, 8, 85, 62, 85);
            g.fillTriangle(35, 55, 10, 110, 60, 110);
            break;
        case 'dock':
            w = 220; h = 60;
            g.fillStyle(0x6a4a30, 1);
            g.fillRect(0, 10, 220, 16);
            g.fillStyle(0x4a3320, 1);
            for (let i = 0; i < 5; i++) g.fillRect(10 + i * 44, 20, 10, 40);
            break;
        case 'rocks':
            w = 90; h = 60;
            g.fillStyle(0x6a6a66, 1);
            g.fillEllipse(30, 40, 50, 30);
            g.fillEllipse(65, 45, 36, 24);
            g.fillStyle(0x545450, 1);
            g.fillEllipse(30, 45, 40, 16);
            break;
        case 'palm':
            w = 90; h = 150;
            g.fillStyle(0x8a6a3a, 1);
            g.beginPath();
            g.moveTo(45, 150);
            g.lineTo(58, 40);
            g.lineTo(50, 40);
            g.lineTo(40, 150);
            g.closePath();
            g.fillPath();
            g.fillStyle(0x3a7a3a, 1);
            for (let i = 0; i < 6; i++) {
                const ang = (i / 6) * Math.PI * 2;
                g.fillEllipse(58 + Math.cos(ang) * 26, 40 + Math.sin(ang) * 14, 46, 16);
            }
            break;
        case 'ice':
            w = 120; h = 90;
            g.fillStyle(0xdcf0f7, 1);
            g.fillTriangle(0, 90, 30, 10, 60, 90);
            g.fillTriangle(40, 90, 75, 30, 110, 90);
            g.fillStyle(0xb9e0ec, 0.7);
            g.fillTriangle(15, 90, 30, 30, 45, 90);
            break;
        case 'lava':
            w = 100; h = 70;
            g.fillStyle(0x2a1510, 1);
            g.fillEllipse(50, 45, 90, 40);
            g.fillStyle(0xff6a1a, 0.9);
            g.fillEllipse(35, 50, 14, 6);
            g.fillEllipse(60, 42, 10, 5);
            g.fillEllipse(48, 58, 8, 4);
            break;
        case 'coral':
            w = 80; h = 80;
            g.fillStyle(0xff7a7a, 1);
            g.fillTriangle(20, 80, 10, 20, 30, 30);
            g.fillStyle(0xffb85a, 1);
            g.fillTriangle(45, 80, 40, 10, 60, 35);
            g.fillStyle(0xff9ac9, 1);
            g.fillTriangle(65, 80, 62, 30, 78, 45);
            break;
        default:
            w = 8; h = 8; // fireflies/aurora/stars are handled as particles, not sprites
    }

    g.generateTexture(key, w, h);
    g.destroy();
    return key;
}

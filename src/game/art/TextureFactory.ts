import Phaser from 'phaser';

/**
 * Generates every placeholder texture the game needs at boot time using
 * Graphics -> generateTexture. Replace any key here with a loaded image later
 * and nothing else in the game needs to change.
 */
export function buildTextures(scene: Phaser.Scene): void {
    const g = scene.make.graphics({ x: 0, y: 0 });

    // Soft radial particle dot -- used for splashes, coin bursts, ambient motes.
    g.clear();
    for (let r = 16; r > 0; r--) {
        const a = (1 - r / 16) * 0.9;
        g.fillStyle(0xffffff, a * 0.18);
        g.fillCircle(16, 16, r);
    }
    g.generateTexture('particle-dot', 32, 32);

    // Tight bright core dot for sparkle/twinkle effects.
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 3);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(8, 8, 7);
    g.generateTexture('particle-spark', 16, 16);

    // Ripple ring (a soft stroked circle) for cast/splash water rings.
    g.clear();
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(32, 32, 28);
    g.generateTexture('ripple-ring', 64, 64);

    // Coin icon.
    g.clear();
    g.fillStyle(0xf7d585, 1);
    g.fillCircle(12, 12, 11);
    g.fillStyle(0xf0b93d, 1);
    g.fillCircle(12, 12, 8.5);
    g.fillStyle(0xfff0c9, 1);
    g.fillCircle(9, 9, 2.2);
    g.generateTexture('coin-icon', 24, 24);

    // Bobber body -- red top / white bottom, tintable for cosmetic skins.
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 20, 12);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(16, 8, 20, 16);
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(15, 0, 2, 6);
    g.generateTexture('bobber', 32, 32);
    g.clear();
    // A second texture is the tintable "top half" so we can color just the cap.
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(16, 8, 20, 16);
    g.generateTexture('bobber-cap', 32, 32);

    // Small star shape for achievement bursts / rarity accents.
    g.clear();
    drawStar(g, 12, 12, 5, 11, 5, 0xffffff);
    g.generateTexture('star-icon', 24, 24);

    // Simple lock icon for locked shop/location items.
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(4, 10, 16, 12, 3);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(12, 8, 6);
    g.generateTexture('lock-icon', 24, 24);

    // Tileable water shimmer strip -- a soft horizontal wave highlight, tinted per location.
    g.clear();
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, 128, 48);
    g.lineStyle(3, 0xffffff, 0.5);
    for (let i = 0; i < 3; i++) {
        const yOff = 10 + i * 14;
        g.beginPath();
        for (let x = 0; x <= 128; x += 8) {
            const y = yOff + Math.sin((x / 128) * Math.PI * 2 + i) * 4;
            if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokePath();
    }
    g.generateTexture('water-tile', 128, 48);

    g.destroy();
}

function drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, points: number, outerR: number, innerR: number, color: number): void {
    g.fillStyle(color, 1);
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();
}

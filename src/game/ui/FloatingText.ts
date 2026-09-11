import Phaser from 'phaser';

/** A quick "+12 XP" / "+34 coins" style popup that floats up and fades. */
export function floatingText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffffff', size = 28): void {
    const t = scene.add.text(x, y, text, {
        fontFamily: 'Fredoka, sans-serif', fontSize: `${size}px`, color,
        stroke: '#17252b', strokeThickness: 4
    }).setOrigin(0.5).setDepth(500).setScale(0.6);

    scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    scene.tweens.add({
        targets: t, y: y - 70, alpha: 0, duration: 900, delay: 250, ease: 'Cubic.easeOut',
        onComplete: () => t.destroy()
    });
}

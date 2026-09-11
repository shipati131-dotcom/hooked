import Phaser from 'phaser';

/** Animates a text object's displayed number counting up (or down) to a target value. */
export function countUpText(
    scene: Phaser.Scene,
    text: Phaser.GameObjects.Text,
    from: number,
    to: number,
    duration: number,
    format: (n: number) => string
): Phaser.Tweens.Tween {
    const holder = { v: from };
    text.setText(format(from));
    return scene.tweens.add({
        targets: holder,
        v: to,
        duration,
        ease: 'Cubic.easeOut',
        onUpdate: () => text.setText(format(holder.v))
    });
}

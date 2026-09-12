import type Phaser from 'phaser';

/** Fits an image inside a box without distortion and returns the applied scale. */
export function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): number {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    image.setScale(scale);
    return scale;
}

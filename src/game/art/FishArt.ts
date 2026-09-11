import Phaser from 'phaser';
import type { BodyShape, FishArtSpec } from '../data/types';

const W = 128;
const H = 72;
const CX = W * 0.42;
const CY = H * 0.5;

/**
 * Draws a stylized side-view fish silhouette for a texture key. A small set of
 * body-shape primitives (round/long/flat/eel/shark/sword/koi/angler/fantasy) is
 * reused across every species -- variety comes from color and pattern, not from
 * one-off unique art, which keeps quality consistent across ~48 species.
 */
export function generateFishTexture(scene: Phaser.Scene, key: string, art: FishArtSpec): void {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });

    drawBody(g, art.shape, art.primaryColor);
    drawFins(g, art.shape, art.finColor);
    drawPattern(g, art.shape, art.pattern, art.secondaryColor);
    drawFace(g);

    g.generateTexture(key, W, H);
    g.destroy();
}

function drawBody(g: Phaser.GameObjects.Graphics, shape: BodyShape, color: number): void {
    g.fillStyle(color, 1);
    switch (shape) {
        case 'round':
            g.fillEllipse(CX, CY, W * 0.62, H * 0.72);
            break;
        case 'long':
            g.fillEllipse(CX, CY, W * 0.78, H * 0.48);
            break;
        case 'flat':
            g.fillEllipse(CX, CY, W * 0.7, H * 0.9);
            break;
        case 'eel':
            g.beginPath();
            g.moveTo(W * 0.05, CY);
            g.lineTo(W * 0.25, CY - H * 0.16);
            g.lineTo(W * 0.7, CY - H * 0.1);
            g.lineTo(W * 0.95, CY);
            g.lineTo(W * 0.7, CY + H * 0.1);
            g.lineTo(W * 0.25, CY + H * 0.16);
            g.closePath();
            g.fillPath();
            break;
        case 'shark':
            g.fillTriangle(W * 0.08, CY + H * 0.22, W * 0.55, CY - H * 0.36, W * 0.62, CY + H * 0.3);
            g.fillEllipse(CX, CY + H * 0.02, W * 0.66, H * 0.5);
            break;
        case 'sword':
            g.fillRect(0, CY - H * 0.05, W * 0.3, H * 0.1);
            g.fillEllipse(CX + W * 0.12, CY, W * 0.55, H * 0.5);
            break;
        case 'koi':
            g.fillEllipse(CX, CY, W * 0.7, H * 0.5);
            break;
        case 'angler':
            g.fillEllipse(CX, CY, W * 0.6, H * 0.62);
            g.lineStyle(2, color, 1);
            g.beginPath();
            g.moveTo(CX - W * 0.05, CY - H * 0.34);
            g.lineTo(CX - W * 0.1, CY - H * 0.55);
            g.strokePath();
            g.fillStyle(0xfff2b0, 1);
            g.fillCircle(CX - W * 0.1, CY - H * 0.57, 3.5);
            g.fillStyle(color, 1);
            break;
        case 'fantasy':
            g.fillEllipse(CX, CY, W * 0.66, H * 0.56);
            break;
    }
}

function drawFins(g: Phaser.GameObjects.Graphics, shape: BodyShape, color: number): void {
    g.fillStyle(color, 1);
    // tail fin
    const tailX = shape === 'eel' ? W * 0.03 : shape === 'shark' ? W * 0.06 : W * 0.02;
    g.fillTriangle(tailX, CY, tailX + W * 0.14, CY - H * 0.28, tailX + W * 0.14, CY + H * 0.28);
    // dorsal fin
    if (shape === 'sword' || shape === 'shark') {
        g.fillTriangle(CX - W * 0.02, CY - H * 0.28, CX + W * 0.12, CY - H * 0.62, CX + W * 0.2, CY - H * 0.24);
    } else if (shape === 'fantasy') {
        g.fillTriangle(CX - W * 0.06, CY - H * 0.24, CX + W * 0.06, CY - H * 0.7, CX + W * 0.22, CY - H * 0.2);
    } else if (shape !== 'eel' && shape !== 'angler') {
        g.fillTriangle(CX - W * 0.02, CY - H * 0.22, CX + W * 0.1, CY - H * 0.42, CX + W * 0.2, CY - H * 0.16);
    }
    // pectoral fin
    g.fillTriangle(CX + W * 0.02, CY + H * 0.12, CX + W * 0.16, CY + H * 0.4, CX - W * 0.06, CY + H * 0.32);
}

function drawPattern(g: Phaser.GameObjects.Graphics, shape: BodyShape, pattern: FishArtSpec['pattern'], color: number): void {
    if (!pattern || pattern === 'none') return;
    if (pattern === 'stripes') {
        g.fillStyle(color, 0.85);
        for (let i = 0; i < 4; i++) {
            const x = W * (0.32 + i * 0.09);
            g.fillRect(x, CY - H * 0.3, W * 0.03, H * 0.6);
        }
    } else if (pattern === 'spots') {
        g.fillStyle(color, 0.9);
        const spots = [[0.4, -0.14], [0.52, 0.1], [0.62, -0.06], [0.46, 0.2], [0.58, 0.24]];
        for (const [dx, dy] of spots) g.fillCircle(W * dx, CY + H * dy, 3.2);
    } else if (pattern === 'scales') {
        g.lineStyle(1.2, color, 0.5);
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 5; col++) {
                const x = W * (0.32 + col * 0.075);
                const y = CY - H * 0.15 + row * H * 0.15;
                g.strokeCircle(x, y, 5);
            }
        }
    } else if (pattern === 'gradient') {
        g.fillStyle(color, 0.35);
        if (shape === 'flat') g.fillEllipse(CX, CY - H * 0.15, W * 0.55, H * 0.35);
        else g.fillEllipse(CX + W * 0.05, CY - H * 0.12, W * 0.5, H * 0.28);
    }
}

function drawFace(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x14181c, 1);
    g.fillCircle(W * 0.68, CY - H * 0.06, 3.4);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(W * 0.685, CY - H * 0.08, 1.1);
}

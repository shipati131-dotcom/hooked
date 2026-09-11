import Phaser from 'phaser';

/**
 * A simple vertical scroll viewport: a container clipped by a rectangle mask,
 * scrollable via mouse wheel or drag. Enough for shop/collection/achievement
 * lists without pulling in a dedicated UI plugin.
 */
export class ScrollList extends Phaser.GameObjects.Container {
    private inner: Phaser.GameObjects.Container;
    private maskShape: Phaser.GameObjects.Graphics;
    private viewW: number;
    private viewH: number;
    private contentHeight = 0;
    private scrollY = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, viewW: number, viewH: number) {
        super(scene, x, y);
        this.viewW = viewW;
        this.viewH = viewH;
        this.inner = scene.add.container(0, 0);
        this.add(this.inner);

        this.maskShape = scene.make.graphics({ x: 0, y: 0 });
        this.redrawMask();
        this.inner.setMask(this.maskShape.createGeometryMask());

        const hit = scene.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x000000, 0.001).setInteractive();
        this.add(hit);
        this.sendToBack(hit);

        hit.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.scrollBy(dy * 0.5));

        let dragStartY = 0, scrollStart = 0, dragging = false;
        hit.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; dragStartY = p.y; scrollStart = this.scrollY; });
        scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!dragging) return;
            this.scrollTo(scrollStart - (p.y - dragStartY));
        });
        scene.input.on('pointerup', () => { dragging = false; });

        scene.add.existing(this);
    }

    private redrawMask(): void {
        this.maskShape.clear();
        this.maskShape.fillStyle(0xffffff, 1);
        this.maskShape.fillRect(this.x, this.y, this.viewW, this.viewH);
    }

    setContent(items: Phaser.GameObjects.GameObject[], totalHeight: number): void {
        this.inner.removeAll(true);
        this.inner.add(items);
        this.contentHeight = totalHeight;
        this.scrollTo(0);
    }

    private scrollBy(dy: number): void { this.scrollTo(this.scrollY + dy); }

    private scrollTo(y: number): void {
        const maxScroll = Math.max(0, this.contentHeight - this.viewH);
        this.scrollY = Phaser.Math.Clamp(y, 0, maxScroll);
        this.inner.setY(-this.scrollY);
    }
}

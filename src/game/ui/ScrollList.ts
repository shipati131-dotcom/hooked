import Phaser from 'phaser';

/**
 * A simple vertical scroll viewport: a container clipped by a rectangle mask,
 * scrollable via mouse wheel or drag. Enough for shop/collection/achievement
 * lists without pulling in a dedicated UI plugin.
 */
export class ScrollList extends Phaser.GameObjects.Container {
    private inner: Phaser.GameObjects.Container;
    private items: Phaser.GameObjects.GameObject[] = [];
    private viewH: number;
    private contentHeight = 0;
    private scrollY = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, viewW: number, viewH: number) {
        super(scene, x, y);
        this.viewH = viewH;
        this.inner = scene.add.container(0, 0);
        this.add(this.inner);

        const hit = scene.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x000000, 0.001).setInteractive();
        this.add(hit);
        this.sendToBack(hit);
        scene.add.existing(this);

        // Rows added via setContent() are individually interactive (for
        // click-to-select) and render on top of `hit`, which under Phaser's
        // default "topOnly" input picking means THEY -- not this list's own
        // background rect -- receive wheel/pointer events whenever the
        // cursor is over a row. Listening at the scene/input-plugin level
        // instead (bounds-checked against this list's own screen rect) makes
        // scrolling work no matter what's rendered on top.
        const withinBounds = (p: Phaser.Input.Pointer): boolean => this.getBounds().contains(p.x, p.y);

        const onWheel = (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
            if (!withinBounds(p)) return;
            this.scrollBy(dy * 0.5);
        };

        let dragStartY = 0, scrollStart = 0, dragging = false;
        const onDown = (p: Phaser.Input.Pointer) => {
            if (!withinBounds(p)) return;
            dragging = true; dragStartY = p.y; scrollStart = this.scrollY;
        };
        const onMove = (p: Phaser.Input.Pointer) => {
            if (!dragging) return;
            this.scrollTo(scrollStart - (p.y - dragStartY));
        };
        const onUp = () => { dragging = false; };

        scene.input.on('wheel', onWheel);
        scene.input.on('pointerdown', onDown);
        scene.input.on('pointermove', onMove);
        scene.input.on('pointerup', onUp);
        scene.input.on('pointerupoutside', onUp);

        // These are bound on the scene's input plugin (not this game object),
        // so they must be explicitly unhooked when the scene shuts down --
        // otherwise every relaunch of this scene stacks another copy on top
        // (the same class of bug that used to freeze Achievements/Shop).
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            scene.input.off('wheel', onWheel);
            scene.input.off('pointerdown', onDown);
            scene.input.off('pointermove', onMove);
            scene.input.off('pointerup', onUp);
            scene.input.off('pointerupoutside', onUp);
        });
    }

    setContent(items: Phaser.GameObjects.GameObject[], totalHeight: number): void {
        this.inner.removeAll(true);
        this.items = items;
        this.inner.add(items);
        this.contentHeight = totalHeight;
        this.scrollTo(0);
    }

    private scrollBy(dy: number): void { this.scrollTo(this.scrollY + dy); }

    private scrollTo(y: number): void {
        const maxScroll = Math.max(0, this.contentHeight - this.viewH);
        this.scrollY = Phaser.Math.Clamp(y, 0, maxScroll);
        this.inner.setY(-this.scrollY);
        // Phaser 4 WebGL no longer supports the legacy geometry-mask path used
        // by the original list. Cull whole rows and let Sheet's header/footer
        // guards cover the small partial-row edges.
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const display = item as Phaser.GameObjects.GameObject & { y?: number; visible?: boolean; setVisible?: (value: boolean) => unknown };
            const itemY = display.y ?? 0;
            const next = this.items[i + 1] as (Phaser.GameObjects.GameObject & { y?: number }) | undefined;
            const itemBottom = next?.y ?? this.contentHeight;
            const viewportTop = itemY - this.scrollY;
            const viewportBottom = itemBottom - this.scrollY;
            display.setVisible?.(viewportTop >= 0 && viewportBottom <= this.viewH + 0.5);
        }
    }
}

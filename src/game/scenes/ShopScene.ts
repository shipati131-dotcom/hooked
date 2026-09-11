import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { getServices } from '../core/services';
import { listen } from '../core/listen';
import { EVENTS } from '../core/events';
import { buildSheet } from '../ui/Sheet';
import { ScrollList } from '../ui/ScrollList';
import { Button } from '../ui/Button';
import { COLORS } from '../ui/theme';
import { RODS, REELS, LINES, BAITS, BOBBERS } from '../data/equipment';
import type { EquipmentDef, EquipmentCategory } from '../data/types';
import { formatCoins } from '../utils/format';

const TABS: { key: EquipmentCategory; label: string; items: EquipmentDef[] }[] = [
    { key: 'rod', label: 'Rods', items: RODS },
    { key: 'reel', label: 'Reels', items: REELS },
    { key: 'line', label: 'Lines', items: LINES },
    { key: 'bait', label: 'Bait', items: BAITS },
    { key: 'bobber', label: 'Bobbers', items: BOBBERS }
];

export class ShopScene extends Phaser.Scene {
    private list!: ScrollList;
    private tabButtons: Phaser.GameObjects.Container[] = [];
    private activeTab: EquipmentCategory = 'rod';

    constructor() { super(SCENE_KEYS.SHOP); }

    create(): void {
        const services = getServices(this);
        const sheet = buildSheet(this, 'Tackle Shop', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        TABS.forEach((tab, i) => {
            const btn = this.add.container(left + 130 + i * 200, top + 130);
            const bg = this.add.graphics();
            const label = this.add.text(0, 0, tab.label, { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#f4e8cf' }).setOrigin(0.5);
            btn.add([bg, label]);
            btn.setSize(180, 44).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => { this.activeTab = tab.key; this.rebuild(services); });
            sheet.content.add(btn);
            this.tabButtons.push(btn);
        });

        this.list = new ScrollList(this, left + 40, top + 170, sheet.width - 80, sheet.height - 210);
        sheet.content.add(this.list);

        this.rebuild(services);

        listen(this, services.bus, EVENTS.ITEM_PURCHASED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.EQUIP_CHANGED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.COINS_CHANGED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.LEVEL_UP, () => this.rebuild(services));
    }

    private rebuild(services: ReturnType<typeof getServices>): void {
        this.tabButtons.forEach((btn, i) => {
            const active = TABS[i].key === this.activeTab;
            const bg = btn.list[0] as Phaser.GameObjects.Graphics;
            bg.clear();
            bg.fillStyle(active ? COLORS.gold : 0x16333f, active ? 1 : 0.6);
            bg.fillRoundedRect(-90, -22, 180, 44, 12);
            const label = btn.list[1] as Phaser.GameObjects.Text;
            label.setColor(active ? '#17252b' : '#f4e8cf');
        });

        const tab = TABS.find(t => t.key === this.activeTab)!;
        const rowH = 108;
        const items: Phaser.GameObjects.GameObject[] = [];
        tab.items.forEach((def, i) => {
            items.push(this.buildRow(services, def, i * rowH, tab.items.length > 1 && def.price === 0));
        });
        this.list.setContent(items, tab.items.length * rowH);
    }

    private buildRow(services: ReturnType<typeof getServices>, def: EquipmentDef, y: number, isStarter: boolean): Phaser.GameObjects.Container {
        const w = GAME_WIDTH - 200 - 80;
        const c = this.add.container(0, y);
        const bg = this.add.graphics();
        bg.fillStyle(0x0d232c, 0.5);
        bg.fillRoundedRect(0, 6, w, 92, 14);
        c.add(bg);

        const owned = services.equipment.isOwned(def.id);
        const equipped = services.equipment.isEquipped(def.id);
        const levelOk = services.equipment.isUnlockedByLevel(def.id);

        const rarityBar = this.add.rectangle(0, 52, 8, 80, levelOk ? 0x3ab7a7 : 0x5a6a70).setOrigin(0, 0.5);
        c.add(rarityBar);

        const name = this.add.text(28, 22, def.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', color: '#f4e8cf' });
        const desc = this.add.text(28, 54, def.description, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#b3a488' });
        const statLine = this.add.text(28, 78, statSummary(def), { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#5ecdbd', fontStyle: '700' });
        c.add([name, desc, statLine]);

        if (!levelOk) {
            c.add(this.add.text(w - 260, 46, `Unlocks at Lv ${def.unlockLevel}`, { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#e08a7a', fontStyle: '700' }).setOrigin(0, 0.5));
        } else if (equipped) {
            const btn = new Button(this, w - 110, 52, 'EQUIPPED', undefined, { width: 170, height: 48, color: 0x4a5a5e, fontSize: 16, disabled: true });
            c.add(btn);
        } else if (owned || isStarter) {
            const btn = new Button(this, w - 110, 52, 'EQUIP', () => {
                services.equipment.equip(def.id);
                services.requestSave();
            }, { width: 170, height: 48, color: COLORS.accent, fontSize: 16 });
            c.add(btn);
        } else {
            const affordable = services.economy.canAfford(def.price);
            const btn = new Button(this, w - 110, 52, `BUY  ${formatCoins(def.price)}`, () => {
                if (services.equipment.buy(def.id, p => services.economy.spend(p))) {
                    services.audio.play('purchase');
                    services.achievements.checkAll();
                    services.requestSave();
                }
            }, { width: 190, height: 48, color: affordable ? COLORS.gold : COLORS.muted, fontSize: 15, disabled: !affordable });
            c.add(btn);
        }

        return c;
    }

    private close(): void {
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.FISHING);
    }
}

function statSummary(def: EquipmentDef): string {
    const s = def.stats as unknown as Record<string, number>;
    switch (def.category) {
        case 'rod': return `Control ${s.control}  •  Power ${s.power.toFixed(1)}x  •  Rare luck +${(s.rareLuck * 100).toFixed(0)}%`;
        case 'reel': return `Capture speed ${s.captureSpeed.toFixed(2)}x  •  Tension resist ${s.tensionResist.toFixed(2)}x`;
        case 'line': return `Max tension ${s.maxTension}  •  Snap resist ${s.snapResist.toFixed(2)}x`;
        case 'bait': return `Bite speed ${s.biteSpeed.toFixed(2)}x  •  Rarity luck +${(s.rarityLuck * 100).toFixed(0)}%`;
        case 'bobber': return 'Cosmetic';
        default: return '';
    }
}

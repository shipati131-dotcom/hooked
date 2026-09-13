import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { getServices } from '../core/services';
import { listen } from '../core/listen';
import { EVENTS } from '../core/events';
import { buildSheet } from '../ui/Sheet';
import { ScrollList } from '../ui/ScrollList';
import { Button } from '../ui/Button';
import { COLORS } from '../ui/theme';
import { RODS, REELS, LINES, BAITS, BOBBERS, HOOKS } from '../data/equipment';
import type { EquipmentDef, EquipmentCategory } from '../data/types';
import { formatCoins } from '../utils/format';
import { fitImage } from '../ui/fitImage';

const TABS: { key: EquipmentCategory; label: string; items: EquipmentDef[] }[] = [
    { key: 'rod', label: 'Rods', items: RODS },
    { key: 'reel', label: 'Reels', items: REELS },
    { key: 'line', label: 'Lines', items: LINES },
    { key: 'bait', label: 'Bait', items: BAITS },
    { key: 'hook', label: 'Hooks', items: HOOKS },
    { key: 'bobber', label: 'Bobbers', items: BOBBERS }
];

export class ShopScene extends Phaser.Scene {
    private list!: ScrollList;
    private tabButtons: Phaser.GameObjects.Container[] = [];
    private activeTab: EquipmentCategory = 'rod';
    private reducedMotion = false;

    constructor() { super(SCENE_KEYS.SHOP); }

    create(): void {
        // Phaser reuses this same Scene instance on every relaunch, so without
        // resetting this array each reopen would push 5 more button references
        // onto stale, already-destroyed ones from the previous open -- rebuild()
        // would then crash iterating a dead container (see AchievementScene's
        // identical fix for the full explanation of the freeze this caused).
        this.tabButtons = [];
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        const services = getServices(this);
        const sheet = buildSheet(this, 'Tackle Shop', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        TABS.forEach((tab, i) => {
            const btn = this.add.container(left + 130 + i * 200, top + 130);
            const bg = this.add.graphics();
            const label = this.add.text(0, 0, tab.label, { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#f4e8cf', fontStyle: '700' }).setOrigin(0.5);
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
        const rowH = 124;
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
        bg.fillRoundedRect(0, 6, w, 108, 14);
        c.add(bg);

        const owned = services.equipment.isOwned(def.id);
        const equipped = services.equipment.isEquipped(def.id);
        const levelOk = services.equipment.isUnlockedByLevel(def.id);

        const artPlate = this.add.graphics();
        artPlate.fillStyle(levelOk ? 0x163d47 : 0x24343a, 0.95);
        artPlate.fillRoundedRect(14, 15, 108, 90, 12);
        artPlate.lineStyle(2, levelOk ? COLORS.accent : COLORS.muted, 0.5);
        artPlate.strokeRoundedRect(14, 15, 108, 90, 12);
        // Hooks have no shared atlas (unlike rods/reels/etc) -- each tier is its
        // own individually-loaded SVG icon keyed 'equipment-hook-<id>' directly,
        // rather than a frame within one 'equipment-hook' texture.
        const art = def.category === 'hook'
            ? this.add.image(68, 60, `equipment-hook-${def.id}`)
            : this.add.image(68, 60, `equipment-${def.category}`, def.id);
        fitImage(art, 96, 76);
        c.add([artPlate, art]);

        if (!this.reducedMotion && levelOk) {
            this.tweens.add({ targets: art, y: 57, duration: 1000 + def.tier * 70, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
        }

        const name = this.add.text(140, 20, def.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', color: '#f4e8cf', fontStyle: '700' });
        const desc = this.add.text(140, 53, def.description, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#d3c2a6', fontStyle: '700' });
        const statLine = this.add.text(140, 80, statSummary(def), { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#5ecdbd', fontStyle: '700' });
        c.add([name, desc, statLine]);

        if (!levelOk) {
            c.add(this.add.text(w - 260, 58, `Unlocks at Lv ${def.unlockLevel}`, { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#e08a7a', fontStyle: '700' }).setOrigin(0, 0.5));
        } else if (equipped) {
            const btn = new Button(this, w - 110, 60, 'EQUIPPED', undefined, { width: 170, height: 48, color: 0x4a5a5e, fontSize: 16, disabled: true });
            c.add(btn);
        } else if (owned || isStarter) {
            const btn = new Button(this, w - 110, 60, 'EQUIP', () => {
                services.equipment.equip(def.id);
                services.requestSave();
            }, { width: 170, height: 48, color: COLORS.accent, fontSize: 16 });
            c.add(btn);
        } else {
            const affordable = services.economy.canAfford(def.price);
            const btn = new Button(this, w - 110, 60, formatCoins(def.price), () => {
                if (services.equipment.buy(def.id, p => services.economy.spend(p))) {
                    services.audio.play('purchase');
                    services.achievements.checkAll();
                    services.requestSave();
                }
            }, { width: 190, height: 48, color: affordable ? COLORS.gold : COLORS.muted, fontSize: 17, disabled: !affordable, iconKey: 'coin-icon', iconSize: 20, iconGap: 8 });
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
        case 'rod': return `Control ${s.control}  •  Power ${s.power.toFixed(1)}x  •  Flex ${(s.flex * 100).toFixed(0)}%  •  Rare luck +${(s.rareLuck * 100).toFixed(0)}%`;
        case 'reel': return `Reel speed ${s.captureSpeed.toFixed(2)}x  •  Drag assist +${((s.tensionResist - 1) * 100).toFixed(0)}%`;
        case 'line': return `Max tension ${s.maxTension}  •  Snap resist ${s.snapResist.toFixed(2)}x`;
        case 'bait': return `Bite speed ${s.biteSpeed.toFixed(2)}x  •  Rarity luck +${(s.rarityLuck * 100).toFixed(0)}%`;
        case 'hook': return `Strike window +${((s.windowMult - 1) * 100).toFixed(0)}%  •  Wrong-swipe forgiveness ${(s.directionForgiveness * 100).toFixed(0)}%  •  Hold ${(s.holdStrength * 100).toFixed(0)}%`;
        case 'bobber': return 'Cosmetic';
        default: return '';
    }
}

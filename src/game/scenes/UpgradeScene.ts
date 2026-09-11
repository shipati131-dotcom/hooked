import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { getServices } from '../core/services';
import { listen } from '../core/listen';
import { EVENTS } from '../core/events';
import { buildSheet } from '../ui/Sheet';
import { ScrollList } from '../ui/ScrollList';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { COLORS } from '../ui/theme';
import { PERKS } from '../data/upgrades';
import { formatCoins } from '../utils/format';

export class UpgradeScene extends Phaser.Scene {
    private list!: ScrollList;

    constructor() { super(SCENE_KEYS.UPGRADE); }

    create(): void {
        const services = getServices(this);
        const sheet = buildSheet(this, 'Permanent Upgrades', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        this.list = new ScrollList(this, left + 40, top + 110, sheet.width - 80, sheet.height - 150);
        sheet.content.add(this.list);

        this.rebuild(services);

        listen(this, services.bus, EVENTS.PERK_UPGRADED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.COINS_CHANGED, () => this.rebuild(services));
    }

    private rebuild(services: ReturnType<typeof getServices>): void {
        const rowH = 130;
        const items = PERKS.map((perk, i) => this.buildRow(services, perk, i * rowH));
        this.list.setContent(items, PERKS.length * rowH);
    }

    private buildRow(services: ReturnType<typeof getServices>, perk: (typeof PERKS)[number], y: number): Phaser.GameObjects.Container {
        const w = GAME_WIDTH - 200 - 80;
        const c = this.add.container(0, y);
        const bg = this.add.graphics();
        bg.fillStyle(0x0d232c, 0.5);
        bg.fillRoundedRect(0, 6, w, 112, 14);
        c.add(bg);

        const level = services.upgrades.level(perk.id);
        const maxed = services.upgrades.isMaxed(perk.id);
        const cost = services.upgrades.nextCost(perk.id);

        const name = this.add.text(28, 20, perk.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', color: '#f4e8cf' });
        const desc = this.add.text(28, 50, perk.description, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#b3a488' });
        const effect = this.add.text(28, 76, perk.format(level, Math.min(perk.maxLevel, level + 1)), { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#5ecdbd', fontStyle: '700' });
        c.add([name, desc, effect]);

        const bar = new ProgressBar(this, 28, 100, { width: 300, height: 10, fillColor: COLORS.gold });
        bar.setValueImmediate(level / perk.maxLevel);
        c.add(bar);
        c.add(this.add.text(28 + 300 + 12, 95, `${level}/${perk.maxLevel}`, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#d8c9a3' }));

        if (maxed) {
            c.add(new Button(this, w - 110, 56, 'MAXED', undefined, { width: 170, height: 48, color: 0x4a5a5e, fontSize: 16, disabled: true }));
        } else {
            const affordable = services.economy.canAfford(cost);
            const btn = new Button(this, w - 110, 56, `+1  ${formatCoins(cost)}`, () => {
                if (services.upgrades.buyLevel(perk.id, p => services.economy.spend(p))) {
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

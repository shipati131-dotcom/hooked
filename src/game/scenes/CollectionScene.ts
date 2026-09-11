import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, RARITY_COLOR, RARITY_LABEL } from '../constants';
import { getServices } from '../core/services';
import { listen } from '../core/listen';
import { EVENTS } from '../core/events';
import { buildSheet } from '../ui/Sheet';
import { ScrollList } from '../ui/ScrollList';
import { FISH } from '../data/fish';
import { getLocation } from '../data/locations';
import { generateFishTexture } from '../art/FishArt';
import { applyRarityGlow } from '../ui/glow';
import { formatWeight, formatCoins } from '../utils/format';

export class CollectionScene extends Phaser.Scene {
    private list!: ScrollList;
    private detailContainer!: Phaser.GameObjects.Container;
    private countText!: Phaser.GameObjects.Text;

    constructor() { super(SCENE_KEYS.COLLECTION); }

    create(): void {
        const services = getServices(this);
        const sheet = buildSheet(this, 'Fishdex', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        this.countText = this.add.text(left + sheet.width - 220, top + 44, '', {
            fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#e7b94f'
        }).setOrigin(0, 0.5);
        sheet.content.add(this.countText);

        const listW = 640;
        this.list = new ScrollList(this, left + 40, top + 110, listW, sheet.height - 150);
        sheet.content.add(this.list);

        this.detailContainer = this.add.container(left + 40 + listW + 40, top + 110);
        sheet.content.add(this.detailContainer);

        for (const f of FISH) generateFishTexture(this, `fish-${f.id}`, f.art);

        this.rebuild(services);
        this.showDetail(services, FISH[0]);

        listen(this, services.bus, EVENTS.CATCH, () => this.rebuild(services));
    }

    private rebuild(services: ReturnType<typeof getServices>): void {
        const rowH = 76;
        const sorted = [...FISH].sort((a, b) => a.locations[0].localeCompare(b.locations[0]) || a.rarity.localeCompare(b.rarity));
        const items = sorted.map((f, i) => this.buildRow(services, f, i * rowH));
        this.list.setContent(items, sorted.length * rowH);
        this.countText.setText(`${Object.keys(services.save.fishRecords).length} / ${FISH.length} Fish Discovered`);
    }

    private buildRow(services: ReturnType<typeof getServices>, fish: (typeof FISH)[number], y: number): Phaser.GameObjects.Container {
        const discovered = !!services.save.fishRecords[fish.id];
        const c = this.add.container(0, y);
        const bg = this.add.graphics();
        bg.fillStyle(0x0d232c, 0.4);
        bg.fillRoundedRect(0, 4, 620, 66, 12);
        c.add(bg);

        const icon = this.add.image(46, 37, `fish-${fish.id}`).setScale(0.55);
        if (discovered) applyRarityGlow(icon, fish.rarity); else icon.setTint(0x1a1a1a).setAlpha(0.55);
        c.add(icon);

        const name = this.add.text(92, 18, discovered ? fish.name : '???', {
            fontFamily: 'Fredoka, sans-serif', fontSize: '19px', color: discovered ? '#f4e8cf' : '#5a6a70'
        });
        const rarityColor = RARITY_COLOR[fish.rarity];
        const sub = this.add.text(92, 44, discovered ? `${RARITY_LABEL[fish.rarity]} • ${getLocation(fish.locations[0]).name}` : 'Undiscovered', {
            fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#' + rarityColor.toString(16).padStart(6, '0')
        });
        c.add([name, sub]);

        const hit = this.add.rectangle(310, 37, 620, 66, 0x000000, 0.001).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.showDetail(services, fish));
        c.add(hit);

        return c;
    }

    private showDetail(services: ReturnType<typeof getServices>, fish: (typeof FISH)[number]): void {
        this.detailContainer.removeAll(true);
        const discovered = !!services.save.fishRecords[fish.id];
        const record = services.save.fishRecords[fish.id];

        const panel = this.add.graphics();
        panel.fillStyle(0x0d232c, 0.55);
        panel.fillRoundedRect(0, 0, 500, 480, 16);
        this.detailContainer.add(panel);

        const icon = this.add.image(250, 130, `fish-${fish.id}`).setScale(1.6);
        if (discovered) applyRarityGlow(icon, fish.rarity); else icon.setTint(0x1a1a1a).setAlpha(0.5);
        this.detailContainer.add(icon);

        const name = this.add.text(30, 230, discovered ? fish.name : '???', { fontFamily: 'Fredoka, sans-serif', fontSize: '30px', color: '#f4e8cf' });
        const rarity = this.add.text(30, 270, RARITY_LABEL[fish.rarity], { fontFamily: 'Nunito, sans-serif', fontSize: '16px', color: '#' + RARITY_COLOR[fish.rarity].toString(16).padStart(6, '0'), fontStyle: '800' });
        this.detailContainer.add([name, rarity]);

        if (discovered) {
            const desc = this.add.text(30, 300, fish.description, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#d8c9a3', wordWrap: { width: 440 } });
            const best = this.add.text(30, 350, `Best catch: ${formatWeight(record.bestWeight)}`, { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#5ecdbd', fontStyle: '700' });
            const count = this.add.text(30, 375, `Total caught: ${record.caughtCount}`, { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#5ecdbd', fontStyle: '700' });
            const locs = this.add.text(30, 400, `Found at: ${fish.locations.map(l => getLocation(l).name).join(', ')}`, { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#b3a488', wordWrap: { width: 440 } });
            const value = this.add.text(30, 430, `Value range: ${formatCoins(fish.baseValue * 0.5)} - ${formatCoins(fish.baseValue * 4)} coins`, { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#b3a488' });
            this.detailContainer.add([desc, best, count, locs, value]);
        } else {
            const hint = this.add.text(30, 300, `Found at: ${fish.locations.map(l => getLocation(l).name).join(', ')}`, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#b3a488' });
            const rarity2 = this.add.text(30, 330, 'Catch one to reveal its details.', { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#8fa8b0' });
            this.detailContainer.add([hint, rarity2]);
        }
    }

    private close(): void {
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.FISHING);
    }
}

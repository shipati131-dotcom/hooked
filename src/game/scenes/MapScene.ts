import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { getServices } from '../core/services';
import { listen } from '../core/listen';
import { EVENTS } from '../core/events';
import { buildSheet } from '../ui/Sheet';
import { ScrollList } from '../ui/ScrollList';
import { Button } from '../ui/Button';
import { COLORS } from '../ui/theme';
import { LOCATIONS } from '../data/locations';
import { formatCoins } from '../utils/format';

export class MapScene extends Phaser.Scene {
    private list!: ScrollList;

    constructor() { super(SCENE_KEYS.MAP); }

    create(): void {
        const services = getServices(this);
        const sheet = buildSheet(this, 'Fishing Locations', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        this.list = new ScrollList(this, left + 40, top + 110, sheet.width - 80, sheet.height - 150);
        sheet.content.add(this.list);

        this.rebuild(services);

        listen(this, services.bus, EVENTS.LOCATION_UNLOCKED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.LOCATION_CHANGED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.LEVEL_UP, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.COINS_CHANGED, () => this.rebuild(services));
    }

    private rebuild(services: ReturnType<typeof getServices>): void {
        const rowH = 130;
        const items = LOCATIONS.map((loc, i) => {
            const cont = this.add.container(0, i * rowH);
            const w = GAME_WIDTH - 200 - 80;
            const unlocked = services.location.isUnlocked(loc.id);
            const current = services.save.currentLocation === loc.id;
            const canUnlock = services.location.canUnlock(loc.id);

            const bg = this.add.graphics();
            bg.fillStyle(current ? 0x155066 : 0x0d232c, 0.6);
            bg.fillRoundedRect(0, 6, w, 112, 14);
            const accentBar = this.add.rectangle(0, 62, 8, 100, unlocked ? loc.palette.accent : 0x3a4a4e).setOrigin(0, 0.5);

            const name = this.add.text(28, 20, loc.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '24px', color: unlocked ? '#f4e8cf' : '#7a8a90' });
            const desc = this.add.text(28, 52, unlocked ? loc.description : `Requires level ${loc.unlockLevel}`, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#b3a488', wordWrap: { width: 560 } });
            const meta = this.add.text(28, 84, unlocked ? `Difficulty ${loc.difficultyMod.toFixed(1)}x  •  Value ${loc.valueMult.toFixed(1)}x` : '', { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#5ecdbd', fontStyle: '700' });

            cont.add([bg, accentBar, name, desc, meta]);

            if (current) {
                cont.add(this.add.text(w - 130, 62, 'YOU ARE HERE', { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#e7b94f', fontStyle: '800' }).setOrigin(0.5));
            } else if (unlocked) {
                const btn = new Button(this, w - 110, 62, 'TRAVEL', () => {
                    services.location.travel(loc.id);
                    services.audio.play('click');
                    services.requestSave();
                }, { width: 170, height: 48, color: COLORS.accent, fontSize: 16 });
                cont.add(btn);
            } else if (canUnlock) {
                const affordable = services.economy.canAfford(loc.travelCost);
                const btn = new Button(this, w - 130, 62, loc.travelCost > 0 ? `UNLOCK  ${formatCoins(loc.travelCost)}` : 'UNLOCK', () => {
                    if (services.location.unlock(loc.id, p => services.economy.spend(p))) {
                        services.audio.play('purchase');
                        services.achievements.checkAll();
                        services.requestSave();
                        this.rebuild(services);
                    }
                }, { width: 220, height: 48, color: affordable ? COLORS.gold : COLORS.muted, fontSize: 14, disabled: !affordable });
                cont.add(btn);
            } else {
                cont.add(this.add.image(w - 40, 62, 'lock-icon').setScale(1.4));
            }

            return cont;
        });
        this.list.setContent(items, LOCATIONS.length * rowH);
    }

    private close(): void {
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.FISHING);
    }
}

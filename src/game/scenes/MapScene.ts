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
        const rowH = 154;
        const items = LOCATIONS.map((loc, i) => {
            const cont = this.add.container(0, i * rowH);
            const w = GAME_WIDTH - 200 - 80;
            const unlocked = services.location.isUnlocked(loc.id);
            const current = services.save.currentLocation === loc.id;
            const canUnlock = services.location.canUnlock(loc.id);

            const bg = this.add.graphics();
            bg.fillStyle(current ? 0x155066 : 0x0d232c, 0.6);
            bg.fillRoundedRect(0, 6, w, 136, 14);
            const accentBar = this.add.rectangle(0, 74, 8, 124, unlocked ? loc.palette.accent : 0x3a4a4e).setOrigin(0, 0.5);

            const thumb = this.add.image(22, 18, `location-${loc.id}`)
                .setOrigin(0, 0)
                .setDisplaySize(196, 112);
            if (!unlocked) thumb.setTint(0x40505a).setAlpha(0.55);

            const thumbFrame = this.add.graphics();
            thumbFrame.lineStyle(3, unlocked ? loc.palette.accent : 0x3a4a4e, 0.9);
            thumbFrame.strokeRoundedRect(20, 16, 200, 116, 10);

            const icon = this.add.image(246, 34, `location-icon-${loc.id}`).setDisplaySize(28, 28);
            if (!unlocked) icon.setTint(0x40505a).setAlpha(0.55);
            const name = this.add.text(268, 22, loc.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '25px', color: unlocked ? '#f4e8cf' : '#7a8a90', fontStyle: '700' });
            const desc = this.add.text(246, 57, unlocked ? loc.description : `Requires level ${loc.unlockLevel}`, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#b3a488', wordWrap: { width: 560 }, fontStyle: '700' });
            const meta = this.add.text(246, 108, unlocked ? `Difficulty ${loc.difficultyMod.toFixed(1)}x  •  Value ${loc.valueMult.toFixed(1)}x` : '', { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#5ecdbd', fontStyle: '700' });

            cont.add([bg, thumb, thumbFrame, accentBar, icon, name, desc, meta]);

            if (current) {
                cont.add(this.add.text(w - 130, 74, 'YOU ARE HERE', { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#e7b94f', fontStyle: '800' }).setOrigin(0.5));
            } else if (unlocked) {
                const btn = new Button(this, w - 110, 74, 'TRAVEL', () => {
                    services.location.travel(loc.id);
                    services.audio.play('click');
                    services.requestSave();
                }, { width: 170, height: 48, color: COLORS.accent, fontSize: 16 });
                cont.add(btn);
            } else if (canUnlock) {
                const affordable = services.economy.canAfford(loc.travelCost);
                const btn = new Button(this, w - 130, 74, loc.travelCost > 0 ? `UNLOCK  ${formatCoins(loc.travelCost)}` : 'UNLOCK', () => {
                    if (services.location.unlock(loc.id, p => services.economy.spend(p))) {
                        services.audio.play('purchase');
                        services.achievements.checkAll();
                        services.requestSave();
                        this.rebuild(services);
                    }
                }, { width: 220, height: 48, color: affordable ? COLORS.gold : COLORS.muted, fontSize: 14, disabled: !affordable });
                cont.add(btn);
            } else {
                cont.add(this.add.image(w - 40, 74, 'lock-icon').setScale(1.4));
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

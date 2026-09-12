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
import { PERKS, perkArtTier } from '../data/upgrades';
import { formatCoins } from '../utils/format';
import { fitImage } from '../ui/fitImage';

export class UpgradeScene extends Phaser.Scene {
    private list!: ScrollList;
    private refreshTimer?: Phaser.Time.TimerEvent;
    private reducedMotion = false;

    constructor() { super(SCENE_KEYS.UPGRADE); }

    create(): void {
        const services = getServices(this);
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        const sheet = buildSheet(this, 'Permanent Upgrades', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        this.list = new ScrollList(this, left + 40, top + 110, sheet.width - 80, sheet.height - 150);
        sheet.content.add(this.list);

        this.rebuild(services);

        listen(this, services.bus, EVENTS.PERK_UPGRADED, () => this.scheduleRebuild(services));
        listen(this, services.bus, EVENTS.COINS_CHANGED, () => this.scheduleRebuild(services));
    }

    private scheduleRebuild(services: ReturnType<typeof getServices>): void {
        this.refreshTimer?.remove(false);
        this.refreshTimer = this.time.delayedCall(this.reducedMotion ? 1 : 260, () => this.rebuild(services));
    }

    private rebuild(services: ReturnType<typeof getServices>): void {
        const rowH = 152;
        const items = PERKS.map((perk, i) => this.buildRow(services, perk, i * rowH));
        this.list.setContent(items, PERKS.length * rowH);
    }

    private buildRow(services: ReturnType<typeof getServices>, perk: (typeof PERKS)[number], y: number): Phaser.GameObjects.Container {
        const w = GAME_WIDTH - 200 - 80;
        const c = this.add.container(0, y);
        const bg = this.add.graphics();
        bg.fillStyle(0x0d232c, 0.76);
        bg.fillRoundedRect(0, 6, w, 138, 14);
        bg.lineStyle(1, COLORS.sand, 0.16);
        bg.strokeRoundedRect(0, 6, w, 138, 14);
        c.add(bg);

        const level = services.upgrades.level(perk.id);
        const maxed = services.upgrades.isMaxed(perk.id);
        const cost = services.upgrades.nextCost(perk.id);

        const previewTier = perkArtTier(perk, level);
        const halo = this.add.circle(72, 75, 55, maxed ? COLORS.gold : COLORS.accentDeep, 0.2)
            .setStrokeStyle(2, maxed ? COLORS.gold : COLORS.sand, 0.35);
        const art = this.add.image(72, 75, `perk-${perk.id}`, String(previewTier));
        const artScale = fitImage(art, 108, 100);
        const previewLabel = this.add.text(72, 130, maxed ? 'MASTERED' : `NEXT · TIER ${previewTier}`, {
            fontFamily: 'Nunito, sans-serif', fontSize: '11px', color: maxed ? '#ffd86b' : '#d8c9a3', fontStyle: '800'
        }).setOrigin(0.5);

        const name = this.add.text(148, 18, perk.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '23px', color: '#f4e8cf', fontStyle: '700' });
        const desc = this.add.text(148, 50, perk.description, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#d8c9a3', fontStyle: '700' });
        const effect = this.add.text(148, 78, perk.format(level, Math.min(perk.maxLevel, level + 1)), { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#72e4d4', fontStyle: '800' });
        c.add([halo, art, previewLabel, name, desc, effect]);

        const bar = new ProgressBar(this, 148, 112, { width: 340, height: 10, fillColor: COLORS.gold });
        bar.setValueImmediate(level / perk.maxLevel);
        c.add(bar);
        c.add(this.add.text(502, 107, `${level}/${perk.maxLevel}`, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#d8c9a3' }));

        if (!this.reducedMotion) {
            this.tweens.add({ targets: art, y: 71, duration: 1350 + previewTier * 35, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }

        if (maxed) {
            const status = this.add.graphics();
            status.fillStyle(COLORS.goldDeep, 0.22);
            status.fillRoundedRect(w - 205, 48, 170, 48, 12);
            status.lineStyle(2, COLORS.gold, 0.55);
            status.strokeRoundedRect(w - 205, 48, 170, 48, 12);
            const mastered = this.add.text(w - 120, 72, 'MASTERED', {
                fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#ffd86b', fontStyle: '800'
            }).setOrigin(0.5);
            c.add([status, mastered]);
        } else {
            const affordable = services.economy.canAfford(cost);
            let btn: Button;
            btn = new Button(this, w - 120, 72, formatCoins(cost), () => {
                if (services.upgrades.buyLevel(perk.id, p => services.economy.spend(p))) {
                    btn.setDisabled(true);
                    services.audio.play('purchase');
                    services.achievements.checkAll();
                    services.requestSave();
                    this.celebratePurchase(c, art, artScale);
                }
            }, {
                width: 190, height: 52, color: affordable ? COLORS.gold : COLORS.muted,
                fontSize: 18, disabled: !affordable, iconKey: 'coin-icon', iconSize: 20, iconGap: 8
            });
            c.add(btn);
        }

        return c;
    }

    private celebratePurchase(row: Phaser.GameObjects.Container, art: Phaser.GameObjects.Image, baseScale: number): void {
        if (this.reducedMotion) return;
        this.tweens.killTweensOf(art);
        this.tweens.add({ targets: art, scale: baseScale * 1.16, angle: 5, duration: 120, yoyo: true, ease: 'Cubic.easeOut' });
        const sparks = this.add.particles(72, 75, 'particle-spark', {
            speed: { min: 55, max: 150 }, lifespan: 430, scale: { start: 0.9, end: 0 },
            alpha: { start: 1, end: 0 }, tint: [COLORS.gold, COLORS.accent], emitting: false
        });
        row.add(sparks);
        sparks.explode(18);
    }

    private close(): void {
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.FISHING);
    }
}

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_KEYS, NAV_ITEMS, DEPTH } from '../constants';
import { getServices } from '../core/services';
import { listen } from '../core/listen';
import { EVENTS } from '../core/events';
import { formatCoins } from '../utils/format';
import { countUpText } from '../ui/CountUpText';
import { ProgressBar } from '../ui/ProgressBar';
import { COLORS } from '../ui/theme';
import { getLocation } from '../data/locations';
import { getAchievement } from '../data/achievements';

/**
 * Always-on overlay: coins, level/XP, current location, short-term goal and
 * bottom navigation. Runs parallel to whichever content scene is active.
 */
export class HudScene extends Phaser.Scene {
    private coinsText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private xpBar!: ProgressBar;
    private locationText!: Phaser.GameObjects.Text;
    private goalText!: Phaser.GameObjects.Text;
    private navButtons: Phaser.GameObjects.Container[] = [];
    private popupLayer!: Phaser.GameObjects.Container;

    constructor() { super(SCENE_KEYS.HUD); }

    create(): void {
        const services = getServices(this);

        // top-left: level + XP
        this.add.rectangle(150, 46, 260, 68, 0x08222d, 0.55).setOrigin(0.5).setDepth(DEPTH.UI_PANEL);
        this.levelText = this.add.text(40, 22, `Lv ${services.save.level}`, {
            fontFamily: 'Fredoka, sans-serif', fontSize: '26px', color: '#fff6e0'
        }).setDepth(DEPTH.UI_PANEL + 1);
        this.xpBar = new ProgressBar(this, 40, 58, { width: 220, height: 14, fillColor: COLORS.accent });
        this.xpBar.setDepth(DEPTH.UI_PANEL + 1);
        this.xpBar.setValueImmediate(services.progression.xpProgress);

        // top-right: coins
        this.add.rectangle(GAME_WIDTH - 150, 46, 240, 56, 0x08222d, 0.55).setOrigin(0.5).setDepth(DEPTH.UI_PANEL);
        this.add.image(GAME_WIDTH - 260, 46, 'coin-icon').setScale(1.3).setDepth(DEPTH.UI_PANEL + 1);
        this.coinsText = this.add.text(GAME_WIDTH - 235, 46, formatCoins(services.economy.coins), {
            fontFamily: 'Fredoka, sans-serif', fontSize: '26px', color: '#f7d585'
        }).setOrigin(0, 0.5).setDepth(DEPTH.UI_PANEL + 1);

        // location label
        this.locationText = this.add.text(GAME_WIDTH / 2, 26, getLocation(services.save.currentLocation).name, {
            fontFamily: 'Fredoka, sans-serif', fontSize: '22px', color: '#c9e8ec'
        }).setOrigin(0.5, 0).setDepth(DEPTH.UI_PANEL + 1).setInteractive({ useHandCursor: true });
        this.locationText.on('pointerdown', () => this.openOverlay(SCENE_KEYS.MAP));

        // settings gear
        this.add.circle(GAME_WIDTH - 40, 96, 20, 0x08222d, 0.55).setDepth(DEPTH.UI_PANEL);
        const gear = this.add.text(GAME_WIDTH - 40, 96, '⚙', {
            fontFamily: 'Nunito, sans-serif', fontSize: '24px', color: '#c9e8ec'
        }).setOrigin(0.5).setDepth(DEPTH.UI_PANEL + 1).setInteractive({ useHandCursor: true });
        gear.on('pointerover', () => gear.setColor('#f7d585'));
        gear.on('pointerout', () => gear.setColor('#c9e8ec'));
        gear.on('pointerdown', () => this.openOverlay(SCENE_KEYS.SETTINGS));

        // goal widget
        this.goalText = this.add.text(GAME_WIDTH / 2, 62, '', {
            fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#8fd8c9', fontStyle: '700', align: 'center'
        }).setOrigin(0.5, 0).setDepth(DEPTH.UI_PANEL + 1);
        this.refreshGoal(services);

        // bottom nav
        this.buildNav();

        this.popupLayer = this.add.container(0, 0).setDepth(DEPTH.UI_POPUP);

        listen(this, services.bus, EVENTS.COINS_CHANGED, ({ coins, delta }) => {
            const from = coins - delta;
            countUpText(this, this.coinsText, from, coins, 400, n => formatCoins(n));
        });
        listen(this, services.bus, EVENTS.XP_CHANGED, ({ level, xpToNext, xp }) => {
            this.levelText.setText(`Lv ${level}`);
            this.xpBar.setValue(xpToNext > 0 ? xp / xpToNext : 1);
            this.refreshGoal(services);
        });
        listen(this, services.bus, EVENTS.LEVEL_UP, ({ level }) => this.showLevelUp(level));
        listen(this, services.bus, EVENTS.ACHIEVEMENT_UNLOCKED, ({ id }) => this.showAchievement(id));
        listen(this, services.bus, EVENTS.CHALLENGE_COMPLETED, () => this.refreshGoal(services));
        listen(this, services.bus, EVENTS.LOCATION_CHANGED, ({ locationId }) => {
            this.locationText.setText(getLocation(locationId).name);
            this.refreshGoal(services);
            this.restartFishing();
        });
        listen(this, services.bus, EVENTS.CATCH, () => this.refreshGoal(services));
    }

    private buildNav(): void {
        const y = GAME_HEIGHT - 40;
        const total = NAV_ITEMS.length;
        const spacing = 190;
        const startX = GAME_WIDTH / 2 - ((total - 1) * spacing) / 2;

        this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, 80, 0x08222d, 0.6).setDepth(DEPTH.UI_PANEL);

        NAV_ITEMS.forEach((item, i) => {
            const c = this.add.container(startX + i * spacing, y).setDepth(DEPTH.UI_PANEL + 1);
            const bg = this.add.graphics();
            const label = this.add.text(0, 0, item.label, {
                fontFamily: 'Fredoka, sans-serif', fontSize: '17px', color: '#eaf6f8'
            }).setOrigin(0.5);
            bg.fillStyle(0x0f3b4f, 0.001); // invisible hit area (drawn via container size)
            c.add([bg, label]);
            c.setSize(170, 60);
            c.setInteractive({ useHandCursor: true });
            c.on('pointerover', () => label.setColor('#f7d585'));
            c.on('pointerout', () => label.setColor(this.isActive(item.key) ? '#f7d585' : '#eaf6f8'));
            c.on('pointerdown', () => {
                getServices(this).audio.play('click');
                if (item.key === SCENE_KEYS.FISHING) this.restartFishing();
                else this.openOverlay(item.key);
            });
            this.navButtons.push(c);
        });
        this.highlightActiveNav();
    }

    private isActive(key: string): boolean {
        return this.scene.isActive(key) || this.scene.isVisible(key);
    }

    private highlightActiveNav(): void {
        NAV_ITEMS.forEach((item, i) => {
            const label = this.navButtons[i].list[1] as Phaser.GameObjects.Text;
            label.setColor(this.isActive(item.key) ? '#f7d585' : '#eaf6f8');
        });
    }

    private overlayKeys(): string[] {
        return [...NAV_ITEMS.map(i => i.key), SCENE_KEYS.MAP, SCENE_KEYS.SETTINGS].filter(k => k !== SCENE_KEYS.FISHING);
    }

    private restartFishing(): void {
        for (const key of this.overlayKeys()) {
            if (this.scene.isActive(key)) this.scene.stop(key);
        }
        if (this.scene.isActive(SCENE_KEYS.FISHING)) this.scene.stop(SCENE_KEYS.FISHING);
        this.scene.run(SCENE_KEYS.FISHING);
        this.time.delayedCall(0, () => this.highlightActiveNav());
    }

    private openOverlay(key: string): void {
        for (const other of this.overlayKeys()) {
            if (other !== key && this.scene.isActive(other)) this.scene.stop(other);
        }
        if (this.scene.isActive(key)) { this.scene.stop(key); this.scene.resume(SCENE_KEYS.FISHING); }
        else {
            this.scene.pause(SCENE_KEYS.FISHING);
            this.scene.launch(key);
            this.scene.bringToTop(key);
        }
        this.time.delayedCall(0, () => this.highlightActiveNav());
    }

    private refreshGoal(services: ReturnType<typeof getServices>): void {
        const challenge = services.challenges.active()[0];
        const nextLoc = services.location.nextLocked();
        let text = 'Catch one more fish!';
        if (challenge) text = `${challenge.description} (${Math.min(challenge.progress, challenge.target)}/${challenge.target})`;
        if (nextLoc && services.save.level < nextLoc.unlockLevel) {
            text += `   •   Reach Lv ${nextLoc.unlockLevel} to unlock ${nextLoc.name}`;
        }
        this.goalText.setText(text);
    }

    private showLevelUp(level: number): void {
        getServices(this).audio.play('levelup');
        const burst = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(DEPTH.UI_POPUP);
        const bg = this.add.circle(0, 0, 10, 0xf7d585, 0.9);
        const label = this.add.text(0, 0, `LEVEL ${level}!`, { fontFamily: 'Fredoka, sans-serif', fontSize: '48px', color: '#0c2733' }).setOrigin(0.5);
        burst.add([bg, label]);
        this.tweens.add({ targets: bg, scale: 40, alpha: 0, duration: 700, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: label, scale: { from: 0.3, to: 1.1 }, duration: 350, ease: 'Back.easeOut' });
        this.tweens.add({ targets: burst, alpha: 0, duration: 400, delay: 900, onComplete: () => burst.destroy() });

        const sparkles = this.add.particles(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'star-icon', {
            speed: { min: 150, max: 400 }, lifespan: 800, scale: { start: 1, end: 0 }, quantity: 24, tint: 0xf7d585
        }).setDepth(DEPTH.UI_POPUP);
        this.time.delayedCall(900, () => sparkles.destroy());
    }

    private showAchievement(id: string): void {
        getServices(this).audio.play('achievement');
        const def = getAchievement(id);
        const w = 420, h = 90;
        const c = this.add.container(GAME_WIDTH / 2, -80).setDepth(DEPTH.UI_POPUP);
        const bg = this.add.graphics();
        bg.fillStyle(0x0f3b4f, 0.95);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
        bg.lineStyle(3, 0xf7d585, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
        const title = this.add.text(-w / 2 + 20, -h / 2 + 14, 'ACHIEVEMENT UNLOCKED', {
            fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#f7d585', fontStyle: '800'
        });
        const name = this.add.text(-w / 2 + 20, -h / 2 + 34, def.name, {
            fontFamily: 'Fredoka, sans-serif', fontSize: '24px', color: '#fff6e0'
        });
        const desc = this.add.text(-w / 2 + 20, -h / 2 + 64, def.description, {
            fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#c9e8ec'
        });
        c.add([bg, title, name, desc]);
        this.popupLayer.add(c);

        this.tweens.add({
            targets: c, y: 90, duration: 400, ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({ targets: c, y: -80, duration: 350, delay: 2600, ease: 'Cubic.easeIn', onComplete: () => c.destroy() });
            }
        });
    }
}

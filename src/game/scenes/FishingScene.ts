import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_KEYS, DEPTH } from '../constants';
import { getServices } from '../core/services';
import { LocationRenderer, HORIZON_Y } from '../art/LocationRenderer';
import { generateFishTexture } from '../art/FishArt';
import { getLocation } from '../data/locations';
import { getEquipment } from '../data/equipment';
import { FishingSystem, TRACK_HEIGHT, type CastContext, type ReelSnapshot } from '../systems/FishingSystem';
import type { RolledFish } from '../systems/FishGenerator';
import { ReelMeter } from '../ui/ReelMeter';
import { CatchCard } from '../ui/CatchCard';
import { floatingText } from '../ui/FloatingText';
import type { CatchResult, EscapeResult } from '../core/events';
import { BALANCE } from '../data/balance';
import { fishForLocation } from '../data/fish';

const ROD_ANCHOR = { x: 130, y: GAME_HEIGHT - 60 };
const CAST_Y = HORIZON_Y + 130;
const REEL_METER_X = GAME_WIDTH * 0.8;
const REEL_METER_Y = GAME_HEIGHT - 90;

export class FishingScene extends Phaser.Scene {
    private env!: LocationRenderer;
    private fishing = new FishingSystem();
    private reelMeter!: ReelMeter;
    private catchCard!: CatchCard;

    private rodGfx!: Phaser.GameObjects.Graphics;
    private lineGfx!: Phaser.GameObjects.Graphics;
    private bobber!: Phaser.GameObjects.Image;
    private bobberCap!: Phaser.GameObjects.Image;
    private promptText!: Phaser.GameObjects.Text;
    private hugeBanner!: Phaser.GameObjects.Text;

    private bobberX = GAME_WIDTH * 0.5;
    private bobberY = CAST_Y;
    private rodBend = 0; // 0..1
    private isPointerDown = false;
    private resultCardOpen = false;
    private rodTipX = ROD_ANCHOR.x + 60;
    private rodTipY = ROD_ANCHOR.y - 300;

    constructor() { super(SCENE_KEYS.FISHING); }

    create(): void {
        const services = getServices(this);
        const loc = getLocation(services.save.currentLocation);

        this.env = new LocationRenderer(this);
        this.env.build(loc);

        // Pre-generate textures for every fish this location can produce.
        for (const f of fishForLocation(loc.id)) {
            generateFishTexture(this, `fish-${f.id}`, f.art);
        }

        this.rodGfx = this.add.graphics().setDepth(DEPTH.ROD);
        this.lineGfx = this.add.graphics().setDepth(DEPTH.LINE);
        this.bobber = this.add.image(this.bobberX, this.bobberY, 'bobber').setDepth(DEPTH.BOBBER).setVisible(false);
        this.bobberCap = this.add.image(this.bobberX, this.bobberY, 'bobber-cap').setDepth(DEPTH.BOBBER + 1).setVisible(false);
        this.applyBobberSkin();

        this.reelMeter = new ReelMeter(this, REEL_METER_X, REEL_METER_Y);
        this.reelMeter.setDepth(DEPTH.MINIGAME);
        this.catchCard = new CatchCard(this);

        this.promptText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.78, 'Click the water to cast', {
            fontFamily: 'Nunito, sans-serif', fontSize: '24px', color: '#eaf6f8', fontStyle: '700'
        }).setOrigin(0.5).setDepth(DEPTH.UI_TOP).setAlpha(0.85);
        this.tweens.add({ targets: this.promptText, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });

        this.hugeBanner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.22, 'Something HUGE is on the line!', {
            fontFamily: 'Fredoka, sans-serif', fontSize: '38px', color: '#ff8a3d', stroke: '#0c2733', strokeThickness: 6
        }).setOrigin(0.5).setDepth(DEPTH.UI_TOP).setVisible(false).setAlpha(0);

        this.drawRod();

        this.bindInput();
        this.bindFishingEvents(services);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownScene());
    }

    /**
     * Phaser calls this directly every frame for the active scene -- unlike
     * `this.events.on(UPDATE, ...)`, it never accumulates duplicate listeners
     * across repeated stop()/create() cycles (e.g. every time the player
     * revisits the FISH tab), so it's the correct place for per-frame logic.
     */
    update(_time: number, dt: number): void {
        this.onUpdate(dt);
    }

    // ---------------------------------------------------------------- input

    private bindInput(): void {
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handleDown(p.x, p.y));
        this.input.on('pointerup', () => { this.isPointerDown = false; });
        this.input.on('pointerupoutside', () => { this.isPointerDown = false; });

        const space = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        space?.on('down', () => this.handleDown(this.bobberX, this.bobberY));
        space?.on('up', () => { this.isPointerDown = false; });
    }

    private handleDown(x: number, y: number): void {
        // Ignore taps over the HUD's bottom nav strip so opening SHOP/COLLECTION/etc
        // can never also be misread as a cast/hook/hold, regardless of scene-pause timing.
        if (y > GAME_HEIGHT - 70) return;
        this.isPointerDown = true;
        if (this.resultCardOpen) return; // the catch/escape reveal owns input until dismissed
        const services = getServices(this);

        switch (this.fishing.state) {
            case 'idle':
                this.promptText.setVisible(false);
                services.stats.recordCast();
                this.startCast(services, x);
                break;
            case 'waiting':
                this.fishing.cancelWait();
                this.onIdleReturn();
                break;
            case 'bite':
                this.fishing.attemptHook();
                break;
            default:
                break; // reeling handled continuously via isPointerDown in onUpdate
        }
    }

    // ---------------------------------------------------------------- casting

    private buildCastContext(services: ReturnType<typeof getServices>): CastContext {
        const loadout = services.equipment.getLoadout();
        return {
            locationId: services.save.currentLocation,
            loadout,
            luck: {
                rodRareLuck: loadout.rod.rareLuck,
                baitRarityLuck: loadout.bait.rarityLuck,
                luckyHookBonus: services.upgrades.luckyHook
            },
            discovered: new Set(Object.keys(services.save.fishRecords)),
            fishSenseLevel: services.upgrades.fishSenseLevel,
            castsSinceRareOrBetter: services.save.stats.castsSinceRareOrBetter,
            totalCaught: services.save.stats.totalCaught,
            quickBiteBonus: services.upgrades.quickBite,
            strongArmsBonus: services.upgrades.strongArms
        };
    }

    private startCast(services: ReturnType<typeof getServices>, targetX: number): void {
        const ctx = this.buildCastContext(services);
        const clampedX = Phaser.Math.Clamp(targetX, 220, GAME_WIDTH - 100);
        this.fishing.startCast(ctx, clampedX);

        services.audio.play('cast');
        this.rodBend = 0.35;
        this.tweens.add({ targets: this, rodBend: 0, duration: 260, ease: 'Sine.easeOut' });

        // bobber flies from the rod tip to the target on a gentle arc
        this.bobber.setVisible(true).setAlpha(1);
        this.bobberCap.setVisible(true).setAlpha(1);
        const startX = ROD_ANCHOR.x + 40, startY = ROD_ANCHOR.y - 260;
        this.bobberX = startX; this.bobberY = startY;
        this.bobber.setPosition(startX, startY);
        this.bobberCap.setPosition(startX, startY);

        const flightTime = 480;
        const flight = { t: 0 };
        this.tweens.add({
            targets: flight, t: 1, duration: flightTime, ease: 'Sine.easeIn',
            onUpdate: () => {
                const t = flight.t;
                const x = Phaser.Math.Linear(startX, clampedX, t);
                const arcHeight = 160 * Math.sin(Math.PI * t);
                const y = Phaser.Math.Linear(startY, CAST_Y, t) - arcHeight;
                this.bobberX = x; this.bobberY = y;
                this.bobber.setPosition(x, y);
                this.bobberCap.setPosition(x, y - 2);
            },
            onComplete: () => {
                this.bobberY = CAST_Y;
                this.bobber.setPosition(clampedX, CAST_Y);
                this.bobberCap.setPosition(clampedX, CAST_Y - 2);
                this.splash(clampedX, CAST_Y);
                services.audio.play('splash');
                this.fishing.onSplashLanded();
            }
        });
    }

    private splash(x: number, y: number): void {
        const burst = this.add.particles(x, y, 'particle-dot', {
            speed: { min: 60, max: 180 }, angle: { min: 250, max: 290 }, lifespan: 420,
            scale: { start: 1.4, end: 0 }, alpha: { start: 0.9, end: 0 }, quantity: 14, tint: 0xdfeef2
        }).setDepth(DEPTH.PARTICLES);
        this.time.delayedCall(500, () => burst.destroy());

        for (let i = 0; i < 2; i++) {
            const ring = this.add.image(x, y, 'ripple-ring').setDepth(DEPTH.WATER + 3).setScale(0.2).setAlpha(0.8);
            this.tweens.add({
                targets: ring, scale: 2.2 + i * 0.6, alpha: 0, duration: 700 + i * 200, delay: i * 120, ease: 'Cubic.easeOut',
                onComplete: () => ring.destroy()
            });
        }
        this.cameras.main.shake(90, 0.003);
    }

    private onIdleReturn(): void {
        this.bobber.setVisible(false);
        this.bobberCap.setVisible(false);
        this.promptText.setVisible(true).setAlpha(0.85);
    }

    // ---------------------------------------------------------------- fishing system events

    private bindFishingEvents(services: ReturnType<typeof getServices>): void {
        this.fishing.on('nibble', () => {
            services.audio.play('nibble');
            this.tweens.add({ targets: [this.bobber, this.bobberCap], y: '+=10', duration: 90, yoyo: true, ease: 'Sine.easeOut' });
        });

        this.fishing.on('huge', () => {
            this.showHugeBanner();
        });

        this.fishing.on('bite', (..._args: unknown[]) => {
            services.audio.play('bite');
            this.cameras.main.shake(160, 0.006);
            this.rodBend = 1;
            this.tweens.add({ targets: this, rodBend: 0.15, duration: 220, ease: 'Back.easeOut' });
            this.tweens.add({ targets: [this.bobber, this.bobberCap], y: '+=26', duration: 140, ease: 'Sine.easeIn', yoyo: true });
            floatingText(this, this.bobberX, this.bobberY - 60, '!', '#ffdf6b', 44);
        });

        this.fishing.on('reelStart', (...args: unknown[]) => {
            const rolled = args[0] as RolledFish;
            this.bobber.setVisible(false);
            this.bobberCap.setVisible(false);
            this.rodBend = 0.5;
            const key = `fish-${rolled.fish.id}`;
            generateFishTexture(this, key, rolled.fish.art);
            this.reelMeter.beginEncounter(key, rolled.fish.rarity);
        });

        this.fishing.on('reelSuccess', (...args: unknown[]) => {
            const payload = args[0] as { rolled: RolledFish; isHuge: boolean; perfect: boolean };
            this.resolveCatch(services, payload.rolled, payload.perfect);
        });

        this.fishing.on('reelFail', (...args: unknown[]) => {
            const payload = args[0] as { rolled: RolledFish; lineSnapped: boolean; meter: number };
            this.resolveEscape(services, payload.rolled, payload.lineSnapped, payload.meter);
        });

        this.fishing.on('missedHook', () => {
            this.rodBend = 0;
            this.onIdleReturn();
        });
    }

    private showHugeBanner(): void {
        this.hugeBanner.setVisible(true).setAlpha(0).setScale(0.7);
        this.tweens.add({ targets: this.hugeBanner, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: this.hugeBanner, alpha: 0, duration: 300, delay: 1400,
            onComplete: () => this.hugeBanner.setVisible(false)
        });
        this.cameras.main.shake(260, 0.01);
    }

    private resolveCatch(services: ReturnType<typeof getServices>, rolled: RolledFish, perfect: boolean): void {
        const rec = services.save.fishRecords[rolled.fish.id];
        const isNewSpecies = !rec;
        const isNewRecord = isNewSpecies || rolled.weight > rec.bestWeight;

        const goldenTouch = services.upgrades.goldenTouchMult;
        const coins = services.economy.fishValue(rolled.fish, rolled.weight, rolled.sizeLabel, services.save.currentLocation, goldenTouch);
        const sizeMult = BALANCE.economy.sizeLabelValueMult[rolled.sizeLabel] ?? 1;
        const perfectBonus = perfect ? BALANCE.xp.perfectBonusMult : 1;
        const xp = Math.round(rolled.fish.xp * sizeMult * services.upgrades.xpHunterMult * perfectBonus);

        const result: CatchResult = {
            fish: rolled.fish, weight: rolled.weight, weightPercentile: rolled.weightPercentile,
            sizeLabel: rolled.sizeLabel, isNewSpecies, isNewRecord, coins, xp, perfect
        };

        services.audio.play(rolled.fish.rarity === 'legendary' || rolled.fish.rarity === 'mythic' ? 'rare' : 'catch');
        this.reelMeter.endEncounter();

        this.resultCardOpen = true;
        this.catchCard.show(result, `fish-${rolled.fish.id}`, () => {
            this.resultCardOpen = false;
            this.catchCard.hide();
            services.finalizeCatch(result);
            this.rodBend = 0;
            this.onIdleReturn();
        });
    }

    private resolveEscape(services: ReturnType<typeof getServices>, rolled: RolledFish, lineSnapped: boolean, meter: number): void {
        services.stats.recordEscape({ fish: rolled.fish, meterAtEscape: meter } as EscapeResult);
        services.audio.play('escape');
        this.reelMeter.endEncounter();
        this.cameras.main.shake(180, 0.007);
        const pct = Math.round(meter * 100);
        floatingText(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.4,
            lineSnapped ? 'The line snapped!' : `It got away… (so close: ${pct}%)`, '#ff8a7a', 26);
        this.rodBend = 0;
        this.onIdleReturn();
        services.requestSave();
    }

    // ---------------------------------------------------------------- per-frame

    private onUpdate(dt: number): void {
        this.env.update(dt);
        this.fishing.update(dt, this.isPointerDown);

        if (this.fishing.state === 'reeling') {
            const snap: ReelSnapshot = this.fishing.snapshot();
            this.reelMeter.update(snap);
            this.rodBend = Phaser.Math.Clamp(0.3 + (1 - snap.meter) * 0.4 + snap.tension * 0.3, 0, 1);
        }

        this.drawRod();
        this.drawLine();
    }

    private drawRod(): void {
        this.rodGfx.clear();
        const baseX = ROD_ANCHOR.x, baseY = ROD_ANCHOR.y;
        const tipX = baseX + 60 - this.rodBend * 40;
        const tipY = baseY - 300 + this.rodBend * 60;
        const midX = baseX + 30 - this.rodBend * 60;
        const midY = baseY - 160;

        this.rodGfx.lineStyle(10, 0x6a4a30, 1);
        this.rodGfx.beginPath();
        this.rodGfx.moveTo(baseX, baseY);
        this.rodGfx.lineTo(midX, midY);
        this.rodGfx.strokePath();
        this.rodGfx.lineStyle(7, 0x8a6a40, 1);
        this.rodGfx.beginPath();
        this.rodGfx.moveTo(midX, midY);
        this.rodGfx.lineTo(tipX, tipY);
        this.rodGfx.strokePath();

        this.rodTipX = tipX;
        this.rodTipY = tipY;
    }

    private drawLine(): void {
        this.lineGfx.clear();
        const targetVisible = this.bobber.visible || this.fishing.state === 'reeling';
        if (!targetVisible) return;
        const targetX = this.fishing.state === 'reeling' ? REEL_METER_X : this.bobberX;
        const targetY = this.fishing.state === 'reeling' ? REEL_METER_Y - TRACK_HEIGHT * 0.15 : this.bobberY;

        const services = getServices(this);
        const lineColor = services.equipment.getLoadout().line.color;
        const wobble = this.fishing.state === 'reeling' ? Math.sin(this.time.now * 0.02) * 6 * this.fishing.snapshot().tension : 0;

        this.lineGfx.lineStyle(2, lineColor, 0.85);
        this.lineGfx.beginPath();
        this.lineGfx.moveTo(this.rodTipX, this.rodTipY);
        this.lineGfx.lineTo((this.rodTipX + targetX) / 2 + wobble, (this.rodTipY + targetY) / 2);
        this.lineGfx.lineTo(targetX, targetY);
        this.lineGfx.strokePath();
    }

    private applyBobberSkin(): void {
        const services = getServices(this);
        const bobberDef = getEquipment(services.save.equipped.bobber);
        const stats = bobberDef.stats as { skinColor: number };
        this.bobberCap.setTint(stats.skinColor);
    }

    private shutdownScene(): void {
        this.fishing.removeAllListeners();
        this.env.destroy();
    }
}

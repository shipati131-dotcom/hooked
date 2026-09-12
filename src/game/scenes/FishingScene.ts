import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_KEYS, DEPTH } from '../constants';
import { getServices } from '../core/services';
import { LocationRenderer, HORIZON_Y } from '../art/LocationRenderer';
import { generateFishTexture } from '../art/FishArt';
import { getLocation } from '../data/locations';
import { getEquipment } from '../data/equipment';
import { FishingSystem, type CastContext, type ReelSnapshot } from '../systems/FishingSystem';
import type { RolledFish } from '../systems/FishGenerator';
import { ReelMeter } from '../ui/ReelMeter';
import { CatchCard } from '../ui/CatchCard';
import { floatingText } from '../ui/FloatingText';
import { EVENTS, type CatchResult, type EscapeResult } from '../core/events';
import { listen } from '../core/listen';
import { BALANCE } from '../data/balance';
import { fishForLocation } from '../data/fish';
import { COLORS } from '../ui/theme';

// The rod is completely static -- one fixed pose (angled to read as nearly
// vertical) at one fixed position, close to the left edge. It never rotates,
// bends, or slides; only the line and bobber travel to wherever the player
// casts.
const ROD_ANCHOR_Y = GAME_HEIGHT - 90;
const ROD_FIXED_X = GAME_WIDTH * 0.25;
// Bigger overall than a plain uniform scale-up would give.
const ROD_DISPLAY_W = 480;
const ROD_DISPLAY_H = 480;
const ROD_ANGLE_DEG = -47;
// The on-screen rod uses the actual per-tier art from the 'equipment-rod'
// atlas (frame = equipped rod id) instead of one fixed texture, so buying
// and equipping a new rod is immediately visible here -- see applyRodSkin().
// All 6 tiers in that atlas share the same pose (measured empirically:
// handle bottom-left, tip top-right, length ~623px, angle ~-44.4deg, within
// each 512x512 cell), so one shared tip-offset calculation works for all of
// them. The handle sits at local origin (0.046, 0.869) of the cell.
const ROD_ATLAS_CELL = 512;
const ROD_ATLAS_HANDLE_ORIGIN = { x: 0.046, y: 0.869 };
const ROD_TIP_LOCAL = { length: 623, angleDeg: -44.4 };
const ROD_TIP_SCALE_X = ROD_DISPLAY_W / ROD_ATLAS_CELL;
const ROD_TIP_SCALE_Y = ROD_DISPLAY_H / ROD_ATLAS_CELL;
const ROD_TIP_LOCAL_RAD = Phaser.Math.DegToRad(ROD_TIP_LOCAL.angleDeg);
const ROD_TIP_LOCAL_X = Math.cos(ROD_TIP_LOCAL_RAD) * ROD_TIP_LOCAL.length * ROD_TIP_SCALE_X;
const ROD_TIP_LOCAL_Y = Math.sin(ROD_TIP_LOCAL_RAD) * ROD_TIP_LOCAL.length * ROD_TIP_SCALE_Y;
const ROD_ROT_RAD = Phaser.Math.DegToRad(ROD_ANGLE_DEG);
const ROD_TIP_OFFSET = {
    x: ROD_TIP_LOCAL_X * Math.cos(ROD_ROT_RAD) - ROD_TIP_LOCAL_Y * Math.sin(ROD_ROT_RAD),
    y: ROD_TIP_LOCAL_X * Math.sin(ROD_ROT_RAD) + ROD_TIP_LOCAL_Y * Math.cos(ROD_ROT_RAD)
};
const CAST_Y = HORIZON_Y + 130;
const REEL_METER_X = GAME_WIDTH * 0.5;
const REEL_METER_Y = 145;
// The bobber-art source image is 160x237; this scale renders it at a size
// that's actually readable on the water instead of a near-invisible speck.
const BOBBER_SCALE = 0.22;

export class FishingScene extends Phaser.Scene {
    private env!: LocationRenderer;
    private fishing = new FishingSystem();
    private reelMeter!: ReelMeter;
    private catchCard!: CatchCard;

    private rodSprite!: Phaser.GameObjects.Image;
    private lineGfx!: Phaser.GameObjects.Graphics;
    private bobber!: Phaser.GameObjects.Image;
    private promptText!: Phaser.GameObjects.Text;
    private hugeBanner!: Phaser.GameObjects.Text;

    private bobberX = GAME_WIDTH * 0.5;
    private bobberY = CAST_Y;
    private isPointerDown = false;
    private resultCardOpen = false;
    private rodTipX = 0;
    private rodTipY = 0;
    private reelSoundTimer = 0;
    private reelAnimTime = 0;

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

        this.rodSprite = this.add.image(ROD_FIXED_X, ROD_ANCHOR_Y, 'equipment-rod')
            .setOrigin(ROD_ATLAS_HANDLE_ORIGIN.x, ROD_ATLAS_HANDLE_ORIGIN.y)
            .setDisplaySize(ROD_DISPLAY_W, ROD_DISPLAY_H)
            .setAngle(ROD_ANGLE_DEG)
            .setDepth(DEPTH.ROD);
        this.applyRodSkin();
        this.lineGfx = this.add.graphics().setDepth(DEPTH.LINE);
        this.bobber = this.add.image(this.bobberX, this.bobberY, 'bobber-art')
            .setScale(BOBBER_SCALE)
            .setDepth(DEPTH.BOBBER)
            .setVisible(false);
        this.applyBobberSkin();

        this.reelMeter = new ReelMeter(this, REEL_METER_X, REEL_METER_Y);
        this.reelMeter.setDepth(DEPTH.MINIGAME);
        this.catchCard = new CatchCard(this);

        this.promptText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.78, 'Click the water to cast', {
            fontFamily: 'Nunito, sans-serif', fontSize: '26px', color: '#f4e8cf', fontStyle: '700',
            stroke: '#07161d', strokeThickness: 4
        }).setOrigin(0.5).setDepth(DEPTH.UI_TOP).setAlpha(0.85);
        this.tweens.add({ targets: this.promptText, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });

        this.hugeBanner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.22, 'Something HUGE is on the line!', {
            fontFamily: 'Fredoka, sans-serif', fontSize: '42px', color: '#e8754f', fontStyle: '700',
            stroke: '#17252b', strokeThickness: 7
        }).setOrigin(0.5).setDepth(DEPTH.UI_TOP).setVisible(false).setAlpha(0);

        this.drawRod();

        this.bindInput();
        this.bindFishingEvents(services);

        // The Shop pauses (not stops) this scene while open, so create() won't
        // re-run after a purchase -- refresh the on-screen gear immediately on
        // equip instead, so a newly bought rod/bobber is visible the moment
        // the player is back here, not just after some other scene reload.
        listen(this, services.bus, EVENTS.EQUIP_CHANGED, ({ category }) => {
            if (category === 'rod') this.applyRodSkin();
            else if (category === 'bobber') this.applyBobberSkin();
        });

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
        this.drawRod(); // recompute rodTipX/Y immediately so the cast launches from the tip

        services.audio.play('cast');

        // bobber flies from the rod tip to the target on a gentle arc
        this.bobber.setVisible(true).setAlpha(1);
        const startX = this.rodTipX, startY = this.rodTipY;
        this.bobberX = startX; this.bobberY = startY;
        this.bobber.setPosition(startX, startY);

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
            },
            onComplete: () => {
                this.bobberY = CAST_Y;
                this.bobber.setPosition(clampedX, CAST_Y);
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
        this.promptText.setVisible(true).setAlpha(0.85);
    }

    // ---------------------------------------------------------------- fishing system events

    private bindFishingEvents(services: ReturnType<typeof getServices>): void {
        this.fishing.on('nibble', () => {
            services.audio.play('nibble');
            this.tweens.add({ targets: this.bobber, y: '+=10', duration: 90, yoyo: true, ease: 'Sine.easeOut' });
        });

        this.fishing.on('huge', () => {
            this.showHugeBanner();
        });

        this.fishing.on('bite', (..._args: unknown[]) => {
            services.audio.play('bite');
            this.cameras.main.shake(160, 0.006);
            this.tweens.add({ targets: this.bobber, y: '+=26', duration: 140, ease: 'Sine.easeIn', yoyo: true });
            // bobber compresses under the strike, then pops back -- a squash/stretch beat
            this.tweens.add({
                targets: this.bobber, scaleY: BOBBER_SCALE * 0.545, scaleX: BOBBER_SCALE * 1.34, duration: 90, ease: 'Sine.easeOut',
                onComplete: () => this.tweens.add({ targets: this.bobber, scaleY: BOBBER_SCALE, scaleX: BOBBER_SCALE, duration: 220, ease: 'Elastic.easeOut', easeParams: [1, 0.6] })
            });
            floatingText(this, this.bobberX, this.bobberY - 60, '!', '#f5c451', 44);
        });

        this.fishing.on('reelStart', (...args: unknown[]) => {
            const rolled = args[0] as RolledFish;
            this.bobber.setVisible(false);
            const key = `fish-${rolled.fish.id}`;
            generateFishTexture(this, key, rolled.fish.art);
            this.reelMeter.beginEncounter(key, rolled.fish.rarity, rolled.fish.name);
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

        // CatchCard owns the catch/rare sfx timing itself so the sound lands on the
        // actual reveal beat rather than spoiling a suspenseful rare-fish teaser.
        this.reelMeter.endEncounter();

        this.resultCardOpen = true;
        this.catchCard.show(result, `fish-${rolled.fish.id}`, () => {
            this.resultCardOpen = false;
            this.catchCard.hide();
            services.finalizeCatch(result);
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
            lineSnapped ? 'The line snapped!' : `It got away… (so close: ${pct}%)`, '#e8a08c', 26);
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

            // Accumulate reel animation time
            this.reelAnimTime += dt / 1000;

            // Play reel-crank sound at intervals while actively holding (reeling in)
            this.reelSoundTimer += dt;
            if (this.isPointerDown && this.reelSoundTimer >= 160) {
                this.reelSoundTimer = 0;
                const services = getServices(this);
                services.audio.play('reel-crank');
            }
        } else {
            this.reelSoundTimer = 0;
            this.reelAnimTime = 0;
        }

        this.drawRod();
        this.drawLine();
    }

    private drawRod(): void {
        const isReeling = this.fishing.state === 'reeling';

        // The rod never moves horizontally (or at all) -- it stays pinned to
        // ROD_FIXED_X for the entire scene.
        this.rodSprite.setPosition(ROD_FIXED_X, ROD_ANCHOR_Y);

        // Subtle scale pulse while reeling for "alive" feel. Applied via setDisplaySize
        // (not setScale) so it multiplies the configured ROD_DISPLAY_W/H rather than
        // fighting with it -- setScale(1) here would otherwise reset the sprite back
        // to its full native texture size every frame.
        const scalePulse = isReeling ? 1 + Math.sin(this.reelAnimTime * 4.0) * 0.008 : 1;
        this.rodSprite.setDisplaySize(ROD_DISPLAY_W * scalePulse, ROD_DISPLAY_H * scalePulse);

        this.rodTipX = ROD_FIXED_X + ROD_TIP_OFFSET.x * scalePulse;
        this.rodTipY = ROD_ANCHOR_Y + ROD_TIP_OFFSET.y * scalePulse;
    }

    private drawLine(): void {
        this.lineGfx.clear();
        const targetVisible = this.bobber.visible || this.fishing.state === 'reeling';
        if (!targetVisible) return;
        const targetX = this.fishing.state === 'reeling' ? REEL_METER_X - 470 : this.bobberX;
        const targetY = this.fishing.state === 'reeling' ? REEL_METER_Y + 365 : this.bobberY;

        const services = getServices(this);
        const lineColor = services.equipment.getLoadout().line.color;
        const snap = this.fishing.state === 'reeling' ? this.fishing.snapshot() : null;
        const tension = snap?.tensionActive ? snap.tension : 0;

        // A relaxed line has a gentle organic sway; as tension climbs it visibly
        // straightens and thickens, then reddens toward the danger color right
        // before a snap -- "the line tightens" made legible at a glance.
        const wobble = Math.sin(this.time.now * 0.02) * 5 * (1 - tension) * (this.fishing.state === 'reeling' ? 1 : 0.4);
        const width = 2 + tension * 2.5;
        const color = tension > 0 ? Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(lineColor), Phaser.Display.Color.ValueToColor(COLORS.danger), 100, Math.round(tension * 100)
        ) : null;
        const strokeColor = color ? Phaser.Display.Color.GetColor(color.r, color.g, color.b) : lineColor;

        this.lineGfx.lineStyle(width, strokeColor, 0.85 + tension * 0.15);
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
        this.bobber.setTint(stats.skinColor);
    }

    private applyRodSkin(): void {
        const services = getServices(this);
        this.rodSprite.setFrame(services.save.equipped.rod);
    }

    private shutdownScene(): void {
        this.fishing.removeAllListeners();
        this.env.destroy();
    }
}

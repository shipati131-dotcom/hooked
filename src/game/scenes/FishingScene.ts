import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_KEYS, DEPTH } from '../constants';
import { getServices } from '../core/services';
import { LocationRenderer, HORIZON_Y } from '../art/LocationRenderer';
import { generateFishTexture } from '../art/FishArt';
import { getLocation } from '../data/locations';
import { getEquipment } from '../data/equipment';
import { FishingSystem, type CastContext } from '../systems/FishingSystem';
import type { RolledFish } from '../systems/FishGenerator';
import type { CueEvent } from '../systems/fishing/BiteModel';
import type { FightSnapshot } from '../systems/fishing/FightModel';
import { CastMeter } from '../ui/CastMeter';
import { FightHud } from '../ui/FightHud';
import { FightView } from '../art/FightView';
import { CatchCard } from '../ui/CatchCard';
import { floatingText } from '../ui/FloatingText';
import { EVENTS, type CatchResult, type EscapeResult } from '../core/events';
import { listen } from '../core/listen';
import { BALANCE } from '../data/balance';
import { fishForLocation } from '../data/fish';
import { COLORS } from '../ui/theme';
import { MECHANIC_HINTS } from '../data/fishBehaviors';

// The rod is completely static -- one fixed pose (angled to read as nearly
// vertical) at one fixed position, close to the left edge. It never rotates,
// bends, or slides on its own; it only bends toward the fish while fighting.
const ROD_FIXED_X = GAME_WIDTH * 0.25;
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
const ROD_ANCHOR_Y = GAME_HEIGHT - (1 - ROD_ATLAS_HANDLE_ORIGIN.y) * ROD_DISPLAY_H;
const ROD_TIP_LOCAL = { length: 623, angleDeg: -44.4 };
const ROD_TIP_SCALE_X = ROD_DISPLAY_W / ROD_ATLAS_CELL;
const ROD_TIP_SCALE_Y = ROD_DISPLAY_H / ROD_ATLAS_CELL;
const CAST_Y = HORIZON_Y + 130;
const AIM_MIN_X = ROD_FIXED_X + 60;
const AIM_MAX_X = GAME_WIDTH - 100;
const CAST_METER_X = ROD_FIXED_X + 210;
const CAST_METER_Y = 330;
const FIGHT_REF_X = GAME_WIDTH * 0.6;
const FIGHT_HUD_X = GAME_WIDTH / 2;
const FIGHT_HUD_Y = GAME_HEIGHT - 118;
// The bobber-art source image is 160x237; this scale renders it at a size
// that's actually readable on the water instead of a near-invisible speck.
const BOBBER_SCALE = 0.22;
const SWIPE_THRESHOLD_PX = 28;

export class FishingScene extends Phaser.Scene {
    private env!: LocationRenderer;
    private fishing = new FishingSystem();
    private catchCard!: CatchCard;
    private castMeter!: CastMeter;
    private fightHud!: FightHud;
    private fightView!: FightView;

    private rodSprite!: Phaser.GameObjects.Image;
    private lineGfx!: Phaser.GameObjects.Graphics;
    private reticleGfx!: Phaser.GameObjects.Graphics;
    private hotspotGfx!: Phaser.GameObjects.Graphics;
    private bobber!: Phaser.GameObjects.Image;
    private promptText!: Phaser.GameObjects.Text;
    private hugeBanner!: Phaser.GameObjects.Text;

    private bobberX = GAME_WIDTH * 0.5;
    private bobberY = CAST_Y;
    private aimX = GAME_WIDTH * 0.55;
    private downX = 0;
    private downY = 0;
    private isPointerDown = false;
    private reelKeyDown = false;
    private keyboardSteer = 0;
    private resultCardOpen = false;
    private rodTipX = 0;
    private rodTipY = 0;
    private rodBendAngle = 0;
    private reelSoundTimer = 0;
    private animTime = 0;

    constructor() { super(SCENE_KEYS.FISHING); }

    create(): void {
        const services = getServices(this);
        const loc = getLocation(services.save.currentLocation);

        this.env = new LocationRenderer(this);
        this.env.build(loc);

        for (const f of fishForLocation(loc.id)) {
            generateFishTexture(this, `fish-${f.id}`, f.art);
        }

        this.rodSprite = this.add.image(ROD_FIXED_X, ROD_ANCHOR_Y, 'equipment-rod')
            .setOrigin(ROD_ATLAS_HANDLE_ORIGIN.x, ROD_ATLAS_HANDLE_ORIGIN.y)
            .setDisplaySize(ROD_DISPLAY_W, ROD_DISPLAY_H)
            .setAngle(ROD_ANGLE_DEG)
            .setDepth(DEPTH.ROD);
        this.applyRodSkin();

        this.hotspotGfx = this.add.graphics().setDepth(DEPTH.WATER + 1);
        this.reticleGfx = this.add.graphics().setDepth(DEPTH.WATER + 2);
        this.lineGfx = this.add.graphics().setDepth(DEPTH.LINE);
        this.bobber = this.add.image(this.bobberX, this.bobberY, 'bobber-art')
            .setScale(BOBBER_SCALE).setDepth(DEPTH.BOBBER).setVisible(false);
        this.applyBobberSkin();

        this.castMeter = new CastMeter(this, CAST_METER_X, CAST_METER_Y);
        this.fightHud = new FightHud(this, FIGHT_HUD_X, FIGHT_HUD_Y);
        this.fightView = new FightView(this, FIGHT_REF_X, CAST_Y);
        this.catchCard = new CatchCard(this);

        this.promptText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.78, 'Hold on the water to aim, release to cast', {
            fontFamily: 'Nunito, sans-serif', fontSize: '24px', color: '#f4e8cf', fontStyle: '700',
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
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p.x, p.y));
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p.x));
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p.x, p.y));
        this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onPointerUp(p.x, p.y));

        const kb = this.input.keyboard;
        const space = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        space?.on('down', () => this.onSpaceDown());
        space?.on('up', () => this.onSpaceUp());

        const left = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        const right = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        const a = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        const d = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        left?.on('down', () => this.onDirectionKey(-1));
        a?.on('down', () => this.onDirectionKey(-1));
        right?.on('down', () => this.onDirectionKey(1));
        d?.on('down', () => this.onDirectionKey(1));
        [left, right, a, d].forEach(k => k?.on('up', () => { this.keyboardSteer = 0; }));

        // Development-only shortcut used by the visual QA loop: skips straight
        // to the fight against whatever fish rolls. Removed from production
        // builds and never changes normal player controls.
        if (import.meta.env.DEV) {
            this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
                if (this.fishing.state !== 'idle') return;
                const services = getServices(this);
                this.fishing.beginAim(this.buildCastContext(services));
                this.fishing.update(16, false);
                this.fishing.releaseCast(GAME_WIDTH * 0.5 - ROD_FIXED_X);
                this.fishing.onSplashLanded();
                for (let i = 0; i < 3000 && (this.fishing.state as string) === 'waiting'; i++) this.fishing.update(16, false);
                for (let i = 0; i < 3000 && (this.fishing.state as string) === 'bite' && !this.fishing.isInStrikeWindow(); i++) this.fishing.update(16, false);
                this.fishing.strike(null);
            });
        }
    }

    private onPointerDown(x: number, y: number): void {
        if (y > GAME_HEIGHT - 70) return; // ignore the bottom nav strip
        this.isPointerDown = true;
        this.downX = x; this.downY = y;
        if (this.resultCardOpen) return;
        const services = getServices(this);

        switch (this.fishing.state) {
            case 'idle':
                this.promptText.setVisible(false);
                services.stats.recordCast();
                this.aimX = Phaser.Math.Clamp(x, AIM_MIN_X, AIM_MAX_X);
                this.fishing.beginAim(this.buildCastContext(services));
                services.audio.play('cast-charge');
                break;
            case 'waiting':
                this.fishing.cancelWait();
                this.onIdleReturn();
                break;
            default:
                break; // 'bite' resolves on pointerup (swipe detection); 'fighting' uses hold state directly
        }
    }

    private onPointerMove(x: number): void {
        if (this.fishing.state === 'aiming') this.aimX = Phaser.Math.Clamp(x, AIM_MIN_X, AIM_MAX_X);
    }

    private onPointerUp(x: number, y: number): void {
        this.isPointerDown = false;
        if (this.fishing.state === 'aiming') {
            this.fishing.releaseCast(this.aimX - ROD_FIXED_X);
            return;
        }
        if (this.fishing.state === 'bite') {
            const dx = x - this.downX, dy = y - this.downY;
            const dir = Math.hypot(dx, dy) > SWIPE_THRESHOLD_PX ? (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dx >= 0 ? 1 : -1)) as -1 | 1 : null;
            this.fishing.strike(dir);
        }
    }

    private onSpaceDown(): void {
        if (this.resultCardOpen) return;
        const services = getServices(this);
        switch (this.fishing.state) {
            case 'idle':
                services.stats.recordCast();
                this.fishing.beginAim(this.buildCastContext(services));
                services.audio.play('cast-charge');
                break;
            case 'waiting':
                this.fishing.cancelWait();
                this.onIdleReturn();
                break;
            case 'bite':
                this.fishing.strike(null);
                break;
            case 'fighting':
                this.reelKeyDown = true;
                break;
            default:
                break;
        }
    }

    private onSpaceUp(): void {
        if (this.fishing.state === 'aiming') this.fishing.releaseCast(this.aimX - ROD_FIXED_X);
        this.reelKeyDown = false;
    }

    private onDirectionKey(dir: -1 | 1): void {
        switch (this.fishing.state) {
            case 'aiming': this.aimX = Phaser.Math.Clamp(this.aimX + dir * 40, AIM_MIN_X, AIM_MAX_X); break;
            case 'bite': this.fishing.strike(dir); break;
            case 'fighting': this.keyboardSteer = dir; break;
            default: break;
        }
    }

    private getSteer(): number {
        if (this.keyboardSteer !== 0) return this.keyboardSteer;
        const px = this.input.activePointer.x;
        return Phaser.Math.Clamp((px - GAME_WIDTH / 2) / (GAME_WIDTH * 0.35), -1, 1);
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

    private splash(x: number, y: number, big = false): void {
        const burst = this.add.particles(x, y, 'particle-dot', {
            speed: { min: 60, max: big ? 260 : 180 }, angle: { min: 250, max: 290 }, lifespan: 420,
            scale: { start: big ? 2 : 1.4, end: 0 }, alpha: { start: 0.9, end: 0 }, quantity: big ? 22 : 14, tint: 0xdfeef2
        }).setDepth(DEPTH.PARTICLES);
        this.time.delayedCall(500, () => burst.destroy());

        for (let i = 0; i < 2; i++) {
            const ring = this.add.image(x, y, 'ripple-ring').setDepth(DEPTH.WATER + 3).setScale(0.2).setAlpha(0.8);
            this.tweens.add({
                targets: ring, scale: (big ? 3 : 2.2) + i * 0.6, alpha: 0, duration: 700 + i * 200, delay: i * 120, ease: 'Cubic.easeOut',
                onComplete: () => ring.destroy()
            });
        }
        this.cameras.main.shake(big ? 160 : 90, big ? 0.006 : 0.003);
    }

    private onIdleReturn(): void {
        this.bobber.setVisible(false);
        this.castMeter.hide();
        this.promptText.setText('Hold on the water to aim, release to cast').setColor('#f4e8cf').setVisible(true).setAlpha(0.85);
    }

    // ---------------------------------------------------------------- fishing system events

    private bindFishingEvents(services: ReturnType<typeof getServices>): void {
        this.fishing.on('cast', (...args: unknown[]) => {
            const payload = args[0] as { resolution: import('../systems/fishing/CastModel').CastResolution };
            this.onCastReleased(services, payload.resolution);
        });

        this.fishing.on('biteCue', (...args: unknown[]) => this.onBiteCue(services, args[0] as CueEvent));

        this.fishing.on('huge', () => this.showHugeBanner());

        this.fishing.on('bite', () => {
            this.promptText.setVisible(false);
        });

        this.fishing.on('biteWarning', () => {
            floatingText(this, this.bobberX, this.bobberY - 60, 'Too early — wait for the real bite!', '#ffd2a0', 20);
        });

        this.fishing.on('spooked', () => {
            services.audio.play('escape');
            floatingText(this, this.bobberX, this.bobberY - 40, 'Spooked!', '#e8a08c', 26);
            this.onIdleReturn();
        });

        this.fishing.on('wrongHook', () => {
            services.audio.play('escape');
            floatingText(this, this.bobberX, this.bobberY - 40, 'Wrong direction — it got away!', '#e8a08c', 24);
            this.onIdleReturn();
        });

        this.fishing.on('hookSet', (...args: unknown[]) => {
            const { solid } = args[0] as { solid: boolean };
            services.audio.play('hook-set');
            this.cameras.main.shake(solid ? 140 : 90, solid ? 0.005 : 0.003);
        });

        this.fishing.on('fightStart', (...args: unknown[]) => {
            const rolled = args[0] as RolledFish;
            this.bobber.setVisible(false);
            this.promptText.setVisible(false);
            const key = `fish-${rolled.fish.id}`;
            generateFishTexture(this, key, rolled.fish.art);
            this.fightHud.beginEncounter(rolled.fish.name, rolled.fish.rarity);
            this.fightView.beginEncounter(key, rolled.fish.rarity);
            this.showMechanicHintIfAny(services);
        });

        this.fishing.on('fightMove', (...args: unknown[]) => {
            const { move } = args[0] as { move: string };
            if (move === 'run' || move === 'dive') services.audio.play('fish-run');
            else if (move === 'thrash' || move === 'frenzy') services.audio.play('line-strain');
        });

        this.fishing.on('phaseChange', (...args: unknown[]) => {
            const { label } = args[0] as { label: string };
            services.audio.play('phase');
            this.showHugeBanner(label);
        });

        this.fishing.on('fishJump', () => {
            services.audio.play('fish-jump');
        });

        this.fishing.on('reelSuccess', (...args: unknown[]) => {
            const payload = args[0] as { rolled: RolledFish; isHuge: boolean; perfect: boolean };
            this.resolveCatch(services, payload.rolled, payload.perfect);
        });

        this.fishing.on('reelFail', (...args: unknown[]) => {
            const payload = args[0] as { rolled: RolledFish; lineSnapped: boolean; hookThrown: boolean; meter: number };
            this.resolveEscape(services, payload.rolled, payload.lineSnapped, payload.hookThrown, payload.meter);
        });

        this.fishing.on('missedHook', () => {
            floatingText(this, this.bobberX, this.bobberY - 40, 'It stole the bait!', '#e8a08c', 24);
            this.onIdleReturn();
        });
    }

    private showMechanicHintIfAny(services: ReturnType<typeof getServices>): void {
        const before = services.save.stats.totalCaught - 1;
        const after = services.save.stats.totalCaught;
        const key = this.fishing.mechanicUnlockedNow(Math.max(0, before), after) as keyof typeof MECHANIC_HINTS | null;
        if (key && MECHANIC_HINTS[key]) {
            floatingText(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.3, MECHANIC_HINTS[key], '#fff0bd', 20);
        }
    }

    private onCastReleased(services: ReturnType<typeof getServices>, resolution: import('../systems/fishing/CastModel').CastResolution): void {
        this.castMeter.hide();
        const targetX = Phaser.Math.Clamp(ROD_FIXED_X + resolution.landDistPx, AIM_MIN_X, AIM_MAX_X);
        services.audio.play('cast');
        if (resolution.hitHotspot) services.audio.play('hotspot');
        else if (resolution.quality === 'perfect') services.audio.play('cast-perfect');

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
                const x = Phaser.Math.Linear(startX, targetX, t);
                const arcHeight = 160 * Math.sin(Math.PI * t);
                const y = Phaser.Math.Linear(startY, CAST_Y, t) - arcHeight;
                this.bobberX = x; this.bobberY = y;
                this.bobber.setPosition(x, y);
            },
            onComplete: () => {
                this.bobberY = CAST_Y;
                this.bobber.setPosition(targetX, CAST_Y);
                this.splash(targetX, CAST_Y);
                services.audio.play('splash');
                const label = resolution.quality === 'perfect' ? 'PERFECT CAST!'
                    : resolution.hitHotspot ? (resolution.hitGoldenHotspot ? 'GOLDEN HOTSPOT!' : 'HOTSPOT!')
                        : resolution.quality === 'outOfReach' ? 'Out of reach' : resolution.quality === 'short' ? 'Short cast' : resolution.quality === 'long' ? 'Overshot' : '';
                if (label) floatingText(this, targetX, CAST_Y - 40, label, resolution.quality === 'perfect' || resolution.hitHotspot ? '#ffe17a' : '#c9d8dc', 20);
                this.fishing.onSplashLanded();
            }
        });
    }

    private onBiteCue(services: ReturnType<typeof getServices>, cue: CueEvent): void {
        switch (cue.kind) {
            case 'nibble':
                services.audio.play('nibble');
                this.tweens.add({ targets: this.bobber, y: '+=10', duration: 90, yoyo: true, ease: 'Sine.easeOut' });
                break;
            case 'tug':
                services.audio.play('tug');
                this.tweens.add({ targets: this.bobber, y: '+=18', x: `+=${cue.dir * 6}`, duration: 120, yoyo: true, ease: 'Sine.easeInOut' });
                break;
            case 'drag':
                services.audio.play('drag');
                this.tweens.add({ targets: this.bobber, x: this.bobberX + cue.dir * 60, duration: cue.durationMs, ease: 'Sine.easeInOut' });
                break;
            case 'falsePlunge':
                services.audio.play('nibble');
                this.tweens.add({
                    targets: this.bobber, y: '+=30', duration: cue.durationMs / 2, ease: 'Sine.easeIn', yoyo: true
                });
                floatingText(this, this.bobberX, this.bobberY - 40, '?', '#c9d8dc', 30);
                break;
            case 'plunge': {
                services.audio.play('bite');
                this.cameras.main.shake(160, 0.006);
                this.tweens.add({ targets: this.bobber, y: '+=26', duration: 140, ease: 'Sine.easeIn', yoyo: true });
                this.tweens.add({
                    targets: this.bobber, scaleY: BOBBER_SCALE * 0.545, scaleX: BOBBER_SCALE * 1.34, duration: 90, ease: 'Sine.easeOut',
                    onComplete: () => this.tweens.add({ targets: this.bobber, scaleY: BOBBER_SCALE, scaleX: BOBBER_SCALE, duration: 220, ease: 'Elastic.easeOut', easeParams: [1, 0.6] })
                });
                const arrow = cue.dir > 0 ? '→' : '←';
                floatingText(this, this.bobberX, this.bobberY - 60, `${arrow} STRIKE! ${arrow}`, '#f5c451', 40);
                this.promptText.setText('SWIPE AGAINST THE PULL TO STRIKE!').setColor('#ffe17a').setVisible(true).setAlpha(1);
                if (cue.heavy) this.splash(this.bobberX, this.bobberY, true);
                break;
            }
        }
    }

    private showHugeBanner(text = 'Something HUGE is on the line!'): void {
        this.hugeBanner.setText(text);
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

        this.splash(this.fightView.lineTarget().x, this.fightView.lineTarget().y, true);
        services.audio.play('splash-big');
        this.fightHud.endEncounter();
        this.fightView.endEncounter();

        this.resultCardOpen = true;
        this.catchCard.show(result, `fish-${rolled.fish.id}`, () => {
            this.resultCardOpen = false;
            this.catchCard.hide();
            services.finalizeCatch(result);
            this.onIdleReturn();
        });
    }

    private resolveEscape(services: ReturnType<typeof getServices>, rolled: RolledFish, lineSnapped: boolean, hookThrown: boolean, meter: number): void {
        services.stats.recordEscape({ fish: rolled.fish, meterAtEscape: meter } as EscapeResult);
        services.audio.play(lineSnapped ? 'line-snap' : 'escape');
        this.fightHud.endEncounter();
        this.fightView.endEncounter();
        this.cameras.main.shake(180, 0.007);
        const pct = Math.round(meter * 100);
        const message = lineSnapped ? 'The line snapped!' : hookThrown ? 'It threw the hook!' : `It got away… (so close: ${pct}%)`;
        floatingText(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.4, message, '#e8a08c', 26);
        this.onIdleReturn();
        services.requestSave();
    }

    // ---------------------------------------------------------------- per-frame

    private onUpdate(dt: number): void {
        this.env.update(dt);
        this.animTime += dt / 1000;
        const holding = this.isPointerDown || this.reelKeyDown;
        const steer = this.getSteer();
        this.fishing.update(dt, holding, steer);

        if (this.fishing.state === 'aiming') {
            this.updateAiming();
        } else {
            this.castMeter.hide();
        }
        this.hotspotGfx.clear();
        if (this.fishing.state === 'idle' || this.fishing.state === 'aiming') this.drawHotspots();
        if (this.fishing.state !== 'aiming') this.reticleGfx.clear();

        if (this.fishing.state === 'fighting') {
            const snap = this.fishing.fightSnapshot();
            if (snap) {
                this.fightHud.update(snap);
                this.fightView.update(snap);
                this.updateRodBend(snap);
                this.reelSoundTimer += dt;
                if (holding && this.reelSoundTimer >= 220) {
                    this.reelSoundTimer = 0;
                    getServices(this).audio.play('reel-crank');
                }
            }
        } else {
            this.reelSoundTimer = 0;
            this.rodBendAngle = Phaser.Math.Linear(this.rodBendAngle, 0, 0.15);
        }

        this.drawRod();
        this.drawLine();
    }

    private updateAiming(): void {
        const targetDistPx = this.aimX - ROD_FIXED_X;
        const sweet = this.fishing.sweetHalfWidthFor(targetDistPx);
        const outOfReach = !sweet || sweet.center > 1;
        this.castMeter.showAt(CAST_METER_X, CAST_METER_Y);
        this.castMeter.update(this.fishing.getCastPower(), sweet?.center ?? 0, sweet?.half ?? 0.1, outOfReach);

        this.reticleGfx.clear();
        const color = outOfReach ? COLORS.danger : COLORS.gold;
        this.reticleGfx.lineStyle(3, color, 0.85);
        this.reticleGfx.strokeCircle(this.aimX, CAST_Y, 16 + Math.sin(this.animTime * 6) * 3);
        this.reticleGfx.fillStyle(color, 0.25);
        this.reticleGfx.fillCircle(this.aimX, CAST_Y, 10);
    }

    private drawHotspots(): void {
        for (const h of this.fishing.getHotspots()) {
            const x = ROD_FIXED_X + h.distPx;
            const pulse = 0.5 + Math.sin(this.animTime * 2.4 + h.distPx) * 0.5;
            this.hotspotGfx.lineStyle(2, h.golden ? COLORS.gold : 0x8fe0e8, 0.35 + pulse * 0.35);
            this.hotspotGfx.strokeCircle(x, CAST_Y, 50 + pulse * 14);
            this.hotspotGfx.fillStyle(h.golden ? COLORS.gold : 0x8fe0e8, 0.06 + pulse * 0.05);
            this.hotspotGfx.fillCircle(x, CAST_Y, 50);
        }
    }

    /** The rod bends toward the fish while fighting: angle tracks tension and steer. */
    private updateRodBend(snap: FightSnapshot): void {
        const tensionBend = snap.tension * 14;
        const steerBend = this.getSteer() * 6;
        const shake = snap.tensionZone === 'redline' ? Math.sin(this.animTime * 30) * 2.5 : 0;
        const target = tensionBend + steerBend + shake;
        this.rodBendAngle = Phaser.Math.Linear(this.rodBendAngle, target, 0.2);
    }

    private drawRod(): void {
        const activeAngle = ROD_ANGLE_DEG + this.rodBendAngle;
        this.rodSprite.setPosition(ROD_FIXED_X, ROD_ANCHOR_Y).setAngle(activeAngle);

        const scalePulse = this.fishing.state === 'fighting' ? 1 + Math.sin(this.animTime * 5.0) * 0.006 : 1;
        this.rodSprite.setDisplaySize(ROD_DISPLAY_W * scalePulse, ROD_DISPLAY_H * scalePulse);

        // ROD_TIP_LOCAL is the tip's offset from the handle at zero sprite
        // rotation; rotating the sprite by `activeAngle` rotates that same
        // vector, so the tip offset's total angle is just the two summed.
        const totalRad = Phaser.Math.DegToRad(ROD_TIP_LOCAL.angleDeg + activeAngle);
        this.rodTipX = this.rodSprite.x + Math.cos(totalRad) * ROD_TIP_LOCAL.length * ROD_TIP_SCALE_X * scalePulse;
        this.rodTipY = this.rodSprite.y + Math.sin(totalRad) * ROD_TIP_LOCAL.length * ROD_TIP_SCALE_Y * scalePulse;
    }

    private drawLine(): void {
        this.lineGfx.clear();
        const fighting = this.fishing.state === 'fighting';
        const targetVisible = this.bobber.visible || fighting;
        if (!targetVisible) return;
        const target = fighting ? this.fightView.lineTarget() : { x: this.bobberX, y: this.bobberY };

        const services = getServices(this);
        const lineColor = services.equipment.getLoadout().line.color;
        const snap = fighting ? this.fishing.fightSnapshot() : null;
        const tension = snap ? snap.tension : 0;

        const wobble = Math.sin(this.time.now * 0.02) * 5 * (1 - tension) * (fighting ? 1 : 0.4);
        const width = 2 + tension * 2.5;
        const color = tension > 0 ? Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(lineColor), Phaser.Display.Color.ValueToColor(COLORS.danger), 100, Math.round(Math.min(1, tension) * 100)
        ) : null;
        const strokeColor = color ? Phaser.Display.Color.GetColor(color.r, color.g, color.b) : lineColor;

        this.lineGfx.lineStyle(width, strokeColor, 0.85 + Math.min(1, tension) * 0.15);
        this.lineGfx.beginPath();
        this.lineGfx.moveTo(this.rodTipX, this.rodTipY);
        this.lineGfx.lineTo((this.rodTipX + target.x) / 2 + wobble, (this.rodTipY + target.y) / 2);
        this.lineGfx.lineTo(target.x, target.y);
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
        this.fightView.destroy();
        this.env.destroy();
    }
}

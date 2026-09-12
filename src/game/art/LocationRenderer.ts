import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import type { LocationDef } from '../data/types';
import { generatePropTexture } from './PropArt';

const HORIZON_Y = GAME_HEIGHT * 0.36;

/** Locations with a looping video backdrop instead of a static painted key image. */
export const LOCATIONS_WITH_VIDEO = new Set<string>([
    'pond', 'lake', 'river', 'swamp', 'coast', 'ocean', 'fjord', 'volcano', 'abyss'
]);

/**
 * Fully data-driven environment renderer: reads a LocationDef's palette and
 * prop list and builds a distinct-looking scene from a small shared set of
 * primitives. Adding a new location to data/locations.ts needs no new code here.
 */
export class LocationRenderer {
    private objects: Phaser.GameObjects.GameObject[] = [];
    private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    private waterTiles: Phaser.GameObjects.TileSprite[] = [];
    private timers: Phaser.Time.TimerEvent[] = [];
    private time = 0;
    private waterBandY = 0;

    constructor(private scene: Phaser.Scene) {}

    build(loc: LocationDef): void {
        this.clear();
        const videoKey = `location-${loc.id}-video`;
        const artworkKey = `location-${loc.id}`;
        if (LOCATIONS_WITH_VIDEO.has(loc.id) && this.scene.cache.video.exists(videoKey)) {
            this.buildVideoArtwork(loc, videoKey);
        } else if (this.scene.textures.exists(artworkKey)) {
            this.buildArtwork(loc, artworkKey);
        } else {
            // Development fallback if an external asset fails to load.
            this.buildSky(loc);
            this.buildWater(loc);
            this.buildProps(loc);
        }
        this.buildAmbience(loc);
    }

    private buildArtwork(loc: LocationDef, key: string): void {
        const art = this.scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key)
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setDepth(DEPTH.BG_FAR);
        this.objects.push(art);
        this.buildLiveWaterOverlay(loc);
    }

    /** Same full-screen backdrop treatment as buildArtwork, but backed by a
     *  looping muted video instead of a static painted key image. */
    private buildVideoArtwork(loc: LocationDef, key: string): void {
        const video = this.scene.add.video(GAME_WIDTH / 2, GAME_HEIGHT / 2, key)
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setDepth(DEPTH.BG_FAR)
            .setMute(true);
        // The video's real dimensions aren't known until its metadata loads, so an
        // immediate setDisplaySize() can lock in a stale (tiny) native size and the
        // video renders wildly oversized once real data arrives. Re-applying the
        // size once Phaser's 'created' event fires (real dimensions known) fixes it.
        video.on('created', () => video.setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
        video.play(true);
        this.objects.push(video);
        this.buildLiveWaterOverlay(loc);
    }

    /** Retain just enough live water to make the key art breathe. The low-opacity
     *  bands move in opposite directions and never obscure the authored reflections
     *  (or video) beneath them. */
    private buildLiveWaterOverlay(loc: LocationDef): void {
        for (let i = 0; i < 2; i++) {
            const ts = this.scene.add.tileSprite(
                GAME_WIDTH / 2, HORIZON_Y + 42 + i * 118, GAME_WIDTH, 52, 'water-tile'
            ).setOrigin(0.5, 0).setDepth(DEPTH.WATER + 2)
                .setAlpha(i === 0 ? 0.07 : 0.045)
                .setTint(loc.palette.accent)
                .setBlendMode(Phaser.BlendModes.ADD);
            ts.setData('baseAlpha', i === 0 ? 0.07 : 0.045);
            this.waterTiles.push(ts);
            this.objects.push(ts);
        }

        this.waterBandY = HORIZON_Y;
        this.buildWaterLife(loc);
    }

    private buildSky(loc: LocationDef): void {
        const key = `sky-${loc.id}`;
        if (!this.scene.textures.exists(key)) {
            const g = this.scene.make.graphics({ x: 0, y: 0 });
            drawVerticalGradient(g, 0, 0, GAME_WIDTH, HORIZON_Y, loc.palette.sky[0], loc.palette.sky[1], 40);
            g.generateTexture(key, GAME_WIDTH, HORIZON_Y);
            g.destroy();
        }
        const sky = this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.BG_FAR);
        this.objects.push(sky);

        // faint sun/moon glow near the horizon
        const glow = this.scene.add.circle(GAME_WIDTH * 0.78, HORIZON_Y * 0.55, 70, loc.palette.accent, 0.25).setDepth(DEPTH.BG_FAR + 1);
        this.objects.push(glow);
    }

    private buildWater(loc: LocationDef): void {
        const key = `water-${loc.id}`;
        if (!this.scene.textures.exists(key)) {
            const g = this.scene.make.graphics({ x: 0, y: 0 });
            const h = GAME_HEIGHT - HORIZON_Y;
            drawVerticalGradient(g, 0, 0, GAME_WIDTH, h, loc.palette.water[0], loc.palette.water[1], 50);
            g.generateTexture(key, GAME_WIDTH, h);
            g.destroy();
        }
        const water = this.scene.add.image(0, HORIZON_Y, key).setOrigin(0, 0).setDepth(DEPTH.WATER);
        this.objects.push(water);

        // fog band softening the horizon line
        const fog = this.scene.add.rectangle(GAME_WIDTH / 2, HORIZON_Y, GAME_WIDTH, 60, loc.palette.fog, 0.35).setDepth(DEPTH.WATER + 1);
        this.objects.push(fog);

        // two scrolling shimmer strips for a gentle "living water" feel
        for (let i = 0; i < 2; i++) {
            const ts = this.scene.add.tileSprite(
                GAME_WIDTH / 2, HORIZON_Y + 40 + i * 90, GAME_WIDTH, 60, 'water-tile'
            ).setOrigin(0.5, 0).setDepth(DEPTH.WATER + 2).setAlpha(0.14 - i * 0.03).setTint(loc.palette.accent);
            ts.setBlendMode(Phaser.BlendModes.ADD);
            ts.setData('baseAlpha', 0.14 - i * 0.03);
            this.waterTiles.push(ts);
            this.objects.push(ts);
        }

        this.waterBandY = HORIZON_Y;
        this.buildWaterLife(loc);
    }

    /** Small ambient life so the water never reads as a flat rectangle: occasional
     *  ripple rings drifting across the surface, and tiny sunlit highlight glints. */
    private buildWaterLife(loc: LocationDef): void {
        const spawnRipple = () => {
            const rx = Phaser.Math.Between(60, GAME_WIDTH - 60);
            const ry = Phaser.Math.Between(this.waterBandY + 30, GAME_HEIGHT - 60);
            const ring = this.scene.add.image(rx, ry, 'ripple-ring')
                .setDepth(DEPTH.WATER + 2).setScale(0.05).setAlpha(0).setTint(loc.palette.accent);
            this.objects.push(ring);
            this.scene.tweens.add({ targets: ring, alpha: 0.22, duration: 260, ease: 'Sine.easeOut' });
            this.scene.tweens.add({
                targets: ring, scale: Phaser.Math.FloatBetween(0.35, 0.6), alpha: 0, duration: 2400, ease: 'Sine.easeOut',
                onComplete: () => { ring.destroy(); this.objects = this.objects.filter(o => o !== ring); }
            });
        };
        const rippleTimer = this.scene.time.addEvent({
            delay: 2600, startAt: Phaser.Math.Between(0, 2000), loop: true,
            callback: () => { if (Phaser.Math.Between(0, 100) < 70) spawnRipple(); }
        });
        this.timers.push(rippleTimer);

        const glints = this.scene.add.particles(0, 0, 'particle-spark', {
            x: { min: 0, max: GAME_WIDTH }, y: { min: this.waterBandY + 20, max: GAME_HEIGHT - 40 },
            lifespan: 2600, speedX: { min: -4, max: 4 }, speedY: { min: -2, max: 2 },
            scale: { start: 0.5, end: 0 }, alpha: { start: 0.5, end: 0 },
            tint: 0xffffff, frequency: 700, quantity: 1
        }).setDepth(DEPTH.WATER + 2).setBlendMode(Phaser.BlendModes.ADD);
        this.emitters.push(glints);
        this.objects.push(glints);
    }

    private buildProps(loc: LocationDef): void {
        const rnd = new Phaser.Math.RandomDataGenerator([loc.id]);
        for (const prop of loc.props) {
            if (prop === 'fireflies' || prop === 'aurora' || prop === 'stars') continue; // ambience, not sprites
            const key = generatePropTexture(this.scene, prop);
            const count = prop === 'dock' ? 1 : prop === 'pine' ? 5 : 4;
            for (let i = 0; i < count; i++) {
                const isBackground = prop === 'pine';
                const x = prop === 'dock' ? GAME_WIDTH * 0.16 : rnd.between(40, GAME_WIDTH - 40);
                const yBase = isBackground ? HORIZON_Y - rnd.between(0, 10) : HORIZON_Y + rnd.between(-6, 30);
                const img = this.scene.add.image(x, yBase, key)
                    .setDepth(isBackground ? DEPTH.BG_MID : (i % 2 === 0 ? DEPTH.PROPS_BACK : DEPTH.PROPS_FRONT))
                    .setOrigin(0.5, 1)
                    .setScale(rnd.realInRange(0.8, 1.15));
                if (isBackground) img.setAlpha(0.85).setTint(0x9fb0a8);
                
                if (['reeds', 'palm', 'pine'].includes(prop)) {
                    this.scene.tweens.add({
                        targets: img,
                        angle: rnd.realInRange(2, 4) * (rnd.pick([-1, 1])),
                        duration: rnd.between(2000, 4000),
                        delay: rnd.between(0, 2000),
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.inOut'
                    });
                }
                
                this.objects.push(img);
            }
        }
    }

    private buildAmbience(loc: LocationDef): void {
        const cloudRnd = new Phaser.Math.RandomDataGenerator([loc.id + 'clouds']);
        for (let i = 0; i < 3; i++) {
            const cloud = this.scene.add.ellipse(
                cloudRnd.between(0, GAME_WIDTH), 
                cloudRnd.between(HORIZON_Y * 0.1, HORIZON_Y * 0.7), 
                cloudRnd.between(200, 500), 
                cloudRnd.between(40, 90), 
                loc.palette.fog, 
                cloudRnd.realInRange(0.08, 0.15)
            ).setDepth(DEPTH.BG_FAR + 1);
            
            this.scene.tweens.add({
                targets: cloud,
                x: `+=${cloudRnd.between(100, 250)}`,
                duration: cloudRnd.between(30000, 60000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.inOut'
            });
            this.objects.push(cloud);
        }

        if (['pond', 'lake', 'swamp'].includes(loc.id)) {
            const leafTimer = this.scene.time.addEvent({
                delay: 4000,
                loop: true,
                callback: () => {
                    if (Phaser.Math.Between(0, 100) > 60) {
                        const startX = Phaser.Math.Between(0, 1) === 0 ? -10 : GAME_WIDTH + 10;
                        const endX = startX < 0 ? GAME_WIDTH + 20 : -20;
                        const y = Phaser.Math.Between(HORIZON_Y + 10, GAME_HEIGHT - 20);
                        const leaf = this.scene.add.rectangle(startX, y, 4, 2, loc.palette.fog, 0.6)
                            .setDepth(DEPTH.WATER + 3);
                        this.objects.push(leaf);
                        this.scene.tweens.add({
                            targets: leaf,
                            x: endX,
                            y: y + Phaser.Math.Between(-20, 20),
                            angle: Phaser.Math.Between(-180, 180),
                            duration: Phaser.Math.Between(15000, 25000),
                            onComplete: () => { leaf.destroy(); this.objects = this.objects.filter(o => o !== leaf); }
                        });
                    }
                }
            });
            this.timers.push(leafTimer);
        }

        // TimerEvent.delay is read-only in Phaser 4, so a randomized repeat interval
        // is done via a self-rescheduling one-shot timer rather than `loop: true`.
        const scheduleBird = () => {
            const birdTimer = this.scene.time.delayedCall(Phaser.Math.Between(8000, 15000), () => {
                spawnBird();
                scheduleBird();
            });
            this.timers.push(birdTimer);
        };
        const spawnBird = () => {
                const startX = Phaser.Math.Between(0, 1) === 0 ? -20 : GAME_WIDTH + 20;
                const endX = startX < 0 ? GAME_WIDTH + 50 : -50;
                const y = Phaser.Math.Between(HORIZON_Y * 0.2, HORIZON_Y * 0.6);
                
                const g = this.scene.add.graphics({ x: startX, y });
                g.lineStyle(2, 0x111111, 0.4);
                g.beginPath();
                g.moveTo(-6, -4);
                g.lineTo(0, 0);
                g.lineTo(6, -4);
                g.strokePath();
                g.setDepth(DEPTH.BG_FAR + 2);
                this.objects.push(g);
                
                this.scene.tweens.add({
                    targets: g,
                    scaleY: 0.2,
                    duration: 300,
                    yoyo: true,
                    repeat: -1
                });
                this.scene.tweens.add({
                    targets: g,
                    x: endX,
                    y: y + Phaser.Math.Between(-40, 40),
                    duration: Phaser.Math.Between(8000, 14000),
                    onComplete: () => { g.destroy(); this.objects = this.objects.filter(o => o !== g); }
                });
        };
        scheduleBird();

        if (['pond', 'lake', 'river', 'coast'].includes(loc.id)) {
            const rayRnd = new Phaser.Math.RandomDataGenerator([loc.id + 'rays']);
            for (let i = 0; i < 3; i++) {
                const ray = this.scene.add.rectangle(
                    rayRnd.between(100, GAME_WIDTH - 100),
                    HORIZON_Y * 0.5,
                    rayRnd.between(60, 150),
                    HORIZON_Y * 1.5,
                    0xffffff,
                    rayRnd.realInRange(0.02, 0.06)
                ).setAngle(rayRnd.between(15, 35))
                 .setDepth(DEPTH.BG_FAR + 2)
                 .setBlendMode(Phaser.BlendModes.ADD);
                
                this.scene.tweens.add({
                    targets: ray,
                    alpha: ray.alpha * 1.8,
                    duration: rayRnd.between(4000, 8000),
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.inOut'
                });
                this.objects.push(ray);
            }
        }

        if (loc.props.includes('fireflies')) {
            const emitter = this.scene.add.particles(0, 0, 'particle-spark', {
                x: { min: 0, max: GAME_WIDTH }, y: { min: HORIZON_Y - 40, max: HORIZON_Y + 120 },
                lifespan: 3500, speedY: { min: -8, max: 8 }, speedX: { min: -8, max: 8 },
                scale: { start: 0.6, end: 0.1 }, alpha: { start: 0.9, end: 0 },
                tint: 0xd7ff8a, frequency: 220, quantity: 1
            }).setDepth(DEPTH.PARTICLES);
            this.emitters.push(emitter);
            this.objects.push(emitter);
        }
        if (loc.props.includes('stars')) {
            const rnd = new Phaser.Math.RandomDataGenerator([loc.id + 'stars']);
            for (let i = 0; i < 40; i++) {
                const star = this.scene.add.circle(rnd.between(0, GAME_WIDTH), rnd.between(0, HORIZON_Y * 0.9), rnd.realInRange(0.6, 1.6), 0xffffff, rnd.realInRange(0.3, 0.9)).setDepth(DEPTH.BG_FAR + 1);
                this.scene.tweens.add({ targets: star, alpha: 0.1, duration: rnd.between(1200, 2600), yoyo: true, repeat: -1, delay: rnd.between(0, 2000) });
                this.objects.push(star);
            }
        }
        if (loc.props.includes('aurora')) {
            for (let i = 0; i < 3; i++) {
                const band = this.scene.add.ellipse(GAME_WIDTH * (0.2 + i * 0.3), HORIZON_Y * 0.4, 500, 90, i % 2 === 0 ? 0x6affea : 0xea6aff, 0.14)
                    .setDepth(DEPTH.BG_FAR + 1).setBlendMode(Phaser.BlendModes.ADD);
                this.scene.tweens.add({ targets: band, scaleX: 1.3, alpha: 0.22, duration: 3200 + i * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
                this.objects.push(band);
            }
        }
        if (loc.props.includes('lava')) {
            const emitter = this.scene.add.particles(0, 0, 'particle-spark', {
                x: { min: 0, max: GAME_WIDTH }, y: HORIZON_Y + 30,
                lifespan: 2200, speedY: { min: -50, max: -20 }, speedX: { min: -10, max: 10 },
                scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 },
                tint: 0xff8a2a, frequency: 260, quantity: 1
            }).setDepth(DEPTH.PARTICLES);
            this.emitters.push(emitter);
            this.objects.push(emitter);
        }
    }

    update(deltaMs: number): void {
        this.time += deltaMs;
        this.waterTiles.forEach((ts, i) => {
            ts.tilePositionX += deltaMs * 0.012 * (i === 0 ? 1 : -0.7);
            ts.tilePositionY = Math.sin(this.time * 0.0003 + i) * 2;
            
            ts.scaleY = 1.0 + Math.sin(this.time * 0.001 + i) * 0.05;
            
            const baseAlpha = ts.getData('baseAlpha');
            if (baseAlpha !== undefined) {
                ts.alpha = baseAlpha + Math.sin(this.time * 0.0008 + i * 2) * (baseAlpha * 0.3);
            }
        });
    }

    clear(): void {
        for (const t of this.timers) t.remove(false);
        for (const o of this.emitters) o.destroy();
        for (const o of this.objects) if (o.active !== false) o.destroy();
        this.objects = [];
        this.emitters = [];
        this.waterTiles = [];
        this.timers = [];
    }

    destroy(): void { this.clear(); }
}

function drawVerticalGradient(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, colorTop: number, colorBottom: number, steps: number): void {
    const top = Phaser.Display.Color.IntegerToColor(colorTop);
    const bottom = Phaser.Display.Color.IntegerToColor(colorBottom);
    const stepH = h / steps;
    for (let i = 0; i < steps; i++) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps, i);
        const color = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        g.fillStyle(color, 1);
        g.fillRect(x, y + i * stepH - 1, w, stepH + 2);
    }
}

export { HORIZON_Y };

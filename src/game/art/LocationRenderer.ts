import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import type { LocationDef } from '../data/types';
import { generatePropTexture } from './PropArt';

const HORIZON_Y = GAME_HEIGHT * 0.36;

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
        this.buildSky(loc);
        this.buildWater(loc);
        this.buildProps(loc);
        this.buildAmbience(loc);
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
                this.objects.push(img);
            }
        }
    }

    private buildAmbience(loc: LocationDef): void {
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

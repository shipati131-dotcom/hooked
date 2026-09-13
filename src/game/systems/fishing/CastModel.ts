import { BALANCE } from '../../data/balance';
import { clamp } from '../../utils/format';
import { Rng, rng as defaultRng } from '../../utils/rng';
import type { RodStats } from '../../data/types';

export type CastQuality = 'perfect' | 'good' | 'short' | 'long' | 'outOfReach';

export interface Hotspot {
    /** Distance from the rod along the cast axis, in pixels (0 = at the rod). */
    distPx: number;
    golden: boolean;
    ageSec: number;
}

export interface CastResolution {
    quality: CastQuality;
    /** Actual distance from the rod the bobber lands at, in pixels. */
    landDistPx: number;
    /** Extra additive luck this cast contributes (perfect-cast bonus + any hotspot landed on). */
    luckBonus: number;
    /** Multiplier applied to the fight's weight-skew roll (far casts favor bigger fish). */
    weightSkewReduction: number;
    /** Bite-speed multiplier if the bobber landed on a hotspot (1 = no change, <1 = faster bites). */
    biteSpeedMult: number;
    hitHotspot: boolean;
    hitGoldenHotspot: boolean;
}

/**
 * Pure aim + power-timing cast model. The scene drives a screen position; this
 * model only deals in a single "distance from the rod" scalar along the cast
 * axis, so it has no Phaser/pixel-layout dependency and is fully unit-testable.
 */
export class CastModel {
    private r: Rng;
    power = 0;
    private direction = 1; // 1 = rising, -1 = falling
    private hotspots: Hotspot[] = [];
    private hotspotClock = 0;

    constructor(r: Rng = defaultRng) {
        this.r = r;
        this.spawnHotspots();
    }

    private spawnHotspots(): void {
        const c = BALANCE.cast;
        this.hotspots = [];
        for (let i = 0; i < c.hotspotCount; i++) {
            this.hotspots.push({
                distPx: this.r.range(180, c.baseReachPx * 0.95),
                golden: this.r.chance(c.hotspotGoldenChance),
                ageSec: 0
            });
        }
    }

    /** Advance hotspot relocation timers. Call every frame regardless of aiming state. */
    tick(dtSec: number): void {
        const c = BALANCE.cast;
        this.hotspotClock += dtSec;
        for (const h of this.hotspots) h.ageSec += dtSec;
        if (this.hotspotClock >= c.hotspotRelocateSec) {
            this.hotspotClock = 0;
            this.spawnHotspots();
        }
    }

    getHotspots(): readonly Hotspot[] { return this.hotspots; }

    /** Reach (px) for this rod -- better rods cast further. */
    reachFor(rod: RodStats): number {
        return BALANCE.cast.baseReachPx + BALANCE.cast.reachPerPowerPoint * Math.max(0, rod.power - 1);
    }

    /** The power (0..1) needed to land exactly on `targetDistPx` with this rod's reach. */
    requiredPower(targetDistPx: number, rod: RodStats): number {
        return targetDistPx / this.reachFor(rod);
    }

    /** The sweet-band half-width (0..1 power units) this rod's control grants. */
    sweetHalfWidth(rod: RodStats): number {
        return clamp(BALANCE.cast.baseSweetWidth + rod.control * BALANCE.cast.controlWidthPerPoint, 0.05, 0.4) / 2;
    }

    /** Begin charging: power starts at 0, rising. */
    startCharge(): void {
        this.power = 0;
        this.direction = 1;
    }

    /** Advance the ping-pong power needle while the player holds. */
    updateCharge(dtSec: number): void {
        const speed = (1 / BALANCE.cast.needleCycleSec) * 2; // full 0-1-0 sweep per cycle
        this.power += this.direction * speed * dtSec;
        if (this.power >= 1) { this.power = 1; this.direction = -1; }
        else if (this.power <= 0) { this.power = 0; this.direction = 1; }
    }

    /** Release at the current power toward a target distance. Returns the resolved cast. */
    release(targetDistPx: number, rod: RodStats): CastResolution {
        const c = BALANCE.cast;
        const reach = this.reachFor(rod);
        const required = this.requiredPower(targetDistPx, rod);
        const half = this.sweetHalfWidth(rod);
        const p = this.power;
        const landDistPx = clamp(p, 0, 1) * reach;

        let quality: CastQuality;
        let luckMult = 1;
        if (required > 1) {
            quality = 'outOfReach';
            luckMult = c.overshootPenalty;
        } else {
            const error = p - required;
            if (Math.abs(error) <= c.perfectWidth) quality = 'perfect';
            else if (Math.abs(error) <= half) quality = 'good';
            else if (error < 0) { quality = 'short'; luckMult = c.shortCastPenalty; }
            else { quality = 'long'; luckMult = c.overshootPenalty; }
        }

        const { hit, golden } = this.checkHotspot(landDistPx);
        let luckBonus = 0;
        if (quality === 'perfect') luckBonus += c.perfectCastLuck;
        if (hit) luckBonus += golden ? c.hotspotGoldenLuck : c.hotspotShimmerLuck;
        luckBonus *= luckMult;

        const farProgress = clamp(landDistPx / c.farCastWeightBonusMaxPx, 0, 1);
        const weightSkewReduction = c.farCastWeightSkewReduction * farProgress;

        return {
            quality,
            landDistPx,
            luckBonus,
            weightSkewReduction,
            biteSpeedMult: hit ? c.hotspotShimmerBiteSpeedMult : 1,
            hitHotspot: hit,
            hitGoldenHotspot: hit && golden
        };
    }

    private checkHotspot(landDistPx: number): { hit: boolean; golden: boolean } {
        const c = BALANCE.cast;
        for (const h of this.hotspots) {
            if (Math.abs(h.distPx - landDistPx) <= c.hotspotRadiusPx) {
                return { hit: true, golden: h.golden };
            }
        }
        return { hit: false, golden: false };
    }
}

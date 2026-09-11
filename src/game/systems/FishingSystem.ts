import Phaser from 'phaser';
import { BALANCE } from '../data/balance';
import { getLocation } from '../data/locations';
import { RARITY_ORDER } from '../constants';
import type { FishDef, MovementPattern } from '../data/types';
import type { RolledFish } from './FishGenerator';
import { FishGenerator, type LoadoutLuck } from './FishGenerator';
import type { LoadoutStats } from './EquipmentSystem';
import { Rng, rng as defaultRng } from '../utils/rng';

/** Pixel-space height of the reeling track; ReelMeter renders 1:1 against this. */
export const TRACK_HEIGHT = 460;

export type FishingState = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'result';

export interface ReelSnapshot {
    zoneY: number;
    zoneHeight: number;
    fishY: number;
    meter: number;
    tension: number;
    tensionActive: boolean;
    inZone: boolean;
}

interface PatternConfig {
    retargetMin: number;
    retargetMax: number;
    targetSpread: number; // 0..1 fraction of track a new target can move relative to current
    approachRate: number; // higher = snappier tracking of target
    speedScale: number;
    biasBottom?: boolean;
    burstChance?: number; // chance to pick an extreme target (jumper/dasher/mythic)
    jitter?: number; // extra per-frame noise amplitude (px/s)
}

const PATTERNS: Record<MovementPattern, PatternConfig> = {
    calm: { retargetMin: 1.6, retargetMax: 2.6, targetSpread: 0.3, approachRate: 1.4, speedScale: 0.55 },
    drifter: { retargetMin: 1.2, retargetMax: 2.0, targetSpread: 0.5, approachRate: 1.7, speedScale: 0.7 },
    darter: { retargetMin: 0.5, retargetMax: 1.0, targetSpread: 0.8, approachRate: 3.2, speedScale: 1.05 },
    sinker: { retargetMin: 1.0, retargetMax: 1.8, targetSpread: 0.4, approachRate: 1.8, speedScale: 0.8, biasBottom: true, burstChance: 0.2 },
    jumper: { retargetMin: 1.1, retargetMax: 1.9, targetSpread: 0.9, approachRate: 4.0, speedScale: 1.2, burstChance: 0.5 },
    erratic: { retargetMin: 0.3, retargetMax: 0.7, targetSpread: 1.0, approachRate: 3.6, speedScale: 1.25, jitter: 40 },
    dasher: { retargetMin: 0.4, retargetMax: 0.8, targetSpread: 1.0, approachRate: 4.8, speedScale: 1.5, burstChance: 0.6 },
    mythic: { retargetMin: 0.3, retargetMax: 0.6, targetSpread: 1.0, approachRate: 5.6, speedScale: 1.8, jitter: 55, burstChance: 0.4 }
};

export interface CastContext {
    locationId: string;
    loadout: LoadoutStats;
    luck: LoadoutLuck;
    discovered: Set<string>;
    fishSenseLevel: number;
    castsSinceRareOrBetter: number;
    totalCaught: number; // for tutorial scaling
    quickBiteBonus: number; // perk: reduces wait time
    strongArmsBonus: number; // perk: increases capture fill speed
}

export interface CastOutcomeFish {
    rolled: RolledFish;
    isHuge: boolean;
}

/**
 * Core gameplay state machine: cast -> wait (with nibbles) -> bite (hook window)
 * -> reel minigame -> result. Pure logic + a tiny bit of Phaser (EventEmitter);
 * the scene owns all visuals/tweens and reacts to the events emitted here.
 */
export class FishingSystem extends Phaser.Events.EventEmitter {
    state: FishingState = 'idle';

    private generator = new FishGenerator();
    private r: Rng = defaultRng;
    private ctx: CastContext | null = null;
    private encounter: CastOutcomeFish | null = null;

    // waiting/bite timers
    private waitElapsed = 0;
    private waitTarget = 0;
    private nibbleTimes: number[] = [];
    private nibblesFired = 0;
    private hookElapsed = 0;
    private hookWindow = 0;
    private autoHook = false;

    // reel minigame state (pixel space, 0 = bottom of track)
    zoneY = 0;
    zoneHeight = 0;
    zoneVelocity = 0;
    fishY = 0;
    fishTargetY = 0;
    fishRetargetTimer = 0;
    meter = 0;
    tension = 0;
    tensionActive = false;
    neverLeftZone = true;
    perfectEligible = true;

    private pattern: PatternConfig = PATTERNS.calm;
    private fishSpeed = 60;
    private lineMaxTension = 15;
    private lineSnapResist = 1;
    private reelCaptureMult = 1;

    startCast(ctx: CastContext, targetX: number): void {
        if (this.state !== 'idle') return;
        this.ctx = ctx;
        this.state = 'casting';
        this.emit('cast', { targetX });
    }

    /** Called by the scene once the cast-arc tween/splash finishes. */
    onSplashLanded(): void {
        if (this.state !== 'casting' || !this.ctx) return;
        this.state = 'waiting';
        this.beginWait(this.ctx);
    }

    private beginWait(ctx: CastContext): void {
        const bait = ctx.loadout.bait;
        const speedMult = bait.biteSpeed * (1 + ctx.quickBiteBonus);
        this.waitTarget = this.r.range(BALANCE.bite.minMs, BALANCE.bite.maxMs) / speedMult;
        this.waitElapsed = 0;
        this.nibblesFired = 0;
        const nibbleCount = this.r.chance(BALANCE.bite.nibbleChance) ? this.r.int(1, BALANCE.bite.maxNibbles) : 0;
        this.nibbleTimes = [];
        for (let i = 0; i < nibbleCount; i++) {
            this.nibbleTimes.push(this.r.range(0.25, 0.85) * this.waitTarget);
        }
        this.nibbleTimes.sort((a, b) => a - b);
    }

    /** Player tapped while waiting for a bite -- reel in early, no penalty, ready to cast again. */
    cancelWait(): void {
        if (this.state !== 'waiting') return;
        this.reset();
    }

    private triggerBite(ctx: CastContext): void {
        const rolled = this.generator.roll(
            ctx.locationId,
            ctx.luck,
            ctx.discovered,
            ctx.castsSinceRareOrBetter,
            ctx.fishSenseLevel
        );
        const isHuge = RARITY_ORDER.indexOf(rolled.fish.rarity) >= RARITY_ORDER.indexOf(BALANCE.bite.hugeRarityThreshold)
            || rolled.weightPercentile >= BALANCE.bite.hugeWeightPercentile;
        this.encounter = { rolled, isHuge };
        this.state = 'bite';
        this.hookElapsed = 0;
        this.hookWindow = BALANCE.bite.hookWindowMs;
        this.autoHook = ctx.totalCaught < BALANCE.bite.tutorialCatchCount;
        if (isHuge) this.emit('huge', rolled.fish);
        this.emit('bite', rolled);
        if (this.autoHook) {
            // small delay so the bite visual reads before auto-hooking
            this.hookElapsed = -220;
        }
    }

    /** Player tapped during the bite window. */
    attemptHook(): void {
        if (this.state !== 'bite' || !this.ctx || !this.encounter) return;
        this.beginReel(this.ctx, this.encounter);
    }

    private beginReel(ctx: CastContext, enc: CastOutcomeFish): void {
        this.state = 'reeling';
        const { rolled } = enc;
        const tutorial = ctx.totalCaught < BALANCE.bite.tutorialCatchCount;
        const difficultyScale = tutorial ? BALANCE.bite.tutorialScale : 1;

        this.pattern = PATTERNS[rolled.fish.movementPattern];
        this.lineMaxTension = ctx.loadout.line.maxTension;
        this.lineSnapResist = ctx.loadout.line.snapResist;
        this.reelCaptureMult = ctx.loadout.reel.captureSpeed * (1 + ctx.strongArmsBonus);

        this.zoneHeight = Phaser.Math.Clamp(
            BALANCE.minigame.catchZoneBaseHeight + ctx.loadout.rod.control * BALANCE.minigame.catchZoneControlScale,
            90, TRACK_HEIGHT * 0.82
        );
        this.zoneY = (TRACK_HEIGHT - this.zoneHeight) / 2;
        this.zoneVelocity = 0;

        // Speed & aggression = difficulty x weight x location toughness / rod power, per the design spec.
        const weightFactor = 0.6 + 0.4 * rolled.weightPercentile;
        const rodPower = Math.max(0.6, ctx.loadout.rod.power);
        const locationMod = getLocation(ctx.locationId).difficultyMod;
        const baseSpeed = BALANCE.minigame.fishBaseSpeed;
        this.fishSpeed = ((baseSpeed + rolled.fish.difficulty * BALANCE.minigame.fishSpeedPerDifficulty) / baseSpeed)
            * weightFactor
            * locationMod
            * difficultyScale
            * this.pattern.speedScale
            / rodPower;

        this.fishY = TRACK_HEIGHT * this.r.range(0.35, 0.65);
        this.fishTargetY = this.fishY;
        this.fishRetargetTimer = 0;

        this.meter = BALANCE.minigame.meterStart;
        this.tension = 0;
        const tensionRatio = rolled.weight / Math.max(1, this.lineMaxTension);
        this.tensionActive = tensionRatio > BALANCE.minigame.tensionThresholdWeightRatio;
        this.neverLeftZone = true;
        this.perfectEligible = true;

        this.emit('reelStart', rolled);
    }

    /** Advance all timers/physics. `holding` is the current pointer/space-down state (only used while reeling). */
    update(dt: number, holding: boolean): void {
        const dtSec = dt / 1000;
        switch (this.state) {
            case 'waiting': return this.updateWaiting(dt);
            case 'bite': return this.updateBite(dt);
            case 'reeling': return this.updateReeling(dtSec, holding);
            default: return;
        }
    }

    private updateWaiting(dt: number): void {
        if (!this.ctx) return;
        this.waitElapsed += dt;
        while (this.nibblesFired < this.nibbleTimes.length && this.waitElapsed >= this.nibbleTimes[this.nibblesFired]) {
            this.nibblesFired++;
            this.emit('nibble');
        }
        if (this.waitElapsed >= this.waitTarget) {
            this.triggerBite(this.ctx);
        }
    }

    private updateBite(dt: number): void {
        this.hookElapsed += dt;
        if (this.autoHook && this.hookElapsed >= 0) {
            this.attemptHook();
            return;
        }
        if (!this.autoHook && this.hookElapsed >= this.hookWindow) {
            // missed the hook window entirely
            const fish = this.encounter?.rolled.fish;
            this.state = 'result';
            this.emit('missedHook', fish);
            this.reset();
        }
    }

    private updateReeling(dtSec: number, holding: boolean): void {
        const b = BALANCE.minigame;

        // --- catch zone physics ---
        this.zoneVelocity += (holding ? b.liftAccel : -b.gravity) * dtSec;
        this.zoneVelocity = Phaser.Math.Clamp(this.zoneVelocity, -b.maxVelocity, b.maxVelocity);
        this.zoneY += this.zoneVelocity * dtSec;
        if (this.zoneY < 0) { this.zoneY = 0; this.zoneVelocity *= -b.bounceDamp; }
        const maxZoneY = TRACK_HEIGHT - this.zoneHeight;
        if (this.zoneY > maxZoneY) { this.zoneY = maxZoneY; this.zoneVelocity *= -b.bounceDamp; }

        // --- fish movement ---
        this.fishRetargetTimer -= dtSec;
        if (this.fishRetargetTimer <= 0) {
            this.pickFishTarget();
            this.fishRetargetTimer = this.r.range(this.pattern.retargetMin, this.pattern.retargetMax);
        }
        const approach = 1 - Math.exp(-this.pattern.approachRate * this.fishSpeed * dtSec);
        this.fishY += (this.fishTargetY - this.fishY) * approach;
        if (this.pattern.jitter) {
            this.fishY += (this.r.next() - 0.5) * this.pattern.jitter * this.fishSpeed * dtSec;
        }
        this.fishY = Phaser.Math.Clamp(this.fishY, 4, TRACK_HEIGHT - 4);

        // --- capture meter ---
        const inZone = this.fishY >= this.zoneY && this.fishY <= this.zoneY + this.zoneHeight;
        if (!inZone) { this.neverLeftZone = false; }
        if (inZone) {
            this.meter += b.fillRatePerSec * this.reelCaptureMult * dtSec;
        } else {
            this.meter -= (b.drainRatePerSec / this.lineSnapResist) * dtSec;
        }
        this.meter = Phaser.Math.Clamp(this.meter, 0, 1);

        // --- tension ---
        if (this.tensionActive) {
            if (!inZone) this.tension += b.tensionBuildPerSec * dtSec;
            else this.tension -= b.tensionDecayPerSec * dtSec;
            this.tension = Phaser.Math.Clamp(this.tension, 0, 1);
        }

        if (this.tensionActive && this.tension >= 1) {
            this.finishReel(false, true);
        } else if (this.meter >= 1) {
            this.finishReel(true, false);
        } else if (this.meter <= 0) {
            this.finishReel(false, false);
        }
    }

    private pickFishTarget(): void {
        const spread = this.pattern.targetSpread * TRACK_HEIGHT;
        let target: number;
        if (this.pattern.burstChance && this.r.chance(this.pattern.burstChance)) {
            target = this.r.chance(0.5) ? TRACK_HEIGHT * 0.92 : TRACK_HEIGHT * 0.08;
        } else if (this.pattern.biasBottom) {
            target = this.r.range(0, TRACK_HEIGHT * 0.4);
        } else {
            const lo = Phaser.Math.Clamp(this.fishY - spread, 0, TRACK_HEIGHT);
            const hi = Phaser.Math.Clamp(this.fishY + spread, 0, TRACK_HEIGHT);
            target = this.r.range(Math.min(lo, hi), Math.max(lo, hi));
        }
        this.fishTargetY = Phaser.Math.Clamp(target, 8, TRACK_HEIGHT - 8);
    }

    private finishReel(caught: boolean, lineSnapped: boolean): void {
        if (!this.encounter) { this.reset(); return; }
        const perfect = caught && this.neverLeftZone;
        this.state = 'result';
        if (caught) {
            this.emit('reelSuccess', { ...this.encounter, perfect });
        } else {
            this.emit('reelFail', { ...this.encounter, lineSnapped, meter: this.meter });
        }
        this.reset();
    }

    snapshot(): ReelSnapshot {
        return {
            zoneY: this.zoneY,
            zoneHeight: this.zoneHeight,
            fishY: this.fishY,
            meter: this.meter,
            tension: this.tension,
            tensionActive: this.tensionActive,
            inZone: this.fishY >= this.zoneY && this.fishY <= this.zoneY + this.zoneHeight
        };
    }

    currentFish(): FishDef | null { return this.encounter?.rolled.fish ?? null; }

    reset(): void {
        this.state = 'idle';
        this.ctx = null;
        this.encounter = null;
    }
}

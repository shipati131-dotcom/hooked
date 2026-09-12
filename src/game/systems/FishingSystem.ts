import { BALANCE } from '../data/balance';
import { getLocation } from '../data/locations';
import { RARITY_ORDER } from '../constants';
import type { FishDef, MovementPattern } from '../data/types';
import type { RolledFish } from './FishGenerator';
import { FishGenerator, type LoadoutLuck } from './FishGenerator';
import type { LoadoutStats } from './EquipmentSystem';
import { Rng, rng as defaultRng } from '../utils/rng';
import { clamp } from '../utils/format';
import { GameBus } from '../core/GameState';

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
    phase: 'control' | 'surge' | 'recovery';
    phaseProgress: number;
    combo: number;
    holding: boolean;
    surgesSurvived: number;
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
export class FishingSystem extends GameBus {
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
    battlePhase: 'control' | 'surge' | 'recovery' = 'control';
    phaseElapsed = 0;
    phaseDuration = 1;
    combo = 0;
    private lastHolding = false;
    private surgesSurvived = 0;

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
        // Quick Bite's displayed percentage is a true wait-time reduction.
        const waitMultiplier = clamp(1 - ctx.quickBiteBonus, 0.2, 1);
        this.waitTarget = this.r.range(BALANCE.bite.minMs, BALANCE.bite.maxMs) * waitMultiplier / bait.biteSpeed;
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
        // Hooking always requires a deliberate tap/click on the "!" -- no
        // auto-hook, even during the early tutorial catches.
        this.autoHook = false;
        if (isHuge) this.emit('huge', rolled.fish);
        this.emit('bite', rolled);
    }

    /** Player tapped during the bite window. */
    attemptHook(): void {
        if (this.state !== 'bite' || !this.ctx || !this.encounter) return;
        this.beginReel(this.ctx, this.encounter);
    }

    private beginReel(ctx: CastContext, enc: CastOutcomeFish): void {
        this.state = 'reeling';
        const { rolled } = enc;
        // Gradual ramp from `tutorialScale` (brand new player) up to full
        // difficulty by `tutorialRampCatches` total catches, instead of a
        // hard cliff -- see BALANCE.bite for why.
        const rampProgress = clamp(ctx.totalCaught / BALANCE.bite.tutorialRampCatches, 0, 1);
        const difficultyScale = BALANCE.bite.tutorialScale + (1 - BALANCE.bite.tutorialScale) * rampProgress;

        this.pattern = PATTERNS[rolled.fish.movementPattern];
        this.lineMaxTension = ctx.loadout.line.maxTension;
        this.lineSnapResist = ctx.loadout.line.snapResist;
        this.reelCaptureMult = ctx.loadout.reel.captureSpeed * (1 + ctx.strongArmsBonus);

        this.zoneHeight = clamp(
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
        this.battlePhase = 'control';
        this.phaseElapsed = 0;
        this.phaseDuration = this.r.range(BALANCE.minigame.surgeMinDelaySec, BALANCE.minigame.surgeMaxDelaySec);
        this.combo = 0;
        this.lastHolding = false;
        this.surgesSurvived = 0;

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
        this.lastHolding = holding;

        // The fight has a readable rhythm: control the fish, survive a telegraphed
        // power surge by giving line, then capitalize on its brief recovery.
        this.phaseElapsed += dtSec;
        if (this.phaseElapsed >= this.phaseDuration) {
            if (this.battlePhase === 'control') {
                this.battlePhase = 'surge';
                this.phaseDuration = b.surgeDurationSec;
                this.fishTargetY = this.r.chance(0.5) ? TRACK_HEIGHT * 0.92 : TRACK_HEIGHT * 0.08;
            } else if (this.battlePhase === 'surge') {
                this.battlePhase = 'recovery';
                this.phaseDuration = b.recoveryDurationSec;
                this.surgesSurvived++;
            } else {
                this.battlePhase = 'control';
                this.phaseDuration = this.r.range(b.surgeMinDelaySec, b.surgeMaxDelaySec);
            }
            this.phaseElapsed = 0;
        }

        // --- catch zone physics ---
        this.zoneVelocity += (holding ? b.liftAccel : -b.gravity) * dtSec;
        this.zoneVelocity = clamp(this.zoneVelocity, -b.maxVelocity, b.maxVelocity);
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
        const phaseSpeed = this.battlePhase === 'surge' ? 1.75 : this.battlePhase === 'recovery' ? 0.42 : 1;
        const approach = 1 - Math.exp(-this.pattern.approachRate * this.fishSpeed * phaseSpeed * dtSec);
        this.fishY += (this.fishTargetY - this.fishY) * approach;
        if (this.pattern.jitter) {
            this.fishY += (this.r.next() - 0.5) * this.pattern.jitter * this.fishSpeed * dtSec;
        }
        this.fishY = clamp(this.fishY, 4, TRACK_HEIGHT - 4);

        // --- capture meter ---
        const inZone = this.fishY >= this.zoneY && this.fishY <= this.zoneY + this.zoneHeight;
        if (!inZone) { this.neverLeftZone = false; }
        if (this.battlePhase === 'surge') {
            // Reeling into a surge is dangerous. Letting go gives the fish line and
            // rapidly cools tension; progress is protected but cannot be gained.
            if (holding) this.tension += (b.surgeTensionBuildPerSec / this.lineSnapResist) * dtSec;
            else this.tension -= b.slackTensionDecayPerSec * dtSec;
            this.combo = 0;
        } else if (inZone) {
            if (holding) {
                const recoveryBonus = this.battlePhase === 'recovery' ? b.recoveryFillBonus : 0;
                this.meter += (b.fillRatePerSec * this.reelCaptureMult + recoveryBonus) * dtSec;
                this.combo = Math.min(5, this.combo + dtSec * 1.4);
            } else {
                // Releasing to reposition the control band should not erase good
                // tracking; it simply stops the landing push until pressure returns.
                this.combo = Math.max(0, this.combo - dtSec * 1.5);
            }
        } else {
            this.meter -= (b.drainRatePerSec / this.lineSnapResist) * dtSec;
            this.combo = Math.max(0, this.combo - dtSec * 3);
        }
        this.meter = clamp(this.meter, 0, 1);
        if (this.surgesSurvived === 0) this.meter = Math.min(this.meter, 0.82);

        // --- tension ---
        if (this.battlePhase !== 'surge' && this.tensionActive) {
            if (!inZone) this.tension += b.tensionBuildPerSec * dtSec;
            else this.tension -= b.tensionDecayPerSec * dtSec;
        }
        this.tension = clamp(this.tension, 0, 1);

        if (this.tensionActive && this.tension >= 1) {
            this.finishReel(false, true);
        } else if (this.meter >= 1) {
            this.finishReel(true, false);
        } else if (this.meter <= 0 && this.surgesSurvived > 0) {
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
            const lo = clamp(this.fishY - spread, 0, TRACK_HEIGHT);
            const hi = clamp(this.fishY + spread, 0, TRACK_HEIGHT);
            target = this.r.range(Math.min(lo, hi), Math.max(lo, hi));
        }
        this.fishTargetY = clamp(target, 8, TRACK_HEIGHT - 8);
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
            inZone: this.fishY >= this.zoneY && this.fishY <= this.zoneY + this.zoneHeight,
            phase: this.battlePhase,
            phaseProgress: clamp(this.phaseElapsed / Math.max(0.001, this.phaseDuration), 0, 1),
            combo: Math.floor(this.combo),
            holding: this.lastHolding,
            surgesSurvived: this.surgesSurvived
        };
    }

    currentFish(): FishDef | null { return this.encounter?.rolled.fish ?? null; }

    reset(): void {
        this.state = 'idle';
        this.ctx = null;
        this.encounter = null;
    }
}

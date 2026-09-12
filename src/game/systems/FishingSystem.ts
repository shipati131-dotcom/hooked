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
    charge: number;
    sweetSpotStart: number;
    sweetSpotEnd: number;
    pulseResult: 'none' | 'perfect' | 'good' | 'weak' | 'overload';
    pulseSerial: number;
    surgeWarning: boolean;
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
    charge = 0;
    sweetSpotStart = 0.5;
    sweetSpotEnd = 0.73;
    pulseResult: ReelSnapshot['pulseResult'] = 'none';
    private pulseSerial = 0;
    private inputLockedUntilRelease = false;
    private timingWidth = BALANCE.minigame.strokeSweetWidth;
    private chargeRate = BALANCE.minigame.strokeChargePerSec;
    private pullStrength = 1;
    private surgeDelayMult = 1;

    private pattern: PatternConfig = PATTERNS.calm;
    private lineMaxTension = 15;
    private lineSnapResist = 1;
    private strainScale = 1;
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
        this.lineSnapResist = ctx.loadout.line.snapResist * ctx.loadout.reel.tensionResist;
        this.reelCaptureMult = ctx.loadout.reel.captureSpeed * (1 + ctx.strongArmsBonus);

        this.zoneHeight = clamp(BALANCE.minigame.catchZoneBaseHeight + ctx.loadout.rod.control * BALANCE.minigame.catchZoneControlScale, 90, TRACK_HEIGHT * 0.82);
        this.zoneY = (TRACK_HEIGHT - this.zoneHeight) / 2;
        this.zoneVelocity = 0;

        // Speed & aggression = difficulty x weight x location toughness / rod power, per the design spec.
        const weightFactor = 0.6 + 0.4 * rolled.weightPercentile;
        const rodPower = Math.max(0.6, ctx.loadout.rod.power);
        const locationMod = getLocation(ctx.locationId).difficultyMod;
        const fightPressure = weightFactor * locationMod * difficultyScale * this.pattern.speedScale / Math.sqrt(rodPower);
        this.timingWidth = clamp(
            BALANCE.minigame.strokeSweetWidth + ctx.loadout.rod.control * BALANCE.minigame.strokeControlWidthPerPoint,
            0.2, 0.46
        );
        // Keep the core reel cadence learnable across species. Difficulty comes
        // from narrower windows and more dangerous runs, not a wildly changing clock.
        this.chargeRate = BALANCE.minigame.strokeChargePerSec * clamp(0.92 + rolled.fish.difficulty * 0.025, 0.92, 1.16);
        this.pullStrength = Math.sqrt(ctx.loadout.rod.power * this.reelCaptureMult);
        this.surgeDelayMult = 1.45 - rampProgress * 0.35;

        this.fishY = TRACK_HEIGHT * this.r.range(0.35, 0.65);
        this.fishTargetY = this.fishY;
        this.fishRetargetTimer = 0;

        this.meter = 0.12;
        this.tension = 0;
        const tensionRatio = rolled.weight / Math.max(1, this.lineMaxTension);
        this.strainScale = clamp((0.55 + tensionRatio * 0.4) * clamp(fightPressure, 0.65, 1.6), 0.55, 2);
        // Strain is always part of the duel; heavy fish simply punish mistakes harder.
        this.tensionActive = true;
        this.neverLeftZone = true;
        this.perfectEligible = true;
        this.battlePhase = 'control';
        this.phaseElapsed = 0;
        this.phaseDuration = this.r.range(BALANCE.minigame.surgeMinDelaySec, BALANCE.minigame.surgeMaxDelaySec) * this.surgeDelayMult;
        this.combo = 0;
        this.lastHolding = false;
        this.surgesSurvived = 0;
        this.charge = 0;
        this.pulseResult = 'none';
        this.pulseSerial = 0;
        this.inputLockedUntilRelease = false;
        this.pickSweetSpot();

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
        const released = this.lastHolding && !holding;
        const pressed = !this.lastHolding && holding;

        // The fight has a readable rhythm: control the fish, survive a telegraphed
        // power surge by giving line, then capitalize on its brief recovery.
        this.phaseElapsed += dtSec;
        if (this.phaseElapsed >= this.phaseDuration) {
            if (this.battlePhase === 'control') {
                this.battlePhase = 'surge';
                this.phaseDuration = b.surgeDurationSec;
                this.charge = 0;
                this.inputLockedUntilRelease = holding;
            } else if (this.battlePhase === 'surge') {
                this.battlePhase = 'recovery';
                this.phaseDuration = b.recoveryDurationSec;
                this.surgesSurvived++;
                this.inputLockedUntilRelease = false;
                this.pickSweetSpot(true);
            } else {
                this.battlePhase = 'control';
                this.phaseDuration = this.r.range(b.surgeMinDelaySec, b.surgeMaxDelaySec) * this.surgeDelayMult;
                this.pickSweetSpot();
            }
            this.phaseElapsed = 0;
        }

        // The fish still moves for visual character, but control is now about
        // deliberate reel strokes rather than chasing it with a floating bar.
        const swim = this.battlePhase === 'surge' ? 2.8 : this.battlePhase === 'recovery' ? 0.7 : 1.45;
        this.fishY = TRACK_HEIGHT * (0.5 + Math.sin(this.phaseElapsed * swim + this.pattern.speedScale) * 0.28);

        if (this.battlePhase === 'surge') {
            if (holding) this.tension += (b.surgeTensionBuildPerSec * this.strainScale / this.lineSnapResist) * dtSec;
            else this.tension -= b.slackTensionDecayPerSec * dtSec;
            if (holding) { this.combo = 0; this.neverLeftZone = false; }
        } else {
            if (pressed) this.pulseResult = 'none';
            if (released && !this.inputLockedUntilRelease) this.resolveStroke();
            if (!holding && this.inputLockedUntilRelease) {
                this.charge = 0;
                this.inputLockedUntilRelease = false;
            }

            if (holding && !this.inputLockedUntilRelease) {
                this.charge += this.chargeRate * dtSec;
                if (this.charge >= 1) {
                    this.charge = 1;
                    this.tension += b.strokeOverloadStrain * this.strainScale / this.lineSnapResist;
                    this.meter -= 0.035;
                    this.combo = 0;
                    this.neverLeftZone = false;
                    this.pulseResult = 'overload';
                    this.pulseSerial++;
                    this.emit('reelPulse', { result: this.pulseResult, combo: this.combo });
                    this.inputLockedUntilRelease = true;
                }
            }
            this.tension -= b.tensionDecayPerSec * dtSec;
            if (this.surgesSurvived > 0) this.meter -= b.strokePassiveLossPerSec * dtSec;
        }
        this.meter = clamp(this.meter, 0, 1);
        this.tension = clamp(this.tension, 0, 1);
        this.lastHolding = holding;

        if (this.tensionActive && this.tension >= 1) {
            this.finishReel(false, true);
        } else if (this.meter >= 1) {
            this.finishReel(true, false);
        } else if (this.meter <= 0 && this.surgesSurvived > 0) {
            this.finishReel(false, false);
        }
    }

    private resolveStroke(): void {
        const b = BALANCE.minigame;
        const center = (this.sweetSpotStart + this.sweetSpotEnd) / 2;
        const distance = Math.abs(this.charge - center);
        const perfect = distance <= b.strokePerfectWidth;
        const good = this.charge >= this.sweetSpotStart && this.charge <= this.sweetSpotEnd;
        this.pulseResult = perfect ? 'perfect' : good ? 'good' : 'weak';

        if (perfect || good) {
            this.combo = Math.min(9, this.combo + 1);
            const accuracy = perfect ? 1.5 : 1;
            const recovery = this.battlePhase === 'recovery' ? 1.45 : 1;
            const comboBonus = 1 + Math.max(0, this.combo - 1) * 0.055;
            this.meter += b.strokeBasePull * this.pullStrength * accuracy * recovery * comboBonus;
            this.tension -= (perfect ? 0.12 : 0.06);
        } else {
            this.combo = 0;
            this.neverLeftZone = false;
            this.meter += b.strokeBasePull * this.pullStrength * 0.2;
            this.tension += b.strokeWeakStrain * this.strainScale / this.lineSnapResist;
        }
        this.charge = 0;
        this.pulseSerial++;
        this.emit('reelPulse', { result: this.pulseResult, combo: this.combo });
        this.pickSweetSpot(this.battlePhase === 'recovery');
    }

    private pickSweetSpot(recovery = false): void {
        const width = clamp(this.timingWidth * (recovery ? 1.3 : 1), 0.2, 0.56);
        const center = this.r.range(0.48 + width / 2, 0.92 - width / 2);
        this.sweetSpotStart = center - width / 2;
        this.sweetSpotEnd = center + width / 2;
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
            ,
            charge: this.charge,
            sweetSpotStart: this.sweetSpotStart,
            sweetSpotEnd: this.sweetSpotEnd,
            pulseResult: this.pulseResult,
            pulseSerial: this.pulseSerial,
            surgeWarning: this.battlePhase === 'control' && this.phaseProgressValue() > 0.72
        };
    }

    private phaseProgressValue(): number {
        return clamp(this.phaseElapsed / Math.max(0.001, this.phaseDuration), 0, 1);
    }

    currentFish(): FishDef | null { return this.encounter?.rolled.fish ?? null; }

    reset(): void {
        this.state = 'idle';
        this.ctx = null;
        this.encounter = null;
    }
}

import { BALANCE } from '../data/balance';
import { getLocation } from '../data/locations';
import { RARITY_ORDER } from '../constants';
import type { FishDef, FightProfile } from '../data/types';
import type { RolledFish } from './FishGenerator';
import { FishGenerator, type LoadoutLuck } from './FishGenerator';
import type { LoadoutStats } from './EquipmentSystem';
import { Rng, rng as defaultRng } from '../utils/rng';
import { clamp } from '../utils/format';
import { GameBus } from '../core/GameState';
import { CastModel, type CastResolution, type Hotspot } from './fishing/CastModel';
import { BiteModel, type CueEvent } from './fishing/BiteModel';
import { buildFightProfile } from './fishing/fightProfile';
import { FightModel, type FightGear, type FightSnapshot } from './fishing/FightModel';
import { MECHANIC_UNLOCKS } from '../data/fishBehaviors';

export type FishingState = 'idle' | 'aiming' | 'casting' | 'waiting' | 'bite' | 'fighting' | 'result';

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
 * Core gameplay orchestrator: aim+charge a cast -> read the bite cues -> set
 * the hook with a directional strike -> fight the fish (tension/stamina/
 * distance/moves) -> result. All the actual rules live in the pure
 * systems/fishing/* models below; this class just sequences them and emits
 * bus events for the scene to react to. See the design doc in
 * .claude/plans (or CLAUDE.md history) for the full mechanic writeup.
 */
export class FishingSystem extends GameBus {
    state: FishingState = 'idle';

    private generator = new FishGenerator();
    private r: Rng = defaultRng;
    private ctx: CastContext | null = null;
    private encounter: CastOutcomeFish | null = null;

    private castModel = new CastModel(this.r);
    private resolvedCast: CastResolution | null = null;

    private waitElapsed = 0;
    private waitTarget = 0;

    private biteModel: BiteModel | null = null;
    private fightProfile: FightProfile | null = null;

    private fightModel: FightModel | null = null;
    private prevMove = '';
    private prevPhaseIndex = 0;
    private prevAirborne = false;

    // ---------------------------------------------------------------- cast

    /** Begin aiming: the power needle starts ping-ponging. */
    beginAim(ctx: CastContext): void {
        if (this.state !== 'idle') return;
        this.ctx = ctx;
        this.state = 'aiming';
        this.castModel.startCharge();
    }

    /** Release the cast toward `targetDistPx` (distance from the rod along the cast axis). */
    releaseCast(targetDistPx: number): void {
        if (this.state !== 'aiming' || !this.ctx) return;
        this.resolvedCast = this.castModel.release(targetDistPx, this.ctx.loadout.rod);
        this.state = 'casting';
        this.emit('cast', { targetDistPx, resolution: this.resolvedCast });
    }

    getCastPower(): number { return this.castModel.power; }
    getHotspots(): readonly Hotspot[] { return this.castModel.getHotspots(); }
    reachPx(): number { return this.ctx ? this.castModel.reachFor(this.ctx.loadout.rod) : BALANCE.cast.baseReachPx; }
    sweetHalfWidthFor(targetDistPx: number): { center: number; half: number } | null {
        if (!this.ctx) return null;
        return { center: this.castModel.requiredPower(targetDistPx, this.ctx.loadout.rod), half: this.castModel.sweetHalfWidth(this.ctx.loadout.rod) };
    }

    /** Called by the scene once the cast-arc tween/splash finishes. */
    onSplashLanded(): void {
        if (this.state !== 'casting' || !this.ctx || !this.resolvedCast) return;
        this.state = 'waiting';
        this.beginWait(this.ctx, this.resolvedCast);
    }

    private beginWait(ctx: CastContext, cast: CastResolution): void {
        const bait = ctx.loadout.bait;
        const waitMultiplier = clamp(1 - ctx.quickBiteBonus, 0.2, 1);
        this.waitTarget = this.r.range(BALANCE.bite.minMs, BALANCE.bite.maxMs) * waitMultiplier * cast.biteSpeedMult / bait.biteSpeed;
        this.waitElapsed = 0;
    }

    /** Player tapped while waiting for a bite -- reel in early, no penalty, ready to cast again. */
    cancelWait(): void {
        if (this.state !== 'waiting') return;
        this.reset();
    }

    private updateWaiting(dt: number): void {
        if (!this.ctx) return;
        this.waitElapsed += dt;
        if (this.waitElapsed >= this.waitTarget) {
            this.triggerBite(this.ctx);
        }
    }

    // ---------------------------------------------------------------- bite

    private triggerBite(ctx: CastContext): void {
        const luck: LoadoutLuck = { ...ctx.luck, castBonus: (ctx.luck.castBonus ?? 0) + (this.resolvedCast?.luckBonus ?? 0) };
        const skewReduction = this.resolvedCast?.weightSkewReduction ?? 0;
        const rolled = this.generator.roll(ctx.locationId, luck, ctx.discovered, ctx.castsSinceRareOrBetter, ctx.fishSenseLevel, skewReduction);
        const isHuge = RARITY_ORDER.indexOf(rolled.fish.rarity) >= RARITY_ORDER.indexOf(BALANCE.bite.hugeRarityThreshold)
            || rolled.weightPercentile >= BALANCE.bite.hugeWeightPercentile;
        this.encounter = { rolled, isHuge };

        const locationMod = getLocation(ctx.locationId).difficultyMod;
        const rampProgress = clamp(ctx.totalCaught / BALANCE.bite.tutorialRampCatches, 0, 1);
        this.fightProfile = buildFightProfile(rolled.fish, {
            weightPercentile: rolled.weightPercentile,
            locationDifficultyMod: locationMod,
            tutorialProgress: rampProgress,
            totalCaught: ctx.totalCaught
        });

        this.biteModel = new BiteModel(this.fightProfile.biteStyle, this.fightProfile.hookDifficulty, ctx.loadout.bait, ctx.loadout.hook, ctx.totalCaught, this.r);
        this.state = 'bite';
        if (isHuge) this.emit('huge', rolled.fish);
        this.emit('bite', rolled);
    }

    private updateBite(dt: number): void {
        if (!this.biteModel || !this.encounter) return;
        const fired = this.biteModel.update(dt);
        for (const cue of fired) this.emit('biteCue', cue as CueEvent);
        if (this.biteModel.hasMissedWindow()) {
            const fish = this.encounter.rolled.fish;
            this.state = 'result';
            this.emit('missedHook', fish);
            this.reset();
        }
    }

    /** Player struck: null = a plain tap (no drag direction), else -1/1 for the swipe direction. */
    strike(swipeDir: -1 | 1 | null): void {
        if (this.state !== 'bite' || !this.biteModel || !this.ctx || !this.encounter || !this.fightProfile) return;
        const tutorialGrace = this.ctx.totalCaught < BALANCE.biteCues.tutorialSpookGraceCatches;
        const result = this.biteModel.attemptStrike(swipeDir, tutorialGrace);

        switch (result.outcome) {
            case 'warned':
                this.emit('biteWarning', this.encounter.rolled.fish);
                return; // fish stays, script keeps playing
            case 'idleCancel':
                this.reset();
                return;
            case 'spooked':
                this.emit('spooked', this.encounter.rolled.fish);
                this.reset();
                return;
            case 'wrongDirection':
                this.emit('wrongHook', this.encounter.rolled.fish);
                this.reset();
                return;
            case 'solidHook':
            case 'lightHook':
                this.beginFight(result.outcome === 'solidHook', result.hookThrowRiskBonus);
                return;
        }
    }

    // ---------------------------------------------------------------- fight

    private beginFight(solid: boolean, hookThrowRiskBonus: number): void {
        if (!this.ctx || !this.encounter || !this.fightProfile) return;
        const { rolled } = this.encounter;
        const gear: FightGear = {
            rod: this.ctx.loadout.rod, reel: this.ctx.loadout.reel,
            line: this.ctx.loadout.line, hook: this.ctx.loadout.hook
        };
        // Strong Arms perk: faster reel-in and harder-hitting stamina damage.
        const boostedGear: FightGear = { ...gear, reel: { ...gear.reel, captureSpeed: gear.reel.captureSpeed * (1 + this.ctx.strongArmsBonus) } };

        this.fightModel = new FightModel(this.fightProfile, boostedGear, rolled.weight, {
            startingStaminaFrac: solid ? 0.9 : 1,
            hookThrowRiskBonus
        }, this.r);
        this.prevMove = 'cruise';
        this.prevPhaseIndex = 0;
        this.prevAirborne = false;
        this.state = 'fighting';
        this.emit('hookSet', { solid });
        this.emit('fightStart', rolled);
    }

    private updateFighting(dtSec: number, holding: boolean, steer: number): void {
        if (!this.fightModel || !this.encounter) return;
        this.fightModel.update(dtSec, holding, steer);
        const snap = this.fightModel.snapshot();

        if (snap.movePhase === 'active' && snap.move !== this.prevMove) {
            this.emit('fightMove', { move: snap.move, label: snap.moveLabel });
        }
        this.prevMove = snap.movePhase === 'active' ? snap.move : this.prevMove;
        if (snap.phaseIndex !== this.prevPhaseIndex) {
            this.prevPhaseIndex = snap.phaseIndex;
            this.emit('phaseChange', { phaseIndex: snap.phaseIndex, label: snap.phaseLabel });
        }
        if (snap.airborne && !this.prevAirborne) this.emit('fishJump', {});
        this.prevAirborne = snap.airborne;

        if (this.fightModel.isDone()) this.finishFight(snap);
    }

    private finishFight(snap: FightSnapshot): void {
        if (!this.encounter || !this.fightModel) { this.reset(); return; }
        this.state = 'result';
        const meter = clamp(1 - snap.distance, 0, 1);
        if (snap.result === 'landed') {
            const perfect = this.fightModel.isPerfect();
            this.emit('reelSuccess', { ...this.encounter, perfect });
        } else {
            this.emit('reelFail', {
                ...this.encounter,
                lineSnapped: snap.result === 'lineSnapped',
                hookThrown: snap.result === 'hookThrown',
                meter
            });
        }
        this.reset();
    }

    // ---------------------------------------------------------------- per-frame

    /** Advance all timers/physics. `holding` = reel input down, `steer` = -1..1 rod-steer drag. */
    update(dt: number, holding: boolean, steer = 0): void {
        const dtSec = dt / 1000;
        this.castModel.tick(dtSec);
        switch (this.state) {
            case 'aiming': this.castModel.updateCharge(dtSec); return;
            case 'waiting': return this.updateWaiting(dt);
            case 'bite': return this.updateBite(dt);
            case 'fighting': return this.updateFighting(dtSec, holding, steer);
            default: return;
        }
    }

    fightSnapshot(): FightSnapshot | null { return this.fightModel?.snapshot() ?? null; }
    biteWindowRemainingMs(): number { return this.biteModel?.windowRemainingMs() ?? 0; }
    isInStrikeWindow(): boolean { return this.biteModel?.isInStrikeWindow() ?? false; }
    currentPullDir(): -1 | 1 { return this.biteModel?.currentPullDir() ?? 1; }
    mechanicUnlockedNow(totalCaughtBefore: number, totalCaughtAfter: number): string | null {
        for (const [key, threshold] of Object.entries(MECHANIC_UNLOCKS)) {
            if (totalCaughtBefore < threshold && totalCaughtAfter >= threshold) return key;
        }
        return null;
    }

    currentFish(): FishDef | null { return this.encounter?.rolled.fish ?? null; }

    reset(): void {
        this.state = 'idle';
        this.ctx = null;
        this.encounter = null;
        this.biteModel = null;
        this.fightModel = null;
        this.fightProfile = null;
        this.resolvedCast = null;
    }
}

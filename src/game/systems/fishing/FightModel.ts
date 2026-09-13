import { BALANCE } from '../../data/balance';
import { clamp } from '../../utils/format';
import { Rng, rng as defaultRng } from '../../utils/rng';
import type { FightProfile, HookStats, LineStats, ReelStats, RodStats } from '../../data/types';
import type { MoveId } from '../../data/types';
import { MOVES } from './fightMoves';

export type FightResult = 'none' | 'landed' | 'lineSnapped' | 'hookThrown' | 'slackEscape';
export type MovePhase = 'telegraph' | 'active' | 'cooldown';

export interface FightGear {
    rod: RodStats;
    reel: ReelStats;
    line: LineStats;
    hook: HookStats;
}

export interface FightOptions {
    /** A Solid hook-set gives the fish a head start on exhaustion (default 1 = full stamina). */
    startingStaminaFrac?: number;
    /** A Light hook-set adds extra hook-throw risk on top of the jump-move baseline. */
    hookThrowRiskBonus?: number;
}

export interface FightSnapshot {
    tension: number; // 0..1
    tensionZone: 'safe' | 'power' | 'redline';
    staminaFrac: number; // 0..1, remaining
    distance: number; // 0..1, 0 = landed
    lateralPos: number; // -1..1, for FightView x placement
    runDir: number; // -1..1, the fish's current instantaneous pull direction (0 while cruising/resting)
    move: MoveId;
    movePhase: MovePhase;
    moveLabel: string;
    telegraphDir: number; // -1..1, the direction shown during a telegraph (may be a fake for fakeout)
    airborne: boolean;
    snapGraceFrac: number; // 0..1, fills while redlined; snaps the line at 1
    slackFrac: number; // 0..1, fills while slack; throws the hook at 1
    phaseIndex: number;
    phaseAnnouncing: boolean;
    phaseLabel: string;
    everRedlined: boolean;
    elapsedSec: number;
    result: FightResult;
}

/**
 * Pure per-frame fight simulation: tension, stamina, distance, lateral
 * movement, snap/slack/hook-throw/phase logic. No Phaser dependency, so it is
 * fully unit- and simulation-testable (see tests/FightModel.test.ts and
 * tests/FightBalance.test.ts). The scene only reads snapshot() and calls
 * update(dtSec, holding, steer) once per frame.
 */
export class FightModel {
    private r: Rng;
    private profile: FightProfile;
    private gear: FightGear;
    private fishWeightKg: number;
    private unlockedMoves: Set<MoveId>;
    private aggression: number;
    private hookThrowRiskBonus: number;

    private tension = 0;
    private staminaFrac = 1;
    private distance = 1;
    private lateralPos = 0;
    private snapGraceTimer = 0;
    private slackTimer = 0;
    private everRedlined = false;
    private elapsedSec = 0;
    private result: FightResult = 'none';

    private move: MoveId = 'cruise';
    private movePhase: MovePhase = 'active';
    private moveElapsed = 0;
    private moveActiveDuration = 1.4;
    private moveTelegraphDuration = 0;
    private runDir = 0;
    private telegraphDir = 0;
    private cooldownTimer = 0;

    private phaseIndex = 0;
    private phaseAnnounceTimer = 0;
    private phaseLabel = '';

    constructor(profile: FightProfile, gear: FightGear, fishWeightKg: number, options: FightOptions = {}, r: Rng = defaultRng) {
        this.r = r;
        this.profile = profile;
        this.gear = gear;
        this.fishWeightKg = fishWeightKg;
        this.aggression = profile.aggression;
        this.unlockedMoves = new Set(profile.moves);
        this.staminaFrac = clamp(options.startingStaminaFrac ?? 1, 0, 1);
        this.hookThrowRiskBonus = options.hookThrowRiskBonus ?? 0;
        this.pickMove('cruise');
    }

    private lineCapacity(): number {
        const f = BALANCE.fight;
        const ratio = this.fishWeightKg / Math.max(1, this.gear.line.maxTension);
        return clamp(f.lineCapacityMax - f.lineCapacityWeightScale * ratio, f.lineCapacityMin, f.lineCapacityMax);
    }

    private steerRelation(steer: number): { counter: number; follow: number } {
        const rel = clamp(steer * this.runDir, -1, 1);
        return { counter: clamp(-rel, 0, 1), follow: clamp(rel, 0, 1) };
    }

    update(dtSec: number, holding: boolean, steer: number): void {
        if (this.result !== 'none') return;
        const f = BALANCE.fight;
        this.elapsedSec += dtSec;

        if (this.phaseAnnounceTimer > 0) {
            this.phaseAnnounceTimer = Math.max(0, this.phaseAnnounceTimer - dtSec);
            // Fish still drifts visually, but the fight pauses (no tension/stamina/distance change).
            this.lateralPos += Math.sin(this.elapsedSec * 1.5) * 0.15 * dtSec;
            return;
        }

        this.advanceMove(dtSec);
        const { counter, follow } = this.steerRelation(steer);

        const config = MOVES[this.move];
        let pullMult = this.movePhase === 'active' ? config.pullMult : 0.5;
        if (config.pulsed && this.movePhase === 'active') {
            const wave = Math.sin(2 * Math.PI * f.thrashHz * this.moveElapsed);
            pullMult *= 1 + Math.max(0, wave) * 0.6;
        }

        const p = this.profile.strength * pullMult * (0.35 + 0.65 * this.staminaFrac);
        const capacity = this.lineCapacity();
        let target = (p * (holding ? 1 : 0.25) + (holding ? 0.25 : 0)) / capacity;
        target *= 1 - f.followSteerTensionCut * follow;
        // A flexible rod also caps how hard a burst can peak, not just how fast it
        // gets there -- "soaks up sudden runs" per its description.
        target *= 1 - this.gear.rod.flex * 0.18;
        // `distance` starts at 1 (freshly hooked, far away) and falls toward 0 as
        // it's reeled in -- it can also rise above 1 (the fish taking line faster
        // than you're giving up ground) up to the 1.15 clamp ceiling. Only THAT
        // overrun is dangerous ("spooled"); the initial 1.0 is not.
        if (this.distance >= 1.08) target += 0.3; // spooled -- danger, give slack

        const rising = target > this.tension;
        const rate = rising
            ? f.tensionApproachRate * (1 - this.gear.rod.flex * 0.75)
            : f.tensionApproachRate * this.gear.reel.tensionResist;
        this.tension += (target - this.tension) * clamp(rate * dtSec, 0, 1);
        this.tension = clamp(this.tension, 0, 1.4);

        // Drag assist: a reel with tensionResist above 1 auto-slips line once the
        // fight redlines, trading a little distance to bleed off tension -- this
        // is real "drag" and works regardless of whether the player is actively
        // releasing, unlike the recovery-rate benefit above.
        if (this.tension > 0.85 && this.gear.reel.tensionResist > 1) {
            const slip = (this.gear.reel.tensionResist - 1) * 1.4 * dtSec;
            this.tension = Math.max(0.85, this.tension - slip);
            this.distance += slip * 0.4;
        }

        const zone = this.tensionZone();
        if (zone === 'redline') this.everRedlined = true;

        // --- snap grace ---
        if (this.tension >= 1) {
            this.snapGraceTimer += dtSec;
            if (this.snapGraceTimer >= f.snapGraceBaseSec * this.gear.line.snapResist) {
                this.finish('lineSnapped');
                return;
            }
        } else {
            this.snapGraceTimer = Math.max(0, this.snapGraceTimer - dtSec * 2);
        }

        // --- stamina drain / recovery ---
        if (this.tension < f.slackTensionThreshold) {
            this.staminaFrac = clamp(this.staminaFrac + this.profile.recoveryRate * dtSec, 0, 1);
            this.slackTimer += dtSec;
            const slackMax = f.slackTimerBaseSec * (1 + this.gear.hook.holdStrength);
            if (this.slackTimer >= slackMax) {
                this.finish('slackEscape');
                return;
            }
        } else {
            this.slackTimer = Math.max(0, this.slackTimer - dtSec * 2);
            const zoneMult = zone === 'safe' ? 1 : zone === 'power' ? f.powerZoneStaminaMult : f.redlineStaminaMult;
            const steerMult = clamp(1 + f.counterSteerStaminaBonus * counter - f.followSteerStaminaCut * follow, 0.15, 2.2);
            const drain = f.staminaDrainBase * Math.pow(this.tension, f.staminaDrainExponent) * zoneMult * this.gear.rod.power
                * steerMult * (holding ? 1 : 0.4) / Math.max(0.3, this.profile.stamina);
            this.staminaFrac = clamp(this.staminaFrac - drain * dtSec, 0, 1);
            if (counter > 0.3 && this.movePhase === 'active' && (this.move === 'run' || this.move === 'dive' || this.move === 'fakeout')) {
                this.moveActiveDuration -= f.counterSteerBurstShorten * counter * dtSec;
            }
        }

        // --- jump hook-throw check (once, on the frame the jump goes active) ---
        if (config.airborne && this.movePhase === 'active' && this.moveElapsed <= dtSec) {
            if (holding && this.tension > f.jumpTensionThrowThreshold) {
                const throwChance = clamp(f.jumpBaseThrowChance * (1 - this.gear.hook.holdStrength) + this.hookThrowRiskBonus, 0, 0.95);
                if (this.r.chance(throwChance)) { this.finish('hookThrown'); return; }
            } else {
                // Gave slack (or tension was low) -- the jump costs the fish stamina, rewarding a good read.
                this.staminaFrac = clamp(this.staminaFrac - 0.04, 0, 1);
            }
        }

        // --- distance ---
        const reelRate = f.reelBaseDistPerSec * this.gear.reel.captureSpeed * (0.3 + 0.7 * (1 - this.staminaFrac))
            * (config.reelBonusMult ?? 1);
        if (holding) this.distance -= reelRate * dtSec;
        const outward = p * config.outwardMult * (holding ? 0.35 : 1) * 0.16;
        this.distance += outward * dtSec;
        this.distance = clamp(this.distance, 0, 1.15);

        // --- lateral position (mostly cosmetic, feeds FightView + steer feedback) ---
        const lateralSpeed = config.lateral === 'still' ? 0.1 : config.lateral === 'circular' ? 0.9 : 0.7;
        this.lateralPos = clamp(this.lateralPos + this.runDir * lateralSpeed * dtSec, -1, 1);

        this.checkPhaseTransition();

        if (this.distance <= f.landedDistanceThreshold) { this.finish('landed'); return; }
    }

    private tensionZone(): 'safe' | 'power' | 'redline' {
        const f = BALANCE.fight;
        if (this.tension < f.tensionSafeMax) return 'safe';
        if (this.tension < f.tensionPowerMax) return 'power';
        return 'redline';
    }

    private advanceMove(dtSec: number): void {
        this.moveElapsed += dtSec;
        if (this.movePhase === 'telegraph') {
            if (this.moveElapsed >= this.moveTelegraphDuration) {
                this.movePhase = 'active';
                this.moveElapsed = 0;
                this.runDir = MOVES[this.move].reverseLateral ? -this.telegraphDir : this.telegraphDir;
                if (MOVES[this.move].lateral === 'circular') this.runDir = 1;
            }
            return;
        }
        if (this.movePhase === 'active') {
            if (MOVES[this.move].lateral === 'circular') {
                this.runDir = Math.sin(this.moveElapsed * 2.2);
            }
            if (this.moveElapsed >= Math.max(0.15, this.moveActiveDuration)) {
                this.movePhase = 'cooldown';
                this.moveElapsed = 0;
                const base = BALANCE.fight.moveCooldownBaseSec * (1.3 - this.aggression);
                this.cooldownTimer = clamp(base, 0.15, 1.8);
                this.runDir = 0;
            }
            return;
        }
        // cooldown
        if (this.moveElapsed >= this.cooldownTimer) {
            this.pickNextMove();
        }
    }

    private pickMove(id: MoveId): void {
        const config = MOVES[id];
        this.move = id;
        this.moveElapsed = 0;
        this.moveTelegraphDuration = config.telegraphSec;
        this.moveActiveDuration = this.r.range(config.activeSecMin, config.activeSecMax);
        this.telegraphDir = this.r.chance(0.5) ? 1 : -1;
        if (config.telegraphSec > 0) {
            this.movePhase = 'telegraph';
        } else {
            this.movePhase = 'active';
            this.runDir = config.lateral === 'drift' ? this.r.range(-0.4, 0.4) : this.telegraphDir;
        }
    }

    private pickNextMove(): void {
        const offensive: MoveId[] = [...this.unlockedMoves].filter(m => m !== 'cruise' && m !== 'rest');
        const entries: [MoveId, number][] = [['cruise', 0.35]];
        if (this.unlockedMoves.has('rest')) entries.push(['rest', (1 - this.staminaFrac) * 1.4 + 0.05]);
        for (const m of offensive) {
            entries.push([m, this.aggression * this.staminaFrac * 0.9 + 0.05]);
        }
        const next = this.r.weighted(entries);
        this.pickMove(next);
    }

    private checkPhaseTransition(): void {
        const phases = this.profile.phases;
        if (!phases || this.phaseIndex >= phases.length) return;
        const next = phases[this.phaseIndex];
        if (this.staminaFrac <= next.staminaThreshold) {
            this.phaseIndex++;
            this.aggression = clamp(this.aggression * next.aggressionMult, 0, 1);
            for (const m of next.addMoves) this.unlockedMoves.add(m);
            this.phaseAnnounceTimer = BALANCE.fight.phaseAnnounceDurationSec;
            this.phaseLabel = next.label;
        }
    }

    private finish(result: FightResult): void {
        this.result = result;
    }

    snapshot(): FightSnapshot {
        return {
            tension: clamp(this.tension, 0, 1),
            tensionZone: this.tensionZone(),
            staminaFrac: this.staminaFrac,
            distance: clamp(this.distance, 0, 1.15),
            lateralPos: this.lateralPos,
            runDir: this.runDir,
            move: this.move,
            movePhase: this.movePhase,
            moveLabel: MOVES[this.move].label,
            telegraphDir: this.telegraphDir,
            airborne: !!MOVES[this.move].airborne && this.movePhase === 'active',
            snapGraceFrac: clamp(this.snapGraceTimer / (BALANCE.fight.snapGraceBaseSec * this.gear.line.snapResist), 0, 1),
            slackFrac: clamp(this.slackTimer / (BALANCE.fight.slackTimerBaseSec * (1 + this.gear.hook.holdStrength)), 0, 1),
            phaseIndex: this.phaseIndex,
            phaseAnnouncing: this.phaseAnnounceTimer > 0,
            phaseLabel: this.phaseLabel,
            everRedlined: this.everRedlined,
            elapsedSec: this.elapsedSec,
            result: this.result
        };
    }

    isDone(): boolean { return this.result !== 'none'; }
    isPerfect(): boolean { return this.result === 'landed' && !this.everRedlined && this.elapsedSec <= this.profile.parSec; }
}
